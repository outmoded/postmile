// Load modules

var Hapi = require('hapi');
var Api = require('./api');
var Config = require('./config');


// Account page

exports.get = function (req, res, next) {

    if (req.params.panel &&
        (req.params.panel === 'profile' ||
         req.params.panel === 'linked' ||
         req.params.panel === 'emails')) {

        var locals = {
            env: {
                username: req.api.profile.username,
                currentUsername: req.api.profile.username,
                name: req.api.profile.name,
                message: req.api.jar.message || ''
            }
        };

        res.api.view = { template: 'account-' + req.params.panel, locals: locals };
        next();
    }
    else {
        if (req.api.jar.message) {
            res.api.jar.message = req.api.jar.message;
        }

        res.api.redirect = '/account/profile';
        next();
    }
};


// Account reminder using email or username

exports.reminder = function (req, res, next) {

    Api.clientCall('POST', '/user/reminder', { account: req.body.account }, function (err, code, payload) {

        if (err) {
            return request.reply(Hapi.error.internal('Unexpected API response', err));
            res.api.isAPI = true;
            return next();
        }

        if (code !== 200) {
            return request.reply((code === 404 ? Hapi.error.notFound() : (code === 400 ? Hapi.error.badRequest() : Hapi.error.internal('Unexpected API response: ' + payload))));
            res.api.isAPI = true;
            return next();
        }

        res.api.result = payload;
        return next();
    });
};


// Update account profile

exports.profile = function (req, res, next) {

    var body = {};

    if (req.body.username !== req.api.profile.username) {
        body.username = req.body.username;
    }

    if (req.body.name &&
        req.body.name !== req.api.profile.name) {

        body.name = req.body.name;
    }

    if (!Object.keys(body).length) {
        res.api.redirect = '/account/profile';
        return next();
    }

    Api.call('POST', '/profile', body, req.api.session, function (err, code, payload) {

        if (err || code !== 200) {
            res.api.jar.message = 'Failed saving changes. ' + (code === 400 ? payload.message : 'Service unavailable');
        }

        res.api.redirect = '/account/profile';
        next();
    });
};


// Update account profile

exports.emails = function (req, res, next) {

    if (['add', 'remove', 'primary', 'verify'].indexOf(req.body.action) === -1) {
        res.api.jar.message = 'Failed saving changes. Bad request';
        res.api.redirect = '/account/emails';
        return next();
    }

    Api.call('POST', '/profile/email', req.body, req.api.session, function (err, code, payload) {

        if (err || code !== 200) {
            res.api.jar.message = 'Failed saving changes. ' + (code === 400 ? payload.message : 'Service unavailable');
        }
        else if (req.body.action === 'verify') {
            res.api.jar.message = 'Verification email sent. Please check your inbox (or spam folder) for an email from ' + Config.product.name + ' and follow the instructions.';
        }

        res.api.redirect = '/account/emails';
        next();
    });
};





