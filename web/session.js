/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

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

    if (req.cookies.session) {

        var session = Utils.decrypt(Vault.session.aes256Key, req.cookies.session);
        if (session) {

            // Check if expired or invalid

            if (session.expiration &&
                session.expiration > Utils.getTimestamp()) {

                internals.loadProfile(res, session, callback);
            }
            else {

                exports.refresh(req, res, session, function (session, err) {

                    if (err === null) {

                        internals.loadProfile(res, session, callback);
                    }
                    else {

                        callback(null, null);
                    }
                });
            }
        }
        else {

            callback(null, null);
        }
    }
    else {

        callback(null, null);
    }
};


internals.loadProfile = function (res, session, callback) {

    Api.call('GET', '/profile', null, session, function (result, err, code) {

        if (result) {

            var profile = result;
            callback(session, profile);
        }
        else {

            exports.clear(res);
            callback(null, null);
        }
    });
};


exports.refresh = function (req, res, session, callback) {

    if (session &&
        session.refresh) {

        var tokenRequest = {

            grant_type: 'refresh_token',
            refresh_token: session.refresh,
            client_id: 'postmile.view',
            client_secret: ''
        };

        Api.clientCall('POST', '/oauth/token', tokenRequest, function (token, err, code) {

            if (token) {

                exports.set(res, token, function (isValid, restrictions) {

                    if (isValid) {

                        callback(null);
                    }
                    else {

                        callback(Err.internal('Invalid response parameters from API server'));
                    }
                });
            }
            else if (err &&
                     err.error &&
                     err.error === 'invalid_grant') {

                exports.clear(res);

                callback(Err.badRequest(errorMessage));
            }
            else {

                callback(Err.internal('Unexpected API response', err));
            }
        });
    }
    else {

        callback(Err.internal('Session missing refresh data', session));
    }
};


exports.logout = function (res, next) {

    exports.clear(res);
    res.api.redirect = '/';
    res.api.result = 'You are being redirected...';
    next();
};


exports.set = function (res, token, callback) {

    if (token.access_token &&
        token.mac_key &&
        token.mac_algorithm &&
        token.refresh_token &&
        token.expires_in) {

        var nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);

        var session = {

            id: token.access_token,
            key: token.mac_key,
            algorithm: token.mac_algorithm,
            expiration: Utils.getTimestamp() + (token.expires_in * 1000),
            refresh: token.refresh_token,
            tos: token.x_tos,
            restriction: token.x_tos < Tos.minimumTOS ? 'tos' : null
        };

        res.api.cookie = {

            values: ['session=' + Utils.encrypt(Vault.session.aes256Key, session)],
            attributes: ['Expires=' + nextYear.toUTCString(), 'Path=/']
        };

        if (Config.host.web.scheme === 'https') {

            res.api.cookie.attributes.push('Secure');
        }

        callback(true, session.restriction);
    }
    else {

        callback(false, null);
    }
};


exports.clear = function (res) {

    res.api.cookie = {

        values: ['session='],
        attributes: ['Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'Path=/']
    };
};


// OAuth authorization endpoint

exports.oauth = function (req, res, next) {

    if (req.method === 'GET') {

        // Lookup client identifier

        if (req.query.client_id) {

            Api.clientCall('GET', '/oauth/client/' + req.query.client_id, null, function (client, err, code) {

                if (client &&
                    client.name) {

                    // Validate callback

                    var redirectionURI;
                    var untrustedClient = true;

                    if (client.callback) {

                        // Pre-configured (locked)

                        if (req.query.redirect_uri) {

                            res.api.error = Err.internal('Client request includes a redirection URI for a pre-configured callback client', client);
                            next();
                        }
                        else {

                            redirectionURI = client.callback;
                            untrustedClient = false;
                        }
                    }
                    else if (req.query.redirect_uri) {

                        // Dynamic redirection URI

                        redirectionURI = req.query.redirect_uri;
                    }
                    else {

                        res.api.error = Err.internal('Client missing callback', client);
                        next();
                    }

                    if (redirectionURI) {

                        if (req.query.response_type) {

                            if (req.query.response_type === 'token') {

                                // Implicit grant type

                                res.api.jar.oauth = { client: client, redirection: redirectionURI };
                                if (req.query.state) {

                                    res.api.jar.oauth.state = req.query.state;
                                }

                                var locals = {

                                    title: client.title,
                                    description: client.description,
                                    warning: untrustedClient
                                };

                                res.api.view = { template: 'oauth', locals: locals };
                                next();
                            }
                            else if (req.query.response_type === 'authorization_code') {

                                // Authorization code grant type

                                res.api.redirect = redirectionURI + '?error=unsupported_response_type' + (req.query.state ? '&state=' + encodeURIComponent(req.query.state) : '');
                                next();
                            }
                            else {

                                // Unknown response type parameter

                                res.api.redirect = redirectionURI + '?error=invalid_request&error_description=Unknown%20response_type%20parameter' + (req.query.state ? '&state=' + encodeURIComponent(req.query.state) : '');
                                next();
                            }
                        }
                        else {

                            // Missing response type parameter

                            res.api.redirect = redirectionURI + '?error=invalid_request&error_description=Missing%20response_type%20parameter' + (req.query.state ? '&state=' + encodeURIComponent(req.query.state) : '');
                            next();
                        }
                    }
                }
                else if (err &&
                         err.code &&
                         err.code === 404) {

                    // Unknown client

                    var locals = {

                        code: 'unknown',
                        message: 'sorry, we can\'t find the application that sent you here...'
                    };

                    res.api.view = { template: 'error', locals: locals };
                    next();
                }
                else {

                    res.api.error = Err.internal('Unexpected API response', err);
                    next();
                }
            });
        }
        else {

            // Missing client identifier

            var locals = {

                code: 500,
                message: 'sorry, the application that sent you here messed something up...'
            };

            res.api.view = { template: 'error', locals: locals };
            next();
        }
    }
    else {

        // POST

        if (req.api.jar.oauth &&
            req.api.jar.oauth.client) {

            var tokenRequest = {

                client_id: req.api.jar.oauth.client.name,
                client_secret: '',
                grant_type: 'http://ns.postmile.net/id',
                x_user_id: req.api.profile.id
            };

            Api.clientCall('POST', '/oauth/token', tokenRequest, function (token, err, code) {

                if (token) {

                    if (req.api.jar.oauth.state) {

                        token.state = req.api.jar.oauth.state;
                    }

                    delete token.refresh_token;
                    delete token.x_tos;

                    res.api.redirect = req.api.jar.oauth.redirection + '#' + QueryString.stringify(token);
                    next();
                }
                else {

                    res.api.error = Err.internal('Unexpected API response', err);
                    next();
                }
            });
        }
        else {

            // Missing jar

            res.api.redirect = '/';
            next();
        }
    }
};


exports.issue = function (req, res, next) {

    if (req.api.session) {

        var tokenRequest = {

            grant_type: 'refresh_token',
            refresh_token: req.api.session.refresh,
            client_id: 'postmile.view',
            client_secret: ''
        };

        Api.clientCall('POST', '/oauth/token', tokenRequest, function (token, err, code) {

            if (token) {

                if (token.x_tos >= Tos.minimumTOS) {

                    res.api.result = {

                        id: token.access_token,
                        key: token.mac_key,
                        algorithm: token.mac_algorithm
                    };

                    res.api.isAPI = true;
                    next();
                }
                else {

                    res.api.error = Err.badRequest('Restricted session');
                    res.api.isAPI = true;
                    next();
                }
            }
            else {

                res.api.error = Err.internal('Failed refresh', err);
                res.api.isAPI = true;
                next();
            }
        });
    }
    else {

        res.api.error = Err.badRequest();
        res.api.isAPI = true;
        next();
    }
};


