/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Db = require('./db');
var Utils = require('./utils');
var Err = require('./error');


// Declare internals

var internals = {};


// Type definition

exports.type = {

    value: { type: 'string', required: true }
};


// User client data

exports.get = function (req, res, next) {

    exports.load(req.api.userId, function (storage, err) {

        if (storage &&
            storage.clients &&
            storage.clients[req.api.clientId]) {

            if (req.params.id) {

                if (internals.checkKey(req.params.id)) {

                    if (storage.clients[req.api.clientId][req.params.id]) {

                        var result = {};
                        result[req.params.id] = storage.clients[req.api.clientId][req.params.id];

                        res.api.result = result;
                        next();
                    }
                    else {

                        res.api.error = Err.notFound();
                        next();
                    }
                }
                else {

                    res.api.error = Err.badRequest('Invalid key');
                    next();
                }
            }
            else {

                res.api.result = storage.clients[req.api.clientId];
                next();
            }
        }
        else if (err === null) {

            if (req.params.id) {

                res.api.error = Err.notFound();
                next();
            }
            else {

                res.api.result = {};
                next();
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Set user client data

exports.post = function (req, res, next) {

    if (internals.checkKey(req.params.id)) {

        exports.load(req.api.userId, function (storage, err) {

            if (err === null) {

                if (storage) {

                    // Existing storage

                    var changes = { $set: {} };
                    if (storage.clients) {

                        if (storage.clients[req.api.clientId]) {

                            changes.$set['clients.' + req.api.clientId + '.' + req.params.id] = req.body.value;
                        }
                        else {

                            changes.$set['clients.' + req.api.clientId] = {};
                            changes.$set['clients.' + req.api.clientId][req.params.id] = req.body.value;
                        }
                    }
                    else {

                        changes.$set.clients = {};
                        changes.$set.clients[req.api.clientId] = {};
                        changes.$set.clients[req.api.clientId][req.params.id] = req.body.value;
                    }

                    Db.update('user.storage', storage._id, changes, function (err) {

                        if (err === null) {

                            res.api.result = { status: 'ok' };
                            next();
                        }
                        else {

                            res.api.error = err;
                            next();
                        }
                    });
                }
                else {

                    // First client data

                    storage = { _id: req.api.userId, clients: {} };
                    storage.clients[req.api.clientId] = {};
                    storage.clients[req.api.clientId][req.params.id] = req.body.value;

                    Db.insert('user.storage', storage, function (items, err) {

                        if (err === null) {

                            res.api.result = { status: 'ok' };
                            next();
                        }
                        else {

                            res.api.error = err;
                            next();
                        }
                    });
                }
            }
            else {

                res.api.error = err;
                next();
            }
        });
    }
    else {

        res.api.error = Err.badRequest('Invalid key');
        next();
    }
};


// Delete user client data

exports.del = function (req, res, next) {

    if (internals.checkKey(req.params.id)) {

        exports.load(req.api.userId, function (storage, err) {

            if (storage) {

                if (storage &&
                storage.clients &&
                storage.clients[req.api.clientId] &&
                storage.clients[req.api.clientId][req.params.id]) {

                    var changes = { $unset: {} };
                    changes.$unset['clients.' + req.api.clientId + '.' + req.params.id] = 1;

                    Db.update('user.storage', storage._id, changes, function (err) {

                        if (err === null) {

                            res.api.result = { status: 'ok' };
                            next();
                        }
                        else {

                            res.api.error = err;
                            next();
                        }
                    });
                }
                else {

                    res.api.error = Err.notFound();
                    next();
                }
            }
            else if (err === null) {

                res.api.error = Err.notFound();
                next();
            }
            else {

                res.api.error = err;
                next();
            }
        });
    }
    else {

        res.api.error = Err.badRequest('Invalid key');
        next();
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

