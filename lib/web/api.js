// Load modules

var Request = require('request');
var Oz = require('oz');
var Config = require('./config');
var Vault = require('./vault');


// Declare internals

var internals = {
    ticket: null
};


// Make API call w/ client token

exports.clientCall = function (method, path, body, callback) {

    var getTicket = function (next) {

        if (internals.ticket) {
            return next();
        }

        var uri = 'http://' + Config.host.api.domain + ':' + Config.host.api.port + '/oz/app';
        var header = Oz.client.header(uri, 'POST', Vault.apiClient);
        var options = {
            uri: uri,
            method: 'POST',
            headers: {
                Authorization: header.field
            },
            json: true
        };

        Request(options, function (err, response, body) {

            if (!err &&
                response.statusCode === 200 &&
                body) {

                internals.ticket = body;
            }

            return next();
        });
    };

    getTicket(function () {

        exports.call(method, path, body, internals.ticket, function (err, code, payload) {

            if (code !== 401) {
                return callback(err, code, payload);
            }

            // Try getting a new client session token

            internals.ticket = null;
            getTicket(function () {

                exports.call(method, path, body, internals.ticket, callback);
            });
        });
    });
};


// Make API call

exports.call = function (method, path, body, ticket, callback) {

    body = (body !== null ? JSON.stringify(body) : null);

    var uri = 'http://' + Config.host.api.domain + ':' + Config.host.api.port + path;
    var headers = {};

    if (ticket) {
        var header = Oz.client.header(uri, method, ticket);
        headers.Authorization = header.field;
    }
    
    var options = {
        uri: uri,
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
