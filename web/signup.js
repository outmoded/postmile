// Load modules

var Hapi = require('hapi');
var Api = require('./api');
var Login = require('./login');
var Session = require('./session');


// Registration

exports.form = function (request) {

    if (!request.state.jar.signup) {
        return request.reply.redirect('/').send();
    }

    request.plugins.jar.signup = request.state.jar.signup;

    // Check if invitation required

    Api.call('GET', '/invite/public', '', function (err, code, payload) {

        if (code === 200) {
            request.plugins.jar.signup.invite = 'public';
        }
        else {
            request.plugins.jar.signup.invite = (request.plugins.jar.signup.invite == 'public' ? '' : request.plugins.jar.signup.invite);
        }

        var locals = {
            logo: false,
            network: request.state.jar.signup.network,
            env: {
                invite: (request.plugins.jar.signup.invite || ''),
                name: (request.plugins.jar.signup.name || ''),
                email: (request.plugins.jar.signup.email || ''),
                username: (request.plugins.jar.signup.username || ''),
                message: (request.plugins.jar.message || '')
            }
        };

        return request.reply.view('register', locals).send();
    });
};


exports.register = function (request) {

    var signup = request.state.jar.signup;
    if (!signup ||
        !signup.network ||
        !signup.id) {

        return request.reply.redirect('/').send();
    }

    var registration = { network: [signup.network, signup.id] };

    if (request.payload.username) {
        registration.username = request.payload.username;
    }

    if (request.payload.email) {
        registration.email = request.payload.email;
    }

    if (request.payload.name) {
        registration.name = request.payload.name;
    }

    Api.clientCall('PUT', '/user' + (request.payload.invite ? '?invite=' + encodeURIComponent(request.payload.invite) : ''), registration, function (err, code, payload) {

        if (err ||
            code !== 200) {

            // Try again

            request.plugins.jar.signup = request.state.jar.signup;
            request.plugins.jar.signup.invite = request.payload.invite;
            request.plugins.jar.signup.name = request.payload.name;
            request.plugins.jar.signup.username = request.payload.username;
            request.plugins.jar.signup.email = request.payload.email;
            request.plugins.jar.message = (payload && payload.message ? payload.message : (err && err.message ? err.message : 'Service unavailable'));

            return request.reply.redirect('/signup/register').send();
        }

        // Login new user

        Login.loginCall(signup.network, signup.id, request, '/welcome');
    });
};


// Project invitation entry point

exports.i = function (request) {

    // Fetch invitation details

    Api.call('GET', '/invite/' + request.params.id, '', function (err, code, payload) {

        if (!err &&
            code === 200 &&
            payload &&
            payload.title &&
            payload.inviter) {

            // Save information

            request.plugins.jar.invite = { code: request.params.id, about: payload };
            return request.reply.redirect('/signup/invite').send();
        }

        return request.reply.view('invite-invalid').send();
    });
};


// Project invitation

exports.invite = function (request) {

    if (!request.state.jar.invite ||
        !request.state.jar.invite.code ||
        !request.state.jar.invite.about) {

        return request.reply.view('invite-invalid').send();
    }

    request.plugins.jar.invite = request.state.jar.invite;

    var locals = {
        title: request.state.jar.invite.about.title,
        inviter: request.state.jar.invite.about.inviter,
        code: request.state.jar.invite.code
    };

    if (request.session &&
        request.session.profile) {

        return request.reply.view('invite-in', locals).send();
    }

    return request.reply.view('invite-out', locals).send();
};


// Claim project invitation by current user

exports.claim = function (request) {

    if (!request.state.jar.invite ||
        !request.state.jar.invite.code) {

        return request.reply.view('invite-invalid').send();
    }

    Api.call('POST', '/invite/' + request.state.jar.invite.code + '/claim', '', request.session, function (err, code, payload) {

        if (!err &&
            code === 200 &&
            payload &&
            payload.project) {

            return request.reply.redirect(request.session.profile.view + '#project=' + payload.project).send();
        }

        return request.reply.view('invite-invalid').send();
    });
};


// Logout and use invite with another account

exports.other = function (request) {

    // Maintain state

    request.plugins.jar.invite = request.state.jar.invite;

    // Logout

    request.clearSession();

    // Try again

    return request.reply.redirect('/signup/invite').send();
};


// Create account from project invite

exports.inviteRegister = function (request) {

    if (!request.state.jar.invite ||
        !request.state.jar.invite.code ||
        !request.state.jar.invite.about) {

        return request.reply.view('invite-invalid').send();
    }

    var registration = {};

    Api.clientCall('PUT', '/user?invite=' + encodeURIComponent(request.state.jar.invite.code), registration, function (err, code, payload) {

        if (err ||
            code !== 200) {

            return request.reply.view('invite-invalid').send();
        }

        // Login new user

        Login.loginCall('id', payload.id, request, '/view/' + (request.state.jar.invite.about.project ? '#project=' + request.state.jar.invite.about.project : ''));
    });
};


