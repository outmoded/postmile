// Load modules

var Request = require('request');
var Oz = require('oz');
var Client = require('./client');
var Utils = require('./utils');
var Config = require('./config');


// Make API call w/ client token

exports.clientCall = function (method, path, body, callback) {

    Client.getTicket(function (ticket) {

        exports.call(method, path, body, ticket, function (err, code, payload) {

            if (code !== 401) {
                return callback(err, code, payload);
            }

            // Try getting a new client session token

            Client.refreshTicket(function (ticket) {

                exports.call(method, path, body, ticket, callback);
            });
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
            return callback(new Error('Failed sending API server request: ' + err.message));
        }

        var payload = null;
        try {
            payload = JSON.parse(body);
        }
        catch (e) {
            return callback(new Error('Invalid response body from API server: ' + response + '(' + e + ')'));
        }

        return callback(null, response.statusCode, payload);
    });
};



