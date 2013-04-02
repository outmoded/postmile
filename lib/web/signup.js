// Load modules

var Hapi = require('hapi');
var Api = require('./api');
var Login = require('./login');
var Session = require('./session');


// Registration

exports.form = function (request) {

    var signupSession = request.session.get('signup');
    if (!signupSession) {
        return request.reply.redirect('/').send();
    }

    // Check if invitation required

    Api.call('GET', '/invite/public', '', function (err, code, payload) {

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

        return request.reply.view('register', locals).send();
    });
};


exports.register = function (request) {

    console.log(request.state);
    var signup = request.session.get('signup', true);
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

            signup.invite = request.payload.invite;
            signup.name = request.payload.name;
            signup.username = request.payload.username;
            signup.email = request.payload.email;
            request.session.set('signup', signup);
            request.session.set('message', (payload && payload.message ? payload.message : (err && err.message ? err.message : 'Service unavailable')));

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

            request.session.set('invite', { code: request.params.id, about: payload });
            return request.reply.redirect('/signup/invite').send();
        }

        return request.reply.view('invite-invalid').send();
    });
};


// Project invitation

exports.invite = function (request) {

    var inviteSession = request.session.get('invite', true);
    if (!inviteSession ||
        !inviteSession.code ||
        !inviteSession.about) {

        return request.reply.view('invite-invalid').send();
    }

    request.session.set('invite', inviteSession);

    var locals = {
        title: inviteSession.about.title,
        inviter: inviteSession.about.inviter,
        code: inviteSession.code
    };

    if (request.auth.credentials &&
        request.auth.credentials.profile) {

        return request.reply.view('invite-in', locals).send();
    }

    return request.reply.view('invite-out', locals).send();
};


// Claim project invitation by current user

exports.claim = function (request) {

    var inviteSession = request.session.get('invite', true);
    if (!inviteSession ||
        !inviteSession.code) {

        return request.reply.view('invite-invalid').send();
    }

    Api.call('POST', '/invite/' + inviteSession.code + '/claim', '', request.auth.credentials, function (err, code, payload) {

        if (!err &&
            code === 200 &&
            payload &&
            payload.project) {

            return request.reply.redirect(request.auth.credentials.profile.view + '#project=' + payload.project).send();
        }

        return request.reply.view('invite-invalid').send();
    });
};


// Logout and use invite with another account

exports.other = function (request) {

    // Logout

    request.auth.session.clear();

    // Try again

    return request.reply.redirect('/signup/invite').send();
};


// Create account from project invite

exports.inviteRegister = function (request) {

    var inviteSession = request.session.get('invite', true);
    if (!inviteSession ||
        !inviteSession.code ||
        !inviteSession.about) {

        return request.reply.view('invite-invalid').send();
    }

    var registration = {};

    Api.clientCall('PUT', '/user?invite=' + encodeURIComponent(inviteSession.code), registration, function (err, code, payload) {

        if (err ||
            code !== 200) {

            return request.reply.view('invite-invalid').send();
        }

        // Login new user

        Login.loginCall('id', payload.id, request, '/view/' + (inviteSession.about.project ? '#project=' + inviteSession.about.project : ''));
    });
};


