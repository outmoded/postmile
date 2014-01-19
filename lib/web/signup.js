// Load modules

var Hapi = require('hapi');
var Api = require('./api');
var Login = require('./login');
var Session = require('./session');


// Declare internals

var internals = {};


// Registration

exports.form = function (request, reply) {

    var signupSession = request.session.get('signup');
    if (!signupSession) {
        return reply().redirect('/');
    }

    // Check if invitation required

    Api.call('GET', '/invite/public', '', null, function (err, code, payload) {

        signupSession.invite = (code === 200 ? 'public' : (signupSession.invite === 'public' ? '' : signupSession.invite));
        request.session.touch('signup');

        var locals = {
            logo: false,
            network: signupSession.network,
            env: {
                invite: (signupSession.invite || ''),
                name: (signupSession.name || ''),
                email: (signupSession.email || ''),
                username: (signupSession.username || ''),
                message: (request.session.get('message', true) || '')
            }
        };

        return reply.view('register', locals);
    });
};


exports.register = function (request, reply) {

    var signup = request.session.get('signup', true);
    if (!signup ||
        !signup.network ||
        !signup.id) {

        return reply().redirect('/');
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

            signup.invite = request.payload.invite;
            signup.name = request.payload.name;
            signup.username = request.payload.username;
            signup.email = request.payload.email;
            request.session.set('signup', signup);
            request.session.set('message', (payload && payload.message ? payload.message : (err && err.message ? err.message : 'Service unavailable')));

            return reply().redirect('/signup/register');
        }

        // Login new user

        Login.loginCall(signup.network, signup.id, request, '/welcome', null, reply);
    });
};


// Project invitation entry point

exports.i = function (request, reply) {

    // Fetch invitation details

    Api.call('GET', '/invite/' + request.params.id, '', null, function (err, code, payload) {

        if (!err &&
            code === 200 &&
            payload &&
            payload.title &&
            payload.inviter) {

            // Save information

            request.session.set('invite', { code: request.params.id, about: payload });
            return reply().redirect('/signup/invite');
        }

        return reply.view('invite-invalid');
    });
};


// Project invitation

exports.invite = function (request, reply) {

    var inviteSession = request.session.get('invite', true);
    if (!inviteSession ||
        !inviteSession.code ||
        !inviteSession.about) {

        return reply.view('invite-invalid');
    }

    request.session.set('invite', inviteSession);

    var locals = {
        title: inviteSession.about.title,
        inviter: inviteSession.about.inviter,
        code: inviteSession.code
    };

    if (request.auth.credentials &&
        request.auth.credentials.profile) {

        return reply.view('invite-in', locals);
    }

    return reply.view('invite-out', locals);
};


// Claim project invitation by current user

exports.claim = function (request, reply) {

    var inviteSession = request.session.get('invite', true);
    if (!inviteSession ||
        !inviteSession.code) {

        return reply.view('invite-invalid');
    }

    Api.call('POST', '/invite/' + inviteSession.code + '/claim', '', request.auth.credentials, function (err, code, payload) {

        if (!err &&
            code === 200 &&
            payload &&
            payload.project) {

            return reply().redirect(request.auth.credentials.profile.view + '#project=' + payload.project);
        }

        return reply.view('invite-invalid');
    });
};


// Logout and use invite with another account

exports.other = function (request, reply) {

    // Logout

    request.auth.session.clear();

    // Try again

    return reply().redirect('/signup/invite');
};


// Create account from project invite

exports.inviteRegister = function (request, reply) {

    var inviteSession = request.session.get('invite', true);
    if (!inviteSession ||
        !inviteSession.code ||
        !inviteSession.about) {

        return reply.view('invite-invalid');
    }

    var registration = {};

    Api.clientCall('PUT', '/user?invite=' + encodeURIComponent(inviteSession.code), registration, function (err, code, payload) {

        if (err ||
            code !== 200) {

            return reply.view('invite-invalid');
        }

        // Login new user

        Login.loginCall('id', payload.id, request, '/view/' + (inviteSession.about.project ? '#project=' + inviteSession.about.project : ''), null, reply);
    });
};


