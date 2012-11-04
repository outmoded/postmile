/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Api = require('./api');
var Err = require('./error');
var Vault = require('./vault');


// Declare internals

var internals = {
    clientToken: null
};


// Obtain client session token

exports.getToken = function (callback) {

    if (internals.clientToken) {
        return callback(internals.clientToken);
    }

    var tokenRequest = {
        grant_type: 'client_credentials',
        client_id: Vault.postmileAPI.clientId,
        client_secret: Vault.postmileAPI.clientSecret
    };

    Api.call('POST', '/oauth/token', tokenRequest, function (token, err, code) {

        internals.clientToken = token;
        return callback(internals.clientToken);
    });
};


// Refresh client session token

exports.refreshToken = function (callback) {

    internals.clientToken = null;
    exports.getToken(callback);
};
