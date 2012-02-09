/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Hapi = require('hapi');
var Db = require('./db');


// Declare internals

var internals = {};


// Type definition

exports.type = {

    value: { type: 'string', required: true }
};


// User client data

exports.get = function (req, reply) {

    exports.load(req.hapi.userId, function (storage, err) {

        if (storage &&
            storage.clients &&
            storage.clients[req.hapi.clientId]) {

            if (req.params.id) {

                if (internals.checkKey(req.params.id)) {

                    if (storage.clients[req.hapi.clientId][req.params.id]) {

                        var result = {};
                        result[req.params.id] = storage.clients[req.hapi.clientId][req.params.id];

                        reply(result);
                    }
                    else {

                        reply(Hapi.Error.notFound());
                    }
                }
                else {

                    reply(Hapi.Error.badRequest('Invalid key'));
                }
            }
            else {

                reply(storage.clients[req.hapi.clientId]);
            }
        }
        else if (err === null) {

            if (req.params.id) {

                reply(Hapi.Error.notFound());
            }
            else {

                reply({});
            }
        }
        else {

            reply(err);
        }
    });
};


// Set user client data

exports.post = function (req, reply) {

    if (internals.checkKey(req.params.id)) {

        exports.load(req.hapi.userId, function (storage, err) {

            if (err === null) {

                if (storage) {

                    // Existing storage

                    var changes = { $set: {} };
                    if (storage.clients) {

                        if (storage.clients[req.hapi.clientId]) {

                            changes.$set['clients.' + req.hapi.clientId + '.' + req.params.id] = req.hapi.payload.value;
                        }
                        else {

                            changes.$set['clients.' + req.hapi.clientId] = {};
                            changes.$set['clients.' + req.hapi.clientId][req.params.id] = req.hapi.payload.value;
                        }
                    }
                    else {

                        changes.$set.clients = {};
                        changes.$set.clients[req.hapi.clientId] = {};
                        changes.$set.clients[req.hapi.clientId][req.params.id] = req.hapi.payload.value;
                    }

                    Db.update('user.storage', storage._id, changes, function (err) {

                        if (err === null) {

                            reply({ status: 'ok' });
                        }
                        else {

                            reply(err);
                        }
                    });
                }
                else {

                    // First client data

                    storage = { _id: req.hapi.userId, clients: {} };
                    storage.clients[req.hapi.clientId] = {};
                    storage.clients[req.hapi.clientId][req.params.id] = req.hapi.payload.value;

                    Db.insert('user.storage', storage, function (items, err) {

                        if (err === null) {

                            reply({ status: 'ok' });
                        }
                        else {

                            reply(err);
                        }
                    });
                }
            }
            else {

                reply(err);
            }
        });
    }
    else {

        reply(Hapi.Error.badRequest('Invalid key'));
    }
};


// Delete user client data

exports.del = function (req, reply) {

    if (internals.checkKey(req.params.id)) {

        exports.load(req.hapi.userId, function (storage, err) {

            if (storage) {

                if (storage &&
                storage.clients &&
                storage.clients[req.hapi.clientId] &&
                storage.clients[req.hapi.clientId][req.params.id]) {

                    var changes = { $unset: {} };
                    changes.$unset['clients.' + req.hapi.clientId + '.' + req.params.id] = 1;

                    Db.update('user.storage', storage._id, changes, function (err) {

                        if (err === null) {

                            reply({ status: 'ok' });
                        }
                        else {

                            reply(err);
                        }
                    });
                }
                else {

                    reply(Hapi.Error.notFound());
                }
            }
            else if (err === null) {

                reply(Hapi.Error.notFound());
            }
            else {

                reply(err);
            }
        });
    }
    else {

        reply(Hapi.Error.badRequest('Invalid key'));
    }
};


// Load user last timestamps

exports.load = function (userId, callback) {

    Db.get('user.storage', userId, function (item, err) {

        if (item) {

            callback(item, null);
        }
        else {

            if (err === null) {

                callback(null, null);
            }
            else {

                callback(null, err);
            }
        }
    });
};


// Check key

internals.checkKey = function (key) {

    var keyRegex = /^\w+$/;
    return (key.match(keyRegex) !== null);
};


// Remove entire storage record

exports.delUser = function (userId, callback) {

    Db.remove('user.storage', userId, callback);
};

