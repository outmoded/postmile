// Load modules

var Request = require('request');
var Oz = require('oz');
var Vault = require('./vault');
var Config = require('./config');


// Declare internals

var internals = {
    ticket: null
};


// Obtain client session token

exports.getTicket = function (callback) {

    if (internals.ticket) {
        return callback(internals.ticket);
    }

    var uri = 'http://' + Config.host.api.domain + ':' + Config.host.api.port + '/oz/app';
    var options = {
        uri: uri,
        method: 'POST',
        headers: {
            Authorization: Oz.client.header(uri, 'POST', Vault.apiClient).field
        },
        json: true
    };

    Request(options, function (err, response, body) {

        if (err ||
            response.statusCode !== 200 ||
            !body) {

            return callback();
        }

        internals.ticket = body;
        return callback(internals.ticket);
    });
};


// Refresh client session token

exports.refreshTicket = function (callback) {

    internals.ticket = null;
    exports.getTicket(callback);
};


