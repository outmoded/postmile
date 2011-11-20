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

        callback(internals.clientToken);
    }
    else {

        var tokenRequest = {
            grant_type: 'client_credentials',
            client_id: Vault.postmileAPI.clientId,
            client_secret: Vault.postmileAPI.clientSecret
        };

        Api.call('POST', '/oauth/token', tokenRequest, function (token, err, code) {

            if (token) {

                // { access_token: '', token_type: '', mac_key: '', mac_algorithm: '' }

                if (token.access_token &&
                    token.mac_key &&
                    token.mac_algorithm) {

                    internals.clientToken = { id: token.access_token, key: token.mac_key, algorithm: token.mac_algorithm };
                }
            }

            callback(internals.clientToken);
        });
    }
};


// Refresh client session token

exports.refreshToken = function (callback) {

    internals.clientToken = null;
    exports.getToken(callback);
};
