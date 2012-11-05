/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Request = require('request');
var Oz = require('oz');
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

    var headers = {};

    if (session) {
        var request = {
            method: method,
            resource: path,
            host: Config.host.api.domain,
            port: Config.host.api.port
        };

        headers['Authorization'] = Oz.Request.generateHeader(request, session);
    }
    
    var options = {
        uri: 'http://' + Config.host.api.domain + ':' +  Config.host.api.port + path,
        method: method,
        headers: headers,
        body: body
    };

    Request(options, function (err, response, body) {

        if (err) {
            return callback(null, 'Failed sending API server request: ' + err, 0);
        }

        var data = null;
        try {
            data = JSON.parse(body);
        }
        catch (e) {
            return callback(null, 'Invalid response body from API server: ' + response + '(' + e + ')', 0);
        }

        if (response.statusCode !== 200) {
            return callback(null, data, response.statusCode);
        }
        
        return callback(data, null, 200);
    });
};



