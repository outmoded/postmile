// Load modules

var Hapi = require('hapi');
var Api = require('./api');
var Login = require('./login');
var Session = require('./session');


// Registration

exports.form = function (request) {

    if (!request.state.yar.signup) {
        return request.reply.redirect('/').send();
    }

    request.plugins.yar.signup = request.state.yar.signup;

    // Check if invitation required

    Api.call('GET', '/invite/public', '', function (err, code, payload) {

        if (code === 200) {
            request.plugins.yar.signup.invite = 'public';
        }
        else {
            request.plugins.yar.signup.invite = (request.plugins.yar.signup.invite === 'public' ? '' : request.plugins.yar.signup.invite);
        }

        var locals = {
            logo: false,
            network: request.state.yar.signup.network,
            env: {
                invite: (request.plugins.yar.signup.invite || ''),
                name: (request.plugins.yar.signup.name || ''),
                email: (request.plugins.yar.signup.email || ''),
                username: (request.plugins.yar.signup.username || ''),
                message: (request.plugins.yar.message || '')
            }
        };

        return request.reply.view('register', locals).send();
    });
};


exports.register = function (request) {

    console.log(request.state);
    var signup = request.state.yar.signup;
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

            request.plugins.yar.signup = request.state.yar.signup;
            request.plugins.yar.signup.invite = request.payload.invite;
            request.plugins.yar.signup.name = request.payload.name;
            request.plugins.yar.signup.username = request.payload.username;
            request.plugins.yar.signup.email = request.payload.email;
            request.plugins.yar.message = (payload && payload.message ? payload.message : (err && err.message ? err.message : 'Service unavailable'));

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

            request.plugins.yar.invite = { code: request.params.id, about: payload };
            return request.reply.redirect('/signup/invite').send();
        }

        return request.reply.view('invite-invalid').send();
    });
};


// Project invitation

exports.invite = function (request) {

    if (!request.state.yar.invite ||
        !request.state.yar.invite.code ||
        !request.state.yar.invite.about) {

        return request.reply.view('invite-invalid').send();
    }

    request.plugins.yar.invite = request.state.yar.invite;

    var locals = {
        title: request.state.yar.invite.about.title,
        inviter: request.state.yar.invite.about.inviter,
        code: request.state.yar.invite.code
    };

    if (request.session &&
        request.session.profile) {

        return request.reply.view('invite-in', locals).send();
    }

    return request.reply.view('invite-out', locals).send();
};


// Claim project invitation by current user

exports.claim = function (request) {

    if (!request.state.yar.invite ||
        !request.state.yar.invite.code) {

        return request.reply.view('invite-invalid').send();
    }

    Api.call('POST', '/invite/' + request.state.yar.invite.code + '/claim', '', request.session, function (err, code, payload) {

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

    request.plugins.yar.invite = request.state.yar.invite;

    // Logout

    request.clearSession();

    // Try again

    return request.reply.redirect('/signup/invite').send();
};


// Create account from project invite

exports.inviteRegister = function (request) {

    if (!request.state.yar.invite ||
        !request.state.yar.invite.code ||
        !request.state.yar.invite.about) {

        return request.reply.view('invite-invalid').send();
    }

    var registration = {};

    Api.clientCall('PUT', '/user?invite=' + encodeURIComponent(request.state.yar.invite.code), registration, function (err, code, payload) {

        if (err ||
            code !== 200) {

            return request.reply.view('invite-invalid').send();
        }

        // Login new user

        Login.loginCall('id', payload.id, request, '/view/' + (request.state.yar.invite.about.project ? '#project=' + request.state.yar.invite.about.project : ''));
    });
};


