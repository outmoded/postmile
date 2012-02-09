// Load modules

var Hapi = require('hapi');
var Db = require('./db');


// Initialize database connection

Db.initialize(true, function (err) {

    if (err === null) {

        Hapi.Log.info('Database initialized');

        // Create required clients

        var clients = [

            {
                name: 'postmile.web',
                scope: { authorized: true, login: true, reminder: true, signup: true, tos: true },
                secret: Hapi.Utils.getRandomString(64)
            },

            {
                name: 'postmile.view',
                scope: {}
            }
        ];

        Db.insert('client', clients, function (items, err) {

            if (err === null) {

                // Add public invite to disable invitations

                Db.insert('invite', { code: 'public' }, function (items, err) {

                    if (err === null) {

                        Hapi.Log.info('Initial dataset created successfully');
                        Hapi.Log.info('>>>>> postmile.web client secret: ' + clients[0].secret);
                        process.exit(0);
                    }
                    else {

                        Hapi.Log.err(err);
                        process.exit(1);
                    }
                });
            }
            else {

                Hapi.Log.err(err);
                process.exit(1);
            }
        });
    }
    else {

        // Database connection failed

        Hapi.Log.err(err);
        process.exit(1);
    }
});


