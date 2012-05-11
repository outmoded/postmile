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

internals.onPostHandler = function (req, res, next) {

    if (res.hapi.result) {

        // Sanitize database fields

        if (res.hapi.result._id) {

            res.hapi.result.id = res.hapi.result._id;
            delete res.hapi.result._id;
        }

        if (res.hapi.result instanceof Object) {

            for (var i in res.hapi.result) {

                if (res.hapi.result.hasOwnProperty(i)) {

                    if (i[0] === '_') {

                        delete res.hapi.result[i];
                    }
                }
            }
        }
    }

    next();
};


// Create and configure server instance

Hapi.Process.initialize({

    name: Config.product.name + ' API Server',
    process: Config.process.api,
    email: Config.email,
    log: Config.log
});

var configuration = {

    name: 'http',

    // Terms of Service

    tos: {

        min: '20110623'
    },

    // Authentication

    authentication: {

        loadClientFunc: Session.loadClient,
        loadUserFunc: Session.loadUser,
        extensionFunc: Session.extensionGrant,
        checkAuthorizationFunc: Session.checkAuthorization,

        aes256Keys: {

            oauthRefresh: Vault.oauthRefresh.aes256Key,
            oauthToken: Vault.oauthToken.aes256Key
        }
    },

    // Extension points

    ext: {

        onPostHandler: internals.onPostHandler
    }
};

var server = new Hapi.Server.Server(Config.host.api.domain, Config.host.api.port, configuration, Routes.endpoints);


// Initialize database connection

Db.initialize(function (err) {

    if (err === null) {

        // Load in-memory cache

        Suggestions.initialize();
        Tips.initialize();

        // Start Server

        server.start();
        Stream.initialize(server.listener);
        Hapi.Process.finalize();
    }
    else {

        // Database connection failed

        Hapi.Log.err(err);
        process.exit(1);
    }
});

