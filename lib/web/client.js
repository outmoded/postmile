// Load modules

var Request = require('request');
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

    var options = {
        uri: 'http://' + Config.host.api.domain + ':' + Config.host.api.port + '/oz/app',
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + (new Buffer(Vault.postmileAPI.clientId + ':' + Vault.postmileAPI.clientSecret, 'ascii')).toString('base64')
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


