// Load modules

var Hapi = require('hapi');
var Db = require('./db');


// Declare internals

var internals = {};


// User client data

exports.get = {
    handler: function (request) {

        internals.load(request.auth.credentials.user, function (err, storage) {

            if (err) {
                return request.reply(err);
            }

            if (!storage ||
                !storage.clients ||
                !storage.clients[request.auth.credentials.app]) {

                if (request.params.id) {
                    return request.reply(Hapi.Error.notFound());
                }

                return request.reply({});
            }

            if (!request.params.id) {
                return request.reply(storage.clients[request.auth.credentials.app]);
            }

            if (!internals.checkKey(request.params.id)) {
                return request.reply(Hapi.Error.badRequest('Invalid key'));
            }

            if (!storage.clients[request.auth.credentials.app][request.params.id]) {
                return request.reply(Hapi.Error.notFound());
            }

            var result = {};
            result[request.params.id] = storage.clients[request.auth.credentials.app][request.params.id];
            return request.reply(result);
        });
    }
};


// Set user client data

exports.post = {
    validate: {
        payload: {
            value: Hapi.types.String().required()
        }
    },
    handler: function (request) {

        if (!internals.checkKey(request.params.id)) {
            return request.reply(Hapi.Error.badRequest('Invalid key'));
        }

        internals.load(request.auth.credentials.user, function (err, storage) {

            if (err) {
                return request.reply(err);
            }

            if (storage) {

                // Existing storage

                var changes = { $set: {} };
                if (storage.clients) {
                    if (storage.clients[request.auth.credentials.app]) {
                        changes.$set['clients.' + request.auth.credentials.app + '.' + request.params.id] = request.payload.value;
                    }
                    else {
                        changes.$set['clients.' + request.auth.credentials.app] = {};
                        changes.$set['clients.' + request.auth.credentials.app][request.params.id] = request.payload.value;
                    }
                }
                else {
                    changes.$set.clients = {};
                    changes.$set.clients[request.auth.credentials.app] = {};
                    changes.$set.clients[request.auth.credentials.app][request.params.id] = request.payload.value;
                }

                Db.update('user.storage', storage._id, changes, function (err) {

                    return request.reply(err || { status: 'ok' });
                });
            }
            else {

                // First client data

                storage = { _id: request.auth.credentials.user, clients: {} };
                storage.clients[request.auth.credentials.app] = {};
                storage.clients[request.auth.credentials.app][request.params.id] = request.payload.value;

                Db.insert('user.storage', storage, function (err, items) {

                    return request.reply(err || { status: 'ok' });
                });
            }
        });
    }
};


// Delete user client data

exports.del = {

    handler: function (request) {

        if (!internals.checkKey(request.params.id)) {
            return request.reply(Hapi.Error.badRequest('Invalid key'));
        }

        internals.load(request.auth.credentials.user, function (err, storage) {

            if (err) {
                return request.reply(err);
            }

            if (!storage) {
                return request.reply(Hapi.Error.notFound());
            }

            if (!storage ||
                !storage.clients ||
                !storage.clients[request.auth.credentials.app] ||
                !storage.clients[request.auth.credentials.app][request.params.id]) {

                return request.reply(Hapi.Error.notFound());
            }

            var changes = { $unset: {} };
            changes.$unset['clients.' + request.auth.credentials.app + '.' + request.params.id] = 1;

            Db.update('user.storage', storage._id, changes, function (err) {

                return request.reply(err || { status: 'ok' });
            });
        });
    }
};


// Load user last timestamps

internals.load = function (userId, callback) {

    Db.get('user.storage', userId, function (err, item) {

        if (err) {
            return callback(err);
        }

        if (!item) {
            return callback(null, null);
        }

        return callback(null, item);
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

