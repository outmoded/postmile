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


// Declare internals

var internals = {};


// Create and configure server instance

exports.create = function (paths, onInitialized) {

    var server = Hapi.Server.create(paths, internals.convertConfig());

    // Initialize database connection

    Db.initialize(function (err) {

        if (err === null) {

            if (onInitialized) {

                onInitialized(server);
            }

            // Start Server

            Hapi.Server.start(server);
            Stream.initialize(server);
        }
        else {

            // Database connection failed

            Hapi.Log.err(err);
            process.exit(1);
        }
    });
};


// Convert project configuration to Hapi format

internals.convertConfig = function () {

    var config = {

        name: Config.product.name + ' API Server',
        uri: Config.host.uri('api'),
        process: Config.process.api,
        email: Config.email,

        // Terms of Service

        tos: {

            min: '20110623'
        },

        // Authentication

        authentication: {

            loadSession: Session.load
        }
    };

    return config;
};


