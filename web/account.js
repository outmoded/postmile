// Load modules

var Hapi = require('hapi');
var Api = require('./api');
var Config = require('./config');


// Account page

exports.get = function (request) {

    if (request.params.panel &&
        ['profile', 'linked', 'emails'].indexOf(request.params.panel) !== -1) {

        var locals = {
            env: {
                username: request.session.profile.username,
                currentUsername: request.session.profile.username,
                name: request.session.profile.name,
                message: request.state.jar.message || ''
            }
        };

        return request.reply.view('account-' + request.params.panel, locals);
    }
    else {
        if (request.state.jar.message) {
            request.api.jar.message = request.state.jar.message;
        }

        return request.reply.redirect('/account/profile').send();
    }
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

    if (request.payload.username !== request.session.profile.username) {
        body.username = request.payload.username;
    }

    if (request.payload.name &&
        request.payload.name !== request.session.profile.name) {

        body.name = request.payload.name;
    }

    if (!Object.keys(body).length) {
        return request.reply.redirect('/account/profile').send();
    }

    Api.call('POST', '/profile', body, request.session, function (err, code, payload) {

        if (err || code !== 200) {
            request.api.jar.message = 'Failed saving changes. ' + (code === 400 ? payload.message : 'Service unavailable');
        }

        return request.reply.redirect('/account/profile').send();
    });
};


// Update account profile

exports.emails = function (request) {

    if (['add', 'remove', 'primary', 'verify'].indexOf(request.payload.action) === -1) {
        request.api.jar.message = 'Failed saving changes. Bad request';
        return request.reply.redirect('/account/emails').send();
    }

    Api.call('POST', '/profile/email', request.payload, request.session, function (err, code, payload) {

        if (err || code !== 200) {
            request.api.jar.message = 'Failed saving changes. ' + (code === 400 ? payload.message : 'Service unavailable');
        }
        else if (request.payload.action === 'verify') {
            request.api.jar.message = 'Verification email sent. Please check your inbox (or spam folder) for an email from ' + Config.product.name + ' and follow the instructions.';
        }

        return request.reply.redirect('/account/emails').send();
    });
};





