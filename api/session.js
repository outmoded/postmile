/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Hapi = require('hapi');
var Crypto = require('crypto');
var Db = require('./db');
var User = require('./user');
var Email = require('./email');
var Vault = require('./vault');


// Declare internals

var internals = {

    // Defaults

    defaultAlgorithm: 'hmac-sha-1',
    tokenLifetimeSec: 1209600               // Two weeks
};


// Session definitions

exports.type = {};

exports.type.endpoint = {

    grant_type:     { type: 'string', required: true },
    client_id:      { type: 'string', required: true },
    client_secret:  { type: 'string', empty: true },
    refresh_token:  { type: 'string' },

    x_user_id:      { type: 'string' },
    x_email_token:  { type: 'string' }
};

exports.type.client = {

    name:           { type: 'string' },
    secret:         { type: 'string', hide: true },
    scope:          { type: 'object', hide: true }
};


// Get session token

exports.token = function (req, reply) {

    exports.loadClient(req.hapi.payload.client_id, function (client, err) {

        if (client) {

            // Check client secret

            if ((client.secret || '') === (req.hapi.payload.client_secret || '')) {

                // Switch on grant type

                switch (req.hapi.payload.grant_type) {

                    case 'client_credentials':

                        // Client credentials (no user context)

                        getOrCreate(null, client);
                        break;

                    case 'refresh_token':

                        // Refresh token

                        if (req.hapi.payload.refresh_token) {

                            var refresh = Hapi.Utils.decrypt(Vault.oauthRefresh.aes256Key, req.hapi.payload.refresh_token);
                            if (refresh &&
                                refresh.user &&
                                refresh.client) {

                                if (refresh.client === client._id) {

                                    User.load(refresh.user, function (user, err) {

                                        if (user) {

                                            getOrCreate(user, client);
                                        }
                                        else {

                                            reply(err);
                                        }
                                    });
                                }
                                else {

                                    reply(Hapi.Error.oauth('invalid_grant', 'Mismatching refresh token client id'));
                                }
                            }
                            else {

                                reply(Hapi.Error.oauth('invalid_grant', 'Invalid refresh token'));
                            }
                        }
                        else {

                            reply(Hapi.Error.oauth('invalid_request', 'Missing refresh_token'));
                        }

                        break;

                    case 'http://ns.postmile.net/project':

                        // Check if client has 'login' scope

                        if ((client.scope && client.scope.login === true) ||
                            (req.hapi.scope && req.hapi.scope.login === true)) {

                            // Get user

                            User.load(req.hapi.payload.x_user_id, function (user, err) {

                                if (user) {

                                    getOrCreate(user, client);
                                }
                                else {

                                    // Unknown local account
                                    reply(Hapi.Error.oauth('invalid_grant', 'Unknown local account'));
                                }
                            });
                        }
                        else {

                            // No client scope for local account access
                            reply(Hapi.Error.oauth('unauthorized_client', 'Client missing \'login\' scope'));
                        }

                        break;

                    case 'http://ns.postmile.net/twitter':

                        // Check if client has 'login' scope

                        if ((client.scope && client.scope.login === true) ||
                            (req.hapi.scope && req.hapi.scope.login === true)) {

                            // Check Twitter identifier

                            User.validate(req.hapi.payload.x_user_id, 'twitter', function (user, err) {

                                if (user) {

                                    getOrCreate(user, client);
                                }
                                else {

                                    // Unregistered Twitter account
                                    reply(Hapi.Error.oauth('invalid_grant', 'Unknown Twitter account: ' + req.hapi.payload.x_user_id));
                                }
                            });
                        }
                        else {

                            // No client scope for Twitter access
                            reply(Hapi.Error.oauth('unauthorized_client', 'Client missing \'login\' scope'));
                        }

                        break;

                    case 'http://ns.postmile.net/facebook':

                        // Check if client has 'login' scope

                        if ((client.scope && client.scope.login === true) ||
                            (req.hapi.scope && req.hapi.scope.login === true)) {

                            // Check Facebook identifier

                            User.validate(req.hapi.payload.x_user_id, 'facebook', function (user, err) {

                                if (user) {

                                    getOrCreate(user, client);
                                }
                                else {

                                    // Unregistered Facebook account
                                    reply(Hapi.Error.oauth('invalid_grant', 'Unknown Facebook account: ' + req.hapi.payload.x_user_id));
                                }
                            });
                        }
                        else {

                            // No client scope for Facebook access
                            reply(Hapi.Error.oauth('unauthorized_client', 'Client missing \'login\' scope'));
                        }

                        break;

                    case 'http://ns.postmile.net/yahoo':

                        // Check if client has 'login' scope

                        if ((client.scope && client.scope.login === true) ||
                            (req.hapi.scope && req.hapi.scope.login === true)) {

                            // Check Yahoo identifier

                            User.validate(req.hapi.payload.x_user_id, 'yahoo', function (user, err) {

                                if (user) {

                                    getOrCreate(user, client);
                                }
                                else {

                                    // Unregistered Yahoo account
                                    reply(Hapi.Error.oauth('invalid_grant', 'Unknown Yahoo! account: ' + req.hapi.payload.x_user_id));
                                }
                            });
                        }
                        else {

                            // No client scope for Yahoo access
                            reply(Hapi.Error.oauth('unauthorized_client', 'Client missing \'login\' scope'));
                        }

                        break;

                    case 'http://ns.postmile.net/email':

                        // Check if client has 'login' scope

                        if ((client.scope && client.scope.login === true) ||
                            (req.hapi.scope && req.hapi.scope.login === true)) {

                            // Check email identifier

                            Email.loadTicket(req.hapi.payload.x_email_token, function (ticket, user, err) {

                                if (ticket) {

                                    getOrCreate(user, client, ticket.action);
                                }
                                else {

                                    // Invalid email token
                                    reply(Hapi.Error.oauth('invalid_grant', err.message));
                                }
                            });
                        }
                        else {

                            // No client scope for email access
                            reply(Hapi.Error.oauth('unauthorized_client', 'Client missing \'login\' scope'));
                        }

                        break;

                    default:

                        // Unsupported grant type
                        reply(Hapi.Error.oauth('unsupported_grant_type', 'Unknown or unsupported grant type'));
                        break;
                }
            }
            else {

                // Bad client authentication
                reply(Hapi.Error.oauth('invalid_client', 'Invalid client identifier or secret'));
            }
        }
        else {

            // Unknown client
            reply(Hapi.Error.oauth('invalid_client', 'Invalid client identifier or secret'));
        }
    });

    function getOrCreate(user, client, action) {

        if (user === null ||
            (client.scope && client.scope.authorized === true) ||
            (req.hapi.scope && req.hapi.scope.authorized === true)) {

            // Client has static authorization

            issue();
        }
        else {

            // Lookup authorization

            Db.query('grant', { user: user._id, client: client._id }, function (items, err) {

                if (err === null) {

                    if (items &&
                        items.length > 0) {

                        items.sort(function (a, b) {

                            if (a.expiration < b.expiration) {

                                return -1;
                            }

                            if (a.expiration > b.expiration) {

                                return 1;
                            }

                            return 0;
                        });

                        var isAuthorized = false;
                        var now = Hapi.Utils.getTimestamp();

                        var expired = [];
                        for (var i = 0, il = items.length; i < il; ++i) {

                            if ((items[i].expiration || 0) <= now) {

                                expired.push(items[i]._id);
                            }
                            else {

                                isAuthorized = true;
                            }
                        }

                        if (expired.length > 0) {

                            Db.removeMany('grant', expired, function (err) {

                                // Ignore callback

                                if (err) {

                                    Hapi.Log.err(err);
                                }
                            });
                        }

                        if (isAuthorized) {

                            issue();
                        }
                        else {

                            reply(Hapi.Error.oauth('invalid_grant', 'Client authorization expired'));
                        }
                    }
                    else {

                        reply(Hapi.Error.oauth('invalid_grant', 'Client is not authorized'));
                    }
                }
                else {

                    reply(Hapi.Error.oauth('server_error', 'Failed retrieving authorization'));
                }
            });
        }

        function issue() {

            // Issue a new token

            // Todo: Check is client has authorization to request a token
            // Todo: Set max expiration based on authorization, make short lived

            var token = {

                key: Hapi.Utils.getRandomString(32),
                algorithm: internals.defaultAlgorithm,
                client: client._id,
                scope: client.scope,
                expiration: Hapi.Utils.getTimestamp() + (internals.tokenLifetimeSec * 1000)
            };

            if (user) {

                token.user = user._id;
                token.tos = internals.getLatestTOS(user);
            }

            var response = {

                access_token: Hapi.Utils.encrypt(Vault.oauthToken.aes256Key, token),
                token_type: 'mac',
                mac_key: token.key,
                mac_algorithm: token.algorithm,
                expires_in: internals.tokenLifetimeSec,
                x_tos: token.tos,
                x_action: action
            };

            if (user) {

                response.refresh_token = Hapi.Utils.encrypt(Vault.oauthRefresh.aes256Key, { user: user._id, client: client._id });
            }

            reply(response);
        }
    }
};


// Get client information

exports.client = function (req, reply) {

    exports.loadClient(req.params.id, function (client, err) {

        if (err === null) {

            if (client) {

                Hapi.Utils.hide(client, exports.type.client);
                reply(client);
            }
            else {

                reply(Hapi.Error.notFound());
            }
        }
        else {

            reply(err);
        }
    });
};


// Get session token

exports.load = function (token, callback) {

    if (token) {

        var session = Hapi.Utils.decrypt(Vault.oauthToken.aes256Key, token);
        if (session) {

            if (session.expiration &&
                session.expiration > Hapi.Utils.getTimestamp()) {

                // TODO: check against grant database to make sure underlying grant still valid

                session.id = token;
                callback(session);
            }
            else {

                // Expired
                callback(null);
            }
        }
        else {

            // Invalid
            callback(null);
        }
    }
    else {

        // Empty
        callback(null);
    }
};


// Get client

exports.loadClient = function (id, callback) {

    Db.queryUnique('client', { name: id }, function (client, err) {

        if (client) {

            callback(client, null);
        }
        else {

            if (err === null) {

                callback(null, null);
            }
            else {

                callback(null, err);
            }
        }
    });
};


// Validate message

exports.validate = function (message, token, mac, callback) {

    exports.load(token, function (session) {

        if (session &&
            session.algorithm &&
            session.key &&
            session.user) {

            // Lookup hash function

            var hashMethod = null;
            switch (session.algorithm) {

                case 'hmac-sha-1': hashMethod = 'sha1'; break;
                case 'hmac-sha-256': hashMethod = 'sha256'; break;
            }

            if (hashMethod) {

                // Sign message

                var hmac = Crypto.createHmac(hashMethod, session.key).update(message);
                var digest = hmac.digest('base64');

                if (digest === mac) {

                    callback(session.user, null);
                }
                else {

                    // Invalid signature
                    callback(null, Hapi.Error.unauthorized('Invalid mac'));
                }
            }
            else {

                // Invalid algorithm
                callback(null, Hapi.Error.internal('Unknown algorithm'));
            }
        }
        else {

            // Invalid token
            callback(null, Hapi.Error.notFound('Invalid token'));
        }
    });
};


// Find latest accepted TOS

internals.getLatestTOS = function (user) {

    if (user &&
        user.tos &&
        typeof user.tos === 'object') {

        var versions = Object.keys(user.tos);
        if (versions.length > 0) {

            versions.sort();
            return versions[versions.length - 1];
        }
    }

    return 0;
};


// Compare scopes

internals.compareScope = function (a, b) {

    a = a || null;
    b = b || null;

    if (a === null && b === null) {

        return true;
    }

    if ((a === null && b !== null) ||
        (a !== null && b === null)) {

        return false;
    }

    if (Object.keys(a).length !== Object.keys(b).length) {

        return false;
    }

    for (var i in a) {

        if (a.hasOwnProperty(i)) {

            if (a[i] !== b[i]) {

                return false;
            }
        }
    }

    return true;
};


// Remove all user grants

exports.delUser = function (userId, callback) {

    callback(null);
};



