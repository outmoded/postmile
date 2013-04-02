// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var Utils = require('./utils');


// Initialize database connection

Db.initialize(true, function (err) {

    if (err) {

        // Database connection failed

        console.log(err);
        process.exit(1);
    }

    console.log('Database initialized');

    // Create required clients

    var clients = [
        {
            name: 'postmile.web',
            scope: ['authorized', 'login', 'reminder', 'signup', 'tos'],
            secret: Utils.getRandomString(64)
        },
        {
            name: 'postmile.view',
            scope: []
        }
    ];

    Db.insert('client', clients, function (err, items) {

        if (err) {
            console.log(err);
            process.exit(1);
        }

        // Add public invite to disable invitations

        Db.insert('invite', { code: 'public' }, function (err, items) {

            if (err) {
                console.log(err);
                process.exit(1);
            }

            console.log('Initial dataset created successfully');
            console.log('>>>>> WEB client id: ' + clients[0]._id);
            console.log('>>>>> WEB client secret: ' + clients[0].secret);
            console.log('>>>>> VIEW client id: ' + clients[1]._id);
            process.exit(0);
        });
    });
});


