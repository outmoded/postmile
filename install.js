// Load modules

var Fs = require('fs');
var Cryptiles = require('cryptiles');
var Async = require('async');
var MongoDB = require('mongodb');
var Config = require('./config');


// Declare internals

var internals = {};


internals.token = function () {

    return Cryptiles.randomBits(256).toString('hex');
};


internals.install = function () {

    var database = new internals.Db();
    database.initialize(function (err) {

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

        database.insert('client', clients, function (err, items) {

            if (err) {
                console.error(err);
                process.exit(1);
            }

            // Add public invite to disable invitations

            database.insert('invite', [{ code: 'public' }], function (err, items) {

                if (err) {
                    console.error(err);
                    process.exit(1);
                }

                vault.apiClient.id = clients[0]._id.toString();
                vault.viewClient.id = clients[1]._id.toString();

                Fs.writeFile('./vault.json', JSON.stringify(vault, null, 4), function (err) {

                    if (err) {
                        console.error(err);
                        process.exit(1);
                    }

                    process.exit(0);
                });
            });
        });
    });
};


// Database interface

internals.Db = function () {

    this._client = new MongoDB.Db(Config.database.db, new MongoDB.Server(Config.database.host, Config.database.port, {}), { strict: true });
    this._collections = {};
};


internals.Db.prototype.initialize = function (callback) {

    var self = this;

    var create = function () {

        var names = ['client', 'invite', 'grant', 'project', 'project.sort', 'suggestion', 'task', 'task.details', 'task.sort', 'tip', 'user', 'user.exclude', 'user.last', 'user.storage'];
        Async.forEachSeries(names, function (name, next) {

            self._client.createCollection(name, function (err, collection) {

                if (err) {
                    return callback(err);
                }

                self._collections[name] = collection;
                next();
            })
        },
        function (err) {

            callback(err);
        });
    };

    this._client.open(function (err, client) {

        if (err) {
            return callback(err);
        }

        if (!Config.database.username) {
            return create();
        }

        self._client.authenticate(Config.database.username, Config.database.password, function (err, result) {

            if (err || !result) {
                return callback(err || new Error('Authentication failed'));
            }

            return create();
        });
    });
};


internals.Db.prototype.insert = function (collectionName, items, callback) {

    var collection = this._collections[collectionName];
    var now = Date.now();
    for (var i = 0, il = items.length; i < il; ++i) {
        items[i].created = now;
        items[i].modified = now;
    }

    collection.insert(items, callback);
};


internals.install();
