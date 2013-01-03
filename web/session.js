// Load modules

var QueryString = require('querystring');
var Err = require('./error');
var Api = require('./api');
var Utils = require('./utils');
var Log = require('./log');
var Vault = require('./vault');
var Tos = require('./tos');
var Config = require('./config');


// Declare internals

var internals = {};


// Parse session cookie

exports.load = function (req, res, callback) {

    if (!req.cookies.session) {
        return callback(null, null);
    }

    var session = Utils.decrypt(Vault.session.aes256Key, req.cookies.session);
    if (!session) {
        return callback(null, null);
    }

    // Check if expired or invalid

    if (session.exp &&
        session.exp > Date.now()) {

        return internals.loadProfile(res, session, callback);
    }

    exports.refresh(req, res, session, function (err, session) {

        if (err) {
            return callback(null, null);
        }

        return internals.loadProfile(res, session, callback);
    });
};


internals.loadProfile = function (res, session, callback) {

    Api.call('GET', '/profile', null, session, function (err, code, payload) {

        if (err || code !== 200 || !payload) {
            exports.clear(res);
            return callback(null, null);
        }

        return callback(session, payload);
    });
};


exports.refresh = function (req, res, session, callback) {

    if (!session) {
        return callback(Err.internal('Session missing rsvp data', session));
    }

    Api.call('POST', '/oz/reissue', null, session, function (err, code, ticket) {

        if (err) {
            return callback(Err.internal('Unexpected API response', err));
        }

        if (code !== 200) {
            exports.clear(res);
            return callback(Err.badRequest(ticket.message));
        }

        exports.set(res, ticket, function (isValid, restrictions) {

            if (!isValid) {
                return callback(Err.internal('Invalid response parameters from API server'));
            }

            return callback(null, ticket);
        });
    });
};


exports.logout = function (res, next) {

    exports.clear(res);
    res.api.redirect = '/';
    res.api.result = 'You are being redirected...';
    next();
};


exports.set = function (res, ticket, callback) {

    if (!ticket) {
        return callback(false, null);
    }

    var session = ticket;
    session.restriction = (session.ext.tos < Tos.minimumTOS ? 'tos' : null);

    var nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    res.api.cookie = {
        values: ['session=' + Utils.encrypt(Vault.session.aes256Key, session)],
        attributes: ['Expires=' + nextYear.toUTCString(), 'Path=/']
    };

    if (Config.host.web.scheme === 'https') {
        res.api.cookie.attributes.push('Secure');
    }

    return callback(true, session.restriction);
};


exports.clear = function (res) {

    res.api.cookie = {
        values: ['session='],
        attributes: ['Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'Path=/']
    };
};


// Oz authorization endpoint

exports.ask = function (req, res, next) {

    // Lookup client identifier

    if (req.query.client_id) {

        // Missing client identifier

        var locals = {
            code: 500,
            message: 'sorry, the application that sent you here messed something up...'
        };

        res.api.view = { template: 'error', locals: locals };
        return next();
    }

    Api.clientCall('GET', '/oz/app/' + req.query.client_id, null, function (err, code, client) {

        if (err ||
            !client ||
            (code !== 200 && code !== 404)) {

            res.api.error = Err.internal('Unexpected API response', err);
            return next();
        }

        if (code === 404) {

            // Unknown client

            var locals = {
                code: 'unknown',
                message: 'sorry, we can\'t find the application that sent you here...'
            };

            res.api.view = { template: 'error', locals: locals };
            return next();
        }

        // Application callback

        if (client.callback &&
            req.query.redirect_uri) {

            res.api.error = Err.internal('Client request includes a redirection URI for a pre-configured callback client', client);
            return next();
        }

        if (!client.callback &&
            !req.query.redirect_uri) {

            res.api.error = Err.internal('Client missing callback', client);
            return next();
        }

        var redirectionURI = client.callback || req.query.redirect_uri;
        var untrustedClient = !!client.callback;

        // Response type

        if (!req.query.response_type ||
            req.query.response_type !== 'token') {

            res.api.redirect = redirectionURI + '?error=invalid_request&error_description=Bad%20response_type%20parameter' + (req.query.state ? '&state=' + encodeURIComponent(req.query.state) : '');
            return next();
        }

        // Implicit grant type

        res.api.jar.oz = { client: client, redirection: redirectionURI };
        if (req.query.state) {
            res.api.jar.oz.state = req.query.state;
        }

        var locals = {
            title: client.title,
            description: client.description,
            warning: untrustedClient
        };

        res.api.view = { template: 'oz', locals: locals };
        return next();
    });
};


exports.answer = function (req, res, next) {

    if (!req.api.jar.oz ||
        !req.api.jar.oz.client) {

        res.api.redirect = '/';
        return next();
    }

    var options = {
        issueTo: req.api.jar.oz.client.id,
        scope: []
    };

    Api.call('POST', '/oz/reissue', options, req.api.session, function (err, code, ticket) {

        if (err || code !== 200) {
            res.api.error = Err.internal('Unexpected API response', err);
            return next();
        }

        if (req.api.jar.oz.state) {
            ticket.state = req.api.jar.oz.state;
        }

        res.api.redirect = req.api.jar.oz.redirection + '#' + QueryString.stringify(ticket);
        return next();
    });
};


exports.session = function (req, res, next) {

    var options = {
        issueTo: Vault.postmileAPI.viewClientId,
        scope: []
    };

    Api.call('POST', '/oz/reissue', options, req.api.session, function (err, code, ticket) {

        if (err || code !== 200) {
            res.api.error = Err.internal('Failed refresh', err);
            res.api.isAPI = true;
            return next();
        }

        if (ticket.ext.tos < Tos.minimumTOS) {
            res.api.error = Err.badRequest('Restricted session');
            res.api.isAPI = true;
            return next();
        }
        
        res.api.result = ticket;
        res.api.isAPI = true;
        return next();
    });
};


