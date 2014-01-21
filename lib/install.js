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
            key: Utils.getRandomString(64),
            algorithm: 'sha256'
        },
        {
            name: 'postmile.view',
            scope: [],
            key: '',
            algorithm: 'sha256'
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
            console.log('>>>>> API client id: ' + clients[0]._id);
            console.log('>>>>> API client key: ' + clients[0].key);
            console.log('>>>>> VIEW client id: ' + clients[1]._id);
            console.log('>>>>> VIEW client key: (leave empty)');
            process.exit(0);
        });
    });
});


