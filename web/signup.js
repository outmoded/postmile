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

    request.api.jar.signup = request.state.jar.signup;

    // Check if invitation required

    Api.call('GET', '/invite/public', '', function (err, code, payload) {

        if (code === 200) {
            request.api.jar.signup.invite = 'public';
        }
        else {
            request.api.jar.signup.invite = (request.api.jar.signup.invite == 'public' ? '' : request.api.jar.signup.invite);
        }

        var locals = {
            logo: false,
            network: request.state.jar.signup.network,
            env: {
                invite: (request.api.jar.signup.invite || ''),
                name: (request.api.jar.signup.name || ''),
                email: (request.api.jar.signup.email || ''),
                username: (request.api.jar.signup.username || ''),
                message: (request.api.jar.message || '')
            }
        };

        return request.reply.view('register', locals);
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

            request.api.jar.signup = request.state.jar.signup;
            request.api.jar.signup.invite = request.payload.invite;
            request.api.jar.signup.name = request.payload.name;
            request.api.jar.signup.username = request.payload.username;
            request.api.jar.signup.email = request.payload.email;
            request.api.jar.message = (payload && payload.message ? payload.message : (err && err.message ? err.message : 'Service unavailable'));

            return request.reply.redirect('/signup/register').send();
        }

        // Login new user

        Login.loginCall(signup.network, signup.id, res, next, '/welcome');
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

            request.api.jar.invite = { code: request.params.id, about: payload };
            return request.reply.redirect('/signup/invite').send();
        }

        return request.reply.view('invite-invalid');
    });
};


// Project invitation

exports.invite = function (request) {

    if (!request.state.jar.invite ||
        !request.state.jar.invite.code ||
        !request.state.jar.invite.about) {

        return request.reply.view('invite-invalid');
    }

    request.api.jar.invite = request.state.jar.invite;

    var locals = {
        title: request.state.jar.invite.about.title,
        inviter: request.state.jar.invite.about.inviter,
        code: request.state.jar.invite.code
    };

    if (request.session.profile) {
        return request.reply.view('invite-in', locals);
    }

    return request.reply.view('invite-out', locals);
};


// Claim project invitation by current user

exports.claim = function (request) {

    if (!request.state.jar.invite ||
        !request.state.jar.invite.code) {

        return request.reply.view('invite-invalid');
    }

    Api.call('POST', '/invite/' + request.state.jar.invite.code + '/claim', '', request.session, function (err, code, payload) {

        if (!err &&
            code === 200 &&
            payload &&
            payload.project) {

            return request.reply.redirect(request.session.profile.view + '#project=' + payload.project).send();
        }

        return request.reply.view('invite-invalid');
    });
};


// Logout and use invite with another account

exports.other = function (request) {

    // Maintain state

    request.api.jar.invite = request.state.jar.invite;

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

        return request.reply.view('invite-invalid');
    }

    var registration = {};

    Api.clientCall('PUT', '/user?invite=' + encodeURIComponent(request.state.jar.invite.code), registration, function (err, code, payload) {

        if (err ||
            code !== 200) {

            return request.reply.view('invite-invalid');
        }

        // Login new user

        Login.loginCall('id', payload.id, res, next, '/view/' + (request.state.jar.invite.about.project ? '#project=' + request.state.jar.invite.about.project : ''));
    });
};


