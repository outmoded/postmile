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

var internals = {};


// Session definitions

exports.type = {};

exports.type.client = {

    name:           { type: 'string' },
    secret:         { type: 'string', hide: true },
    scope:          { type: 'object', hide: true }
};


// Get client information endpoint

exports.client = function (request, reply) {

    exports.loadClient(request.params.id, function (client, err) {

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


// Get user authentication information

exports.loadUser = function (id, callback) {

    User.load(id, function (user, err) {

        if (user) {

            callback(user);
        }
        else {

            callback(err);
        }
    });
};


// Check client authorization grant

exports.checkAuthorization = function (userId, clientId, callback) {

    Db.query('grant', { user: userId, client: clientId }, function (items, err) {

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

                    callback(null);
                }
                else {

                    callback(Hapi.Error.oauth('invalid_grant', 'Client authorization expired'));
                }
            }
            else {

                callback(Hapi.Error.oauth('invalid_grant', 'Client is not authorized'));
            }
        }
        else {

            callback(Hapi.Error.oauth('server_error', 'Failed retrieving authorization'));
        }
    });
};


// Extension OAuth grant types

exports.extensionGrant = function (request, client, callback) {

    // Verify grant type prefix

    if (request.payload.grant_type.search('http://ns.postmile.net/') !== 0) {

        // Unsupported grant type namespace
        reply(Hapi.Error.oauth('unsupported_grant_type', 'Unknown or unsupported grant type namespace'));
    }

    var grantType = request.payload.grant_type.replace('http://ns.postmile.net/', '');

    // Check if client has 'login' scope

    if ((client.scope && client.scope.login === true) ||
        (request.scope && request.scope.login === true)) {

        // Switch on grant type

        if (grantType === 'id') {

            // Get user

            User.load(request.payload.x_user_id, function (user, err) {

                if (user) {

                    callback(user, null);
                }
                else {

                    // Unknown local account
                    callback(null, Hapi.Error.oauth('invalid_grant', 'Unknown local account'));
                }
            });
        }
        else if (grantType === 'twitter' ||
                 grantType === 'facebook' ||
                 grantType === 'yahoo') {

            // Check network identifier

            User.validate(request.payload.x_user_id, grantType, function (user, err) {

                if (user) {

                    callback(user, null);
                }
                else {

                    // Unregistered network account
                    callback(null, Hapi.Error.oauth('invalid_grant', 'Unknown ' + grantType.charAt(0).toUpperCase() + grantType.slice(1) + ' account: ' + request.payload.x_user_id));
                }
            });
        }
        else if (grantType === 'email') {

            // Check email identifier

            Email.loadTicket(request.payload.x_email_token, function (ticket, user, err) {

                if (ticket) {

                    callback(user, null, { 'x_action': ticket.action });
                }
                else {

                    // Invalid email token
                    callback(null, Hapi.Error.oauth('invalid_grant', err.message));
                }
            });
        }
        else {

            // Unsupported grant type
            callback(null, Hapi.Error.oauth('unsupported_grant_type', 'Unknown or unsupported grant type: ' + grantType));
        }
    }
    else {

        // No client scope for local account access
        callback(null, Hapi.Error.oauth('unauthorized_client', 'Client missing \'login\' scope'));
    }
};


// Validate message

exports.validate = function (message, token, mac, callback) {

    Hapi.Session.loadToken(Vault.oauthToken.aes256Key, token, function (session) {

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


// Remove all user grants

exports.delUser = function (userId, callback) {

    callback(null);
};



