/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Hapi = require('hapi');
var Db = require('./db');


// Declare internals

var internals = {};


// User client data

exports.get = {
    
    handler: function (request) {

        exports.load(request.session.user, function (storage, err) {

            if (storage &&
                storage.clients &&
                storage.clients[request.session.client]) {

                if (request.params.id) {

                    if (internals.checkKey(request.params.id)) {

                        if (storage.clients[request.session.client][request.params.id]) {

                            var result = {};
                            result[request.params.id] = storage.clients[request.session.client][request.params.id];

                            request.reply(result);
                        }
                        else {

                            request.reply(Hapi.Error.notFound());
                        }
                    }
                    else {

                        request.reply(Hapi.Error.badRequest('Invalid key'));
                    }
                }
                else {

                    request.reply(storage.clients[request.session.client]);
                }
            }
            else if (err === null) {

                if (request.params.id) {

                    request.reply(Hapi.Error.notFound());
                }
                else {

                    request.reply({});
                }
            }
            else {

                request.reply(err);
            }
        });
    }
};


// Set user client data

exports.post = {

    schema: {

        value: Hapi.Types.String().required()
    },

    handler: function (request) {

        if (internals.checkKey(request.params.id)) {

            exports.load(request.session.user, function (storage, err) {

                if (err === null) {

                    if (storage) {

                        // Existing storage

                        var changes = { $set: {} };
                        if (storage.clients) {

                            if (storage.clients[request.session.client]) {

                                changes.$set['clients.' + request.session.client + '.' + request.params.id] = request.payload.value;
                            }
                            else {

                                changes.$set['clients.' + request.session.client] = {};
                                changes.$set['clients.' + request.session.client][request.params.id] = request.payload.value;
                            }
                        }
                        else {

                            changes.$set.clients = {};
                            changes.$set.clients[request.session.client] = {};
                            changes.$set.clients[request.session.client][request.params.id] = request.payload.value;
                        }

                        Db.update('user.storage', storage._id, changes, function (err) {

                            if (err === null) {

                                request.reply({ status: 'ok' });
                            }
                            else {

                                request.reply(err);
                            }
                        });
                    }
                    else {

                        // First client data

                        storage = { _id: request.session.user, clients: {} };
                        storage.clients[request.session.client] = {};
                        storage.clients[request.session.client][request.params.id] = request.payload.value;

                        Db.insert('user.storage', storage, function (items, err) {

                            if (err === null) {

                                request.reply({ status: 'ok' });
                            }
                            else {

                                request.reply(err);
                            }
                        });
                    }
                }
                else {

                    request.reply(err);
                }
            });
        }
        else {

            request.reply(Hapi.Error.badRequest('Invalid key'));
        }
    }
};


// Delete user client data

exports.del = {
    
    handler: function (request) {

        if (internals.checkKey(request.params.id)) {

            exports.load(request.session.user, function (storage, err) {

                if (storage) {

                    if (storage &&
                    storage.clients &&
                    storage.clients[request.session.client] &&
                    storage.clients[request.session.client][request.params.id]) {

                        var changes = { $unset: {} };
                        changes.$unset['clients.' + request.session.client + '.' + request.params.id] = 1;

                        Db.update('user.storage', storage._id, changes, function (err) {

                            if (err === null) {

                                request.reply({ status: 'ok' });
                            }
                            else {

                                request.reply(err);
                            }
                        });
                    }
                    else {

                        request.reply(Hapi.Error.notFound());
                    }
                }
                else if (err === null) {

                    request.reply(Hapi.Error.notFound());
                }
                else {

                    request.reply(err);
                }
            });
        }
        else {

            request.reply(Hapi.Error.badRequest('Invalid key'));
        }
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

