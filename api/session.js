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


// Get client information endpoint

exports.client = {
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


// Get client

exports.getOzClient = function (id, callback) {

    Db.get('client', id, function (client, err) {

        if (err || !client) {
            return callback(err);
        }

        var result = {
            id: client._id,
            secret: client.secret,
            scope: client.scope
        };

        return callback(null, result);
    });
};


// Check client authorization grant

exports.checkAuthorization = function (session, client, user, callback) {

    // Pre-authorized client

    if (client.scope && client.scope.indexOf('authorized') !== -1 ||
        session.scope && session.scope.indexOf('authorized') !== -1) {

        var rsvp = exports.encrypt(Vault.oauthRefresh.aes256Key, { user: user.id, app: client.id })
        return callback(null, rsvp);
    }

    // User authorization

    Db.query('grant', { user: user.id, client: client.id }, function (items, err) {

        if (err) {
            return callback(Hapi.Session.error('server_error', 'Failed retrieving authorization'));
        }

        if (!items ||
            items.length <= 0) {

            return callback(Hapi.Session.error('invalid_grant', 'Client is not authorized'));
        }

        items.sort(function (a, b) {

            if (a.expiration < b.expiration) {
                return -1;
            }

            if (a.expiration > b.expiration) {
                return 1;
            }

            return 0;
        });

        var authorization = null;
        var now = Date.now();

        var expired = [];
        for (var i = 0, il = items.length; i < il; ++i) {
            if ((items[i].expiration || 0) <= now) {
                expired.push(items[i]._id);
            }
            else {
                authorization = items[i]._id;
            }
        }

        if (expired.length > 0) {
            Db.removeMany('grant', expired, function (err) { });         // Ignore callback
        }

        if (!authorization) {
            return callback(Hapi.Session.error('invalid_grant', 'Client authorization expired'));
        }

        var rsvp = exports.encrypt(Vault.oauthRefresh.aes256Key, { user: user.id, app: client.id })
        return callback(null, rsvp);
    });
};


// Validate RSVP

exports.checkRsvp = function (app, rsvp, callback) {

    var auth = exports.decrypt(Vault.oauthRefresh.aes256Key, rsvp);
    if (!auth ||
        !auth.user ||
        !auth.app) {

        return callback(Hapi.Session.error('invalid_grant', 'Invalid rsvp token'));
    }

    if (auth.app !== app.id) {
        return callback(Hapi.Session.error('invalid_grant', 'Mismatching rsvp token application id'));
    }

    User.load(auth.user, function (user, err) {

        if (err || !user) {
            return callback(Hapi.Session.error('invalid_grant', 'Cannot find user'));
        }

        return callback(null, internals.ozify(user));
    });
};


// Extension OAuth grant types

exports.extensionGrant = function (request, client, callback) {

    // Verify grant type prefix

    if (request.payload.grant_type.search('http://ns.postmile.net/') !== 0) {
        // Unsupported grant type namespace
        return callback(Hapi.Session.error('unsupported_grant_type', 'Unknown or unsupported grant type namespace'));
    }

    // Check if client has 'login' scope

    if ((!client.scope || client.scope.indexOf('login' === -1)) &&
        (!request.session || !request.session.scope || request.session.scope.indexOf('login') === -1)) {

        // No client scope for local account access
        return callback(Hapi.Session.error('unauthorized_client', 'Client missing \'login\' scope'));
    }

    // Switch on grant type

    var grantType = request.payload.grant_type.replace('http://ns.postmile.net/', '');
    if (grantType === 'id') {

        // Get user

        User.load(request.payload.x_user_id, function (user, err) {

            if (!user) {
                // Unknown local account
                return callback(Hapi.Session.error('invalid_grant', 'Unknown local account'));
            }

            return callback(null, internals.ozify(user));
        });
    }
    else if (grantType === 'twitter' ||
             grantType === 'facebook' ||
             grantType === 'yahoo') {

        // Check network identifier

        User.validate(request.payload.x_user_id, grantType, function (user, err) {

            if (!user) {
                // Unregistered network account
                return callback(Hapi.Session.error('invalid_grant', 'Unknown ' + grantType.charAt(0).toUpperCase() + grantType.slice(1) + ' account: ' + request.payload.x_user_id));
            }

            return callback(null, internals.ozify(user));
        });
    }
    else if (grantType === 'email') {

        // Check email identifier

        Email.loadTicket(request.payload.x_email_token, function (ticket, user, err) {

            if (!ticket) {
                // Invalid email token
                return callback(Hapi.Session.error('invalid_grant', err.message));
            }

            return callback(null, internals.ozify(user), { 'x_action': ticket.action });
        });
    }
    else {
        // Unsupported grant type
        return callback(Hapi.Session.error('unsupported_grant_type', 'Unknown or unsupported grant type: ' + grantType));
    }
};


// Validate message

exports.validate = function (message, token, mac, callback) {

    Hapi.Session.parseTicket(token, function (err, session) {

        if (err || !session) {
            return callback(null, Hapi.Error.notFound('Invalid token'));
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


// AES256 Symmetric encryption

exports.encrypt = function (key, value) {

    var envelope = JSON.stringify({ v: value, a: exports.getRandomString(2) });

    var cipher = Crypto.createCipher('aes256', key);
    var enc = cipher.update(envelope, 'utf8', 'binary');
    enc += cipher.final('binary');

    var result = (new Buffer(enc, 'binary')).toString('base64').replace(/\+/g, '-').replace(/\//g, ':').replace(/\=/g, '');
    return result;
};


exports.decrypt = function (key, value) {

    var input = (new Buffer(value.replace(/-/g, '+').replace(/:/g, '/'), 'base64')).toString('binary');

    var decipher = Crypto.createDecipher('aes256', key);
    var dec = decipher.update(input, 'binary', 'utf8');
    dec += decipher.final('utf8');

    var envelope = null;

    try {
        envelope = JSON.parse(dec);
    }
    catch (e) {
        Log.event('err', 'Invalid encrypted envelope: ' + dec + ' / Exception: ' + JSON.stringify(e));
    }

    return envelope ? envelope.v : null;
};


// Random string

exports.getRandomString = function (size) {

    var randomSource = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var len = randomSource.length;
    size = size || 10;

    if (typeof size === 'number' &&
        !isNaN(size) && size >= 0 &&
        (parseFloat(size) === parseInt(size))) {

        var result = [];

        for (var i = 0; i < size; ++i) {
            result[i] = randomSource[Math.floor(Math.random() * len)];
        }

        return result.join('');
    }
    else {
        return null;
    }
};


// Convert user object to Oz structure

internals.ozify = function (user) {

    var ozUser = {
        id: user._id,
        tos: user.tos
    };

    return ozUser;
};


