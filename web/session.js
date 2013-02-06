// Load modules

var Hapi = require('hapi');
var QueryString = require('querystring');
var Api = require('./api');
var Utils = require('./utils');
var Log = require('./log');
var Vault = require('./vault');
var Tos = require('./tos');
var Config = require('./config');


// Declare internals

var internals = {};


// Parse session cookie

exports.validate = function (session, callback) {

    var loadProfile = function (override) {

        var credentials = override || session;
        Api.call('GET', '/profile', null, credentials, function (err, code, payload) {

            if (err ||
                code !== 200 ||
                !payload) {

                return callback(Hapi.error.internal('Failed loading profile'));
            }

            credentials.profile = payload;
            return callback(null, credentials);
        });
    };

    if (session.exp &&
        session.exp > Date.now()) {

        return loadProfile();
    }

    // Check if expired or invalid
    
    exports.refresh(null, session, function (err, refreshed) {

        if (err) {
            return callback(Hapi.error.internal('Failed refreshing session'));
        }

        return loadProfile(refreshed);
    });
};


exports.refresh = function (request, session, callback) {

    if (!session) {
        return callback(Hapi.error.internal('Session missing rsvp data', session));
    }

    Api.call('POST', '/oz/reissue', null, session, function (err, code, ticket) {

        if (err) {
            return callback(Hapi.error.internal('Unexpected API response', err));
        }

        if (code !== 200) {
            if (request) {
                request.clearSession();
            }

            return callback(Hapi.error.badRequest(ticket.message));
        }

        exports.set(request, ticket, function (isValid, restrictions) {

            if (!isValid) {
                return callback(Hapi.error.internal('Invalid response parameters from API server'));
            }

            return callback(null, ticket);
        });
    });
};


exports.set = function (request, ticket, callback) {

    if (!ticket) {
        return callback(false, null);
    }

    var session = ticket;
    session.restriction = (session.ext.tos < Tos.minimumTOS ? 'tos' : null);

    if (request) {
        request.setSession(session);
    }

    return callback(true, session.restriction);
};


// Oz authorization endpoint

exports.ask = function (request) {

    // Lookup client identifier

    if (request.query.client_id) {

        // Missing client identifier

        var locals = {
            code: 500,
            message: 'sorry, the application that sent you here messed something up...'
        };

        return request.reply.view('error', locals).send();
    }

    Api.clientCall('GET', '/oz/app/' + request.query.client_id, null, function (err, code, client) {

        if (err ||
            !client ||
            (code !== 200 && code !== 404)) {

            return request.reply(Hapi.error.internal('Unexpected API response', err));
        }

        if (code === 404) {

            // Unknown client

            var locals = {
                code: 'unknown',
                message: 'sorry, we can\'t find the application that sent you here...'
            };

            return request.reply.view('error', locals).send();
        }

        // Application callback

        if (client.callback &&
            request.query.redirect_uri) {

            return request.reply(Hapi.error.internal('Client request includes a redirection URI for a pre-configured callback client', client));
        }

        if (!client.callback &&
            !request.query.redirect_uri) {

            return request.reply(Hapi.error.internal('Client missing callback', client));
        }

        var redirectionURI = client.callback || request.query.redirect_uri;
        var untrustedClient = !!client.callback;

        // Response type

        if (!request.query.response_type ||
            request.query.response_type !== 'token') {

            return request.reply.redirect(redirectionURI + '?error=invalid_request&error_description=Bad%20response_type%20parameter' + (request.query.state ? '&state=' + encodeURIComponent(request.query.state) : '')).send();
        }

        // Implicit grant type

        res.api.jar.oz = { client: client, redirection: redirectionURI };
        if (request.query.state) {
            res.api.jar.oz.state = request.query.state;
        }

        var locals = {
            title: client.title,
            description: client.description,
            warning: untrustedClient
        };

        return request.reply.view('oz', locals).send();
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
            return request.reply(Hapi.error.internal('Unexpected API response', err));
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
            return request.reply(Hapi.error.internal('Failed refresh', err));
            res.api.isAPI = true;
            return next();
        }

        if (ticket.ext.tos < Tos.minimumTOS) {
            return request.reply(Hapi.error.badRequest('Restricted session'));
            res.api.isAPI = true;
            return next();
        }
        
        res.api.result = ticket;
        res.api.isAPI = true;
        return next();
    });
};


