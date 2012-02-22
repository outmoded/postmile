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

exports.get = function (request, reply) {

    exports.load(request.userId, function (storage, err) {

        if (storage &&
            storage.clients &&
            storage.clients[request.clientId]) {

            if (request.params.id) {

                if (internals.checkKey(request.params.id)) {

                    if (storage.clients[request.clientId][request.params.id]) {

                        var result = {};
                        result[request.params.id] = storage.clients[request.clientId][request.params.id];

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

                reply(storage.clients[request.clientId]);
            }
        }
        else if (err === null) {

            if (request.params.id) {

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

exports.post = function (request, reply) {

    if (internals.checkKey(request.params.id)) {

        exports.load(request.userId, function (storage, err) {

            if (err === null) {

                if (storage) {

                    // Existing storage

                    var changes = { $set: {} };
                    if (storage.clients) {

                        if (storage.clients[request.clientId]) {

                            changes.$set['clients.' + request.clientId + '.' + request.params.id] = request.payload.value;
                        }
                        else {

                            changes.$set['clients.' + request.clientId] = {};
                            changes.$set['clients.' + request.clientId][request.params.id] = request.payload.value;
                        }
                    }
                    else {

                        changes.$set.clients = {};
                        changes.$set.clients[request.clientId] = {};
                        changes.$set.clients[request.clientId][request.params.id] = request.payload.value;
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

                    storage = { _id: request.userId, clients: {} };
                    storage.clients[request.clientId] = {};
                    storage.clients[request.clientId][request.params.id] = request.payload.value;

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

exports.del = function (request, reply) {

    if (internals.checkKey(request.params.id)) {

        exports.load(request.userId, function (storage, err) {

            if (storage) {

                if (storage &&
                storage.clients &&
                storage.clients[request.clientId] &&
                storage.clients[request.clientId][request.params.id]) {

                    var changes = { $unset: {} };
                    changes.$unset['clients.' + request.clientId + '.' + request.params.id] = 1;

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

