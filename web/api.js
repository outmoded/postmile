/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Http = require('http');
var MAC = require('mac');
var Client = require('./client');
var Utils = require('./utils');
var Config = require('./config');


// Make API call w/ client token

exports.clientCall = function (method, path, body, callback) {

    Client.getToken(function (clientToken) {

        exports.call(method, path, body, clientToken, function (data, err, code) {

            if (code !== 401) {

                callback(data, err, code);
            }
            else {

                // Try getting a new client session token

                Client.refreshToken(function (clientToken) {

                    exports.call(method, path, body, clientToken, callback);
                });
            }
        });
    });
};


// Make API call

exports.call = function (method, path, body, arg1, arg2) {   // session, callback

    var callback = arg2 || arg1;
    var session = (arg2 ? arg1 : null);
    body = (body !== null ? JSON.stringify(body) : null);

    var authorization = null;
    var isValid = true;

    if (session) {

        authorization = MAC.getAuthorizationHeader(method, path, Config.host.api.domain, Config.host.api.port, session);

        if (authorization === '') {

            callback(null, 'Failed to create authorization header: ' + session, 0);
            isValid = false;
        }
    }

    if (isValid) {

        var hreq = Http.request({ host: Config.host.api.domain, port: Config.host.api.port, path: path, method: method }, function (hres) {

            if (hres) {

                var response = '';

                hres.setEncoding('utf8');
                hres.on('data', function (chunk) {

                    response += chunk;
                });

                hres.on('end', function () {

                    var data = null;
                    var error = null;

                    try {

                        data = JSON.parse(response);
                    }
                    catch (err) {

                        error = 'Invalid response body from API server: ' + response + '(' + err + ')';
                    }

                    if (error) {

                        callback(null, error, 0);
                    }
                    else if (hres.statusCode === 200) {

                        callback(data, null, 200);
                    }
                    else {

                        callback(null, data, hres.statusCode);
                    }
                });
            }
            else {

                callback(null, 'Failed sending API server request', 0);
            }
        });

        hreq.on('error', function (err) {

            callback(null, 'HTTP socket error: ' + JSON.stringify(err), 0);
        });

        if (authorization) {

            hreq.setHeader('Authorization', authorization);
        }

        if (body !== null) {

            hreq.setHeader('Content-Type', 'application/json');
            hreq.write(body);
        }

        hreq.end();
    }
};



