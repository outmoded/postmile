// Load modules

var Hapi = require('hapi');
var Api = require('./api');
var Config = require('./config');


// Declare internals

var internals = {};


// Account page

exports.get = function (request) {

    if (request.params.panel &&
        ['profile', 'linked', 'emails'].indexOf(request.params.panel) !== -1) {

        var locals = {
            env: {
                username: request.auth.credentials.profile.username,
                currentUsername: request.auth.credentials.profile.username,
                name: request.auth.credentials.profile.name,
                message: request.session.get('message', true) || ''
            }
        };

        return request.reply.view('account-' + request.params.panel, locals);
    }

    return request.reply.redirect('/account/profile');
};


// Account reminder using email or username

exports.reminder = function (request) {

    Api.clientCall('POST', '/user/reminder', { account: request.payload.account }, function (err, code, payload) {

        if (err) {
            return request.reply(Hapi.error.internal('Unexpected API response', err));
        }

        if (code === 404) {
            return request.reply(Hapi.error.notFound());
        }

        if (code === 400) {
            return request.reply(Hapi.error.badRequest());
        }

        if (code !== 200) {
            return request.reply(Hapi.error.internal('Unexpected API response: ' + payload));
        }

        request.reply(payload);
    });
};


// Update account profile

exports.profile = function (request) {

    var body = {};

    if (request.payload.username !== request.auth.credentials.profile.username) {
        body.username = request.payload.username;
    }

    if (request.payload.name &&
        request.payload.name !== request.auth.credentials.profile.name) {

        body.name = request.payload.name;
    }

    if (!Object.keys(body).length) {
        return request.reply.redirect('/account/profile');
    }

    Api.call('POST', '/profile', body, request.auth.credentials, function (err, code, payload) {

        if (err || code !== 200) {
            request.session.set('message', 'Failed saving changes: ' + (code === 400 ? payload.message : 'Service unavailable'));
        }

        return request.reply.redirect('/account/profile');
    });
};


// Update account profile

exports.emails = function (request) {

    if (['add', 'remove', 'primary', 'verify'].indexOf(request.payload.action) === -1) {
        request.session.set('message', 'Failed saving changes: Bad request');
        return request.reply.redirect('/account/emails');
    }

    Api.call('POST', '/profile/email', request.payload, request.auth.credentials, function (err, code, payload) {

        if (err || code !== 200) {
            request.session.set('message', 'Failed saving changes: ' + (code === 400 ? payload.message : 'Service unavailable'));
        }
        else if (request.payload.action === 'verify') {
            request.session.set('message', 'Verification email sent. Please check your inbox (or spam folder) for an email from ' + Config.product.name + ' and follow the instructions.');
        }

        return request.reply.redirect('/account/emails');
    });
};





