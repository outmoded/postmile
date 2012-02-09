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


// Declare internals

var internals = {};


// Create and configure server instance

Hapi.Process.initialize({

    name: Config.product.name + ' API Server',
    process: Config.process.api,
    email: Config.email
});

var configuration = {

    uri: Config.host.uri('api'),

    // Terms of Service

    tos: {

        min: '20110623'
    },

    // Authentication

    authentication: {

        loadSession: Session.load
    }
};

var server = Hapi.Server.create(configuration, Routes.endpoints);

// Initialize database connection

Db.initialize(function (err) {

    if (err === null) {

        // Load in-memory cache

        Suggestions.initialize();
        Tips.initialize();

        // Start Server

        server.start();
        Stream.initialize(server.getExpress());
        Hapi.Process.finalize();
    }
    else {

        // Database connection failed

        Hapi.Log.err(err);
        process.exit(1);
    }
});

