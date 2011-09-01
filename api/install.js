// Load modules

var Utils = require('./utils');
var Db = require('./db');
var Log = require('./log');


// Initialize database connection

Db.initialize(true, function (err) {

    if (err === null) {

        Log.info('Database initialized');

        // Create required clients

        var clients = [

            {
                name: 'postmile.web',
                scope: { authorized: true, login: true, reminder: true, signup: true, tos: true },
                secret: Utils.getRandomString(64)
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

                        Log.info('Initial dataset created successfully');
                        Log.info('>>>>> postmile.web client secret: ' + clients[0].secret);
                        process.exit(0);
                    }
                    else {

                        Log.err(err);
                        process.exit(1);
                    }
                });
            }
            else {

                Log.err(err);
                process.exit(1);
            }
        });
    }
    else {

        // Database connection failed

        Log.err(err);
        process.exit(1);
    }
});


