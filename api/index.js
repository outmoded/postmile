/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var Stream = require('./stream');
var Config = require('./config');
var Session = require('./session');
var Routes = require('./routes');
var Suggestions = require('./suggestions');
var Tips = require('./tips');
var Vault = require('./vault');


// Declare internals

var internals = {};


// Post handler extension middleware

internals.formatPayload = function (payload) {

    if (typeof payload !== 'object' ||
        payload instanceof Array) {

        return payload;
    }

    // Sanitize database fields

    if (payload._id) {
        payload.id = payload._id;
        delete payload._id;
    }

    for (var i in payload) {
        if (payload.hasOwnProperty(i)) {
            if (i[0] === '_') {
                delete payload[i];
            }
        }
    }

    return payload;
};


// Catch uncaught exceptions

process.on('uncaughtException', function (err) {
    Hapi.Utils.abort('Uncaught exception: ' + err.stack);
});


var configuration = {

    name: 'http',

    // Formatter

    format: {
        payload: internals.formatPayload
    },

    // Authentication

    auth: {
        scheme: 'oz',
        encryptionPassword: Vault.ozTicket.password,

        loadAppFunc: Session.loadApp,
        loadGrantFunc: Session.loadGrant,
        tos: 20110623
    },

    debug: true,
    monitor: true
};

var server = new Hapi.Server(Config.host.api.domain, Config.host.api.port, configuration);
server.addRoutes(Routes.endpoints);

// Initialize database connection

Db.initialize(function (err) {

    if (err === null) {

        // Load in-memory cache

        Suggestions.initialize();
        Tips.initialize();

        // Start Server

        server.start();
        Stream.initialize(server.listener);
    }
    else {

        // Database connection failed

        Hapi.Log.event('err', err);
        process.exit(1);
    }
});

