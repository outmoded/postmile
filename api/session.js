/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Hapi = require('hapi');
var Oz = require('oz');
var Crypto = require('crypto');
var Db = require('./db');
var User = require('./user');
var Email = require('./email');
var Vault = require('./vault');


// Declare internals

var internals = {};


// Get application information endpoint

exports.app = {
    auth: {
        scope: 'login',
        entity: 'app'
    },
    handler: function (request) {

        Db.queryUnique('client', { name: request.params.id }, function (client, err) {

            if (err) {
                return request.reply(err);
            }

            if (!client) {
                return request.reply(Hapi.Error.notFound());
            }

            Hapi.Utils.removeKeys(client, ['secret', 'scope']);
            return request.reply(client);
        });
    }
};


exports.login = {
    validate: {
        schema: {
            type: Hapi.types.String().valid('id', 'twitter', 'facebook', 'yahoo', 'email').required(),
            id: Hapi.types.String().required(),
            issueTo: Hapi.types.String()
        }
    },
    auth: {
        scope: 'login',
        entity: 'app'
    },
    handler: function (request) {

        var type = request.payload.type;
        var id = request.payload.id;

        var loadUser = function () {

            if (type === 'id') {

                User.load(id, function (user, err) {

                    if (err) {
                        return request.reply(Hapi.Error.unauthorized(err.message));
                    }

                    loadGrant(user);
                });
            }
            else if (type === 'email') {

                Email.loadTicket(id, function (emailTicket, user, err) {

                    if (err) {
                        return request.reply(Hapi.Error.unauthorized(err.message));
                    }

                    loadGrant(user, { 'action': emailTicket.action });
                });
            }
            else {
                
                // twitter, facebook, yahoo

                User.validate(id, type, function (err, user) {

                    if (err || !user) {
                        return request.reply(Hapi.Error.unauthorized());
                    }

                    loadGrant(user);
                });
            }
        };

        var loadGrant = function (user, ext) {

            // Lookup existing grant

            var now = Date.now();

            var appId = request.payload.issueTo || request.session.app;
            Db.query('grant', { user: user.id, app: appId }, function (items, err) {

                if (err) {
                    return request.reply(err);
                }

                if (items &&
                    items.length > 0) {

                    items.sort(function (a, b) {

                        if (a.exp < b.exp) {
                            return -1;
                        }

                        if (a.exp > b.exp) {
                            return 1;
                        }

                        return 0;
                    });

                    var grant = null;

                    var expired = [];
                    for (var i = 0, il = items.length; i < il; ++i) {
                        if ((items[i].exp || 0) <= now) {
                            expired.push(items[i]._id);
                        }
                        else {
                            grant = items[i];
                        }
                    }

                    if (expired.length > 0) {
                        Db.removeMany('grant', expired, function (err) { });         // Ignore callback
                    }

                    if (grant) {
                        return issue(appId, grant._id, ext);
                    }
                }

                // No active grant

                var newGrant = {
                    user: user._id,
                    app: appId,
                    exp: now + 30 * 24 * 60 * 60 * 1000,                        // 30 days //////////////////
                    scope: []                                                   // Find app scope ////////////
                };

                Db.insert('grant', newGrant, function (items, err) {

                    if (err) {
                        return request.reply(err);
                    }

                    if (items.length !== 1 ||
                        !items[0]._id) {

                        return request.reply(Hapi.Error.internal('Failed to add new grant'));
                    }

                    return issue(appId, items[0]._id, ext);
                });
            });
        };

        var issue = function (appId, grantId, ext) {

            Oz.rsvp.issue({ id: appId }, { id: grantId }, Vault.ozTicket.password, function (err, rsvp) {

                if (err) {
                    return request.reply(Hapi.Error.internal('Failed generating rsvp: ' + err));
                }

                var response = {
                    rsvp: rsvp
                };

                if (ext) {
                    response.ext = ext;
                }

                return request.reply(response);
            });
        };

        loadUser();
    }
};


exports.loadApp = function (id, callback) {

    if (!id) {
        return callback();
    }

    Db.get('client', id, function (client, err) {

        if (err || !client) {
            return callback();
        }

        var app = {
            id: client._id,
            secret: client.secret,
            scope: client.scope
        };

        return callback(app);
    });
};


exports.loadGrant = function (grantId, callback) {

    Db.get('grant', grantId, function (item, err) {

        // Verify grant is still valid

        if (err || !item) {
            return callback();
        }

        User.load(item.user, function (user, err) {

            if (err || !user) {
                callback();
            }

            var result = {
                id: item._id,
                app: item.app,
                user: item.user,
                exp: item.exp,
                scope: item.scope
            };

            var ext = {
                tos: internals.getLatestTOS(user)
            };

            return callback(result, ext);
        });
    });
};


// Validate message

exports.validate = function (message, ticket, mac, callback) {

    Oz.Ticket.parse(ticket, Vault.ozTicket.password, function (err, session) {

        if (err || !session) {
            return callback(null, Hapi.Error.notFound('Invalid ticket'));
        }

        // Mac message

        var hmac = Crypto.createHmac(session.algorithm, session.key).update(message);
        var digest = hmac.digest('base64');
        if (digest !== mac) {
            return callback(null, Hapi.Error.unauthorized('Invalid mac'));
        }
        
        return callback(session.user, null);
    });
};


// Remove all user grants

exports.delUser = function (userId, callback) {

    callback(null);
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

