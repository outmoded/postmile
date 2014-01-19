// Load modules

var Hapi = require('hapi');
var QueryString = require('querystring');
var Api = require('./api');
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
            credentials.profile.view = credentials.profile.view || '/view/';        // Set default view

            return callback(null, true, credentials);
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
                request.auth.session.clear();
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

    ticket.restriction = (ticket.ext.tos < Tos.minimumTOS ? 'tos' : null);

    if (request) {
        request.auth.session.set(ticket);
    }

    return callback(true, ticket.restriction);
};


// Oz authorization endpoint

exports.ask = function (request, reply) {

    // Lookup client identifier

    if (request.query.client_id) {

        // Missing client identifier

        var locals = {
            code: 500,
            message: 'sorry, the application that sent you here messed something up...'
        };

        return reply.view('error', locals);
    }

    Api.clientCall('GET', '/oz/app/' + request.query.client_id, null, function (err, code, client) {

        if (err ||
            !client ||
            (code !== 200 && code !== 404)) {

            return reply(Hapi.error.internal('Unexpected API response', err));
        }

        if (code === 404) {

            // Unknown client

            var locals = {
                code: 'unknown',
                message: 'sorry, we can\'t find the application that sent you here...'
            };

            return reply.view('error', locals);
        }

        // Application callback

        if (client.callback &&
            request.query.redirect_uri) {

            return reply(Hapi.error.internal('Client request includes a redirection URI for a pre-configured callback client', client));
        }

        if (!client.callback &&
            !request.query.redirect_uri) {

            return reply(Hapi.error.internal('Client missing callback', client));
        }

        var redirectionURI = client.callback || request.query.redirect_uri;
        var untrustedClient = !!client.callback;

        // Response type

        if (!request.query.response_type ||
            request.query.response_type !== 'token') {

            return reply().redirect(redirectionURI + '?error=invalid_request&error_description=Bad%20response_type%20parameter' + (request.query.state ? '&state=' + encodeURIComponent(request.query.state) : ''));
        }

        // Implicit grant type

        var ozState = { client: client, redirection: redirectionURI }
        if (request.query.state) {
            ozState = request.query.state;
        }

        request.session.set('oz', ozState);

        var locals = {
            title: client.title,
            description: client.description,
            warning: untrustedClient
        };

        return reply.view('oz', locals);
    });
};


exports.answer = function (request, reply) {

    var ozSession = request.session.get('oz', true);
    if (!ozSession ||
        !ozSession.client) {

        return reply().redirect('/');
    }

    var options = {
        issueTo: ozSession.client.id,
        scope: []
    };

    Api.call('POST', '/oz/reissue', options, request.auth.credentials, function (err, code, ticket) {

        if (err || code !== 200) {
            return reply(Hapi.error.internal('Unexpected API response', err));
        }

        if (ozSession.state) {
            ticket.state = ozSession.state;
        }

        return reply().redirect(ozSession.redirection + '#' + QueryString.stringify(ticket));
    });
};


exports.session = function (request, reply) {

    var options = {
        issueTo: Vault.viewClient.id,
        scope: []
    };

    Api.call('POST', '/oz/reissue', options, request.auth.credentials, function (err, code, ticket) {

        if (err || code !== 200) {
            return reply(Hapi.error.internal('Failed refresh', err));
        }

        if (ticket.ext.tos < Tos.minimumTOS) {
            return reply(Hapi.error.badRequest('Restricted session'));
        }
        
        reply(ticket);
    });
};


