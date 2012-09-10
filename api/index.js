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

internals.onPostHandler = function (request, next) {

    if (request.response &&
        request.response.result) {

        var result = request.response.result;

        // Sanitize database fields

        if (result._id) {

            result.id = result._id;
            delete result._id;
        }

        if (result instanceof Object) {

            for (var i in result) {

                if (result.hasOwnProperty(i)) {

                    if (i[0] === '_') {

                        delete result[i];
                    }
                }
            }
        }
    }

    next();
};


// Catch uncaught exceptions

process.on('uncaughtException', function (err) {
    Hapi.Utils.abort('Uncaught exception: ' + err.stack);
});


var configuration = {

    name: 'http',

    // Extension points

    ext: {
        onPostHandler: internals.onPostHandler
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
        },
        tos: {
            min: '20110623'
        }
    },

    debug: true
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

