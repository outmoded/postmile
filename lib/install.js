// Load modules

var Fs = require('fs');
var Cryptiles = require('cryptiles');
var Db = require('./db');


// Declare internals

var internals = {};


internals.token = function () {

    return Cryptiles.randomBits(256).toString('hex');
};


// Initialize database connection

Db.initialize(true, function (err) {

    if (err) {
        console.error(err);
        process.exit(1);
    }

    console.log('Database initialized');

    // Create secrets

    var vault = {
        emailToken: internals.token(),
        ozTicket: internals.token(),
        yar: internals.token(),
        session: internals.token(),
        apiClient: {
            id: '',
            key: internals.token(),
            algorithm: 'sha256'
        },
        viewClient: {
            id: '',
            key: '',
            algorithm: 'sha256'
        }
    };

    // Create required clients

    var clients = [
        {
            name: 'postmile.web',
            scope: ['authorized', 'login', 'reminder', 'signup', 'tos'],
            key: vault.apiClient.key,
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
            console.error(err);
            process.exit(1);
        }

        // Add public invite to disable invitations

        Db.insert('invite', { code: 'public' }, function (err, items) {

            if (err) {
                console.error(err);
                process.exit(1);
            }

            vault.apiClient.id = clients[0]._id;
            vault.viewClient.id = clients[1]._id;

            Fs.writeFile('./vault.json', JSON.stringify(vault), function (err) {

                if (err) {
                    console.error(err);
                    process.exit(1);
                }

                process.exit(0);
            });
        });
    });
});


