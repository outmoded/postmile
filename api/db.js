/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load Modules

var MongoDB = require('mongodb');
var Hapi = require('hapi');
var Vault = require('./vault');
var Config = require('./config');


// Declare internals

var internals = {

    collectionNames: [ 'client',
                       'invite',
                       'grant',
                       'project', 'project.sort',
                       'suggestion',
                       'task', 'task.details', 'task.sort',
                       'tip',
                       'user', 'user.exclude', 'user.last', 'user.storage'],

    client: new MongoDB.Db(Config.database.db, new MongoDB.Server(Config.database.host, Config.database.port, {}), { strict: true }),
    collections: {}
};


internals.Long = internals.client.bson_serializer.Long;
internals.ObjectID = internals.client.bson_serializer.ObjectID;


// Connect to database and initialize internals.collections

exports.initialize = function (arg1, arg2) {        // [isNew,] callback

    var isNew = (arg2 ? arg1 : false);
    var callback = (arg2 || arg1);

    internals.client.open(function (err, client) {

        if (err === null) {

            if (Vault.database.username) {

                internals.client.authenticate(Vault.database.username, Vault.database.password, function (err, result) {

                    if (err === null) {

                        if (result === true) {

                            internals.initCollection(0, isNew, callback);
                        }
                        else {

                            callback('Database authentication failed');
                        }
                    }
                    else {

                        callback('Database authentication error: ' + JSON.stringify(err));
                    }
                });
            }
            else {

                internals.initCollection(0, isNew, callback);
            }
        }
        else {

            callback('Database connection error: ' + JSON.stringify(err));
        }
    });

    // TODO: find a way to close the connection
};


internals.initCollection = function (i, isNew, callback) {

    if (i < internals.collectionNames.length) {

        if (isNew) {

            internals.client.createCollection(internals.collectionNames[i], next);
        }
        else {

            internals.client.collection(internals.collectionNames[i], next);
        }
    }
    else {

        callback(null);
    }

    function next(err, collection) {

        if (err === null) {

            internals.collections[internals.collectionNames[i]] = collection;
            internals.initCollection(i + 1, isNew, callback);
        }
        else {

            callback('Failed opening collection: ' + internals.collectionNames[i] + ' due to: ' + err);
        }
    }
};


// Get entire collection

exports.all = function (collectionName, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        collection.find(function (err, cursor) {

            if (err === null) {

                cursor.toArray(function (err, results) {

                    if (err === null) {

                        internals.normalize(results);
                        callback(results, null);
                    }
                    else {

                        callback(null, Hapi.Error.database(err, collectionName, 'all'));
                    }
                });
            }
            else {

                callback(null, Hapi.Error.database(err, collectionName, 'all'));
            }
        });
    }
    else {

        callback(null, Hapi.Error.database('Collection not found', collectionName, 'all'));
    }
};


// Get document by id

exports.get = function (collectionName, id, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        var dbId = internals.getDbId(id);
        if (dbId) {

            collection.findOne(dbId, function (err, result) {

                if (err === null) {

                    internals.normalize(result);
                    callback(result, null);
                }
                else {

                    callback(null, Hapi.Error.database(err, collectionName, 'get', id));
                }
            });
        }
        else {

            callback(null, null);
        }
    }
    else {

        callback(null, Hapi.Error.database('Collection not found', collectionName, 'get', id));
    }
};


// Get multiple documents by id list

exports.getMany = function (collectionName, ids, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        var notFound = [];
        var criteria = { _id: {} };
        criteria._id.$in = [];
        for (var i = 0, il = ids.length; i < il; ++i) {

            var dbId = internals.getDbId(ids[i]);
            if (dbId) {

                criteria._id.$in.push(dbId);
            }
            else {

                notFound.push(ids[i]);
            }
        }

        if (criteria._id.$in.length > 0) {

            collection.find(criteria, function (err, cursor) {

                if (err === null) {

                    cursor.toArray(function (err, results) {

                        if (err === null) {

                            if (results.length > 0) {

                                internals.normalize(results);

                                // Sort based on requested ids

                                var map = {};
                                for (i = 0, il = results.length; i < il; ++i) {

                                    map[results[i]._id] = results[i];
                                }

                                var items = [];
                                for (i = 0, il = ids.length; i < il; ++i) {

                                    if (map[ids[i]]) {

                                        items.push(map[ids[i]]);
                                    }
                                    else {

                                        notFound.push(ids[i]);
                                    }
                                }

                                callback(items, null, notFound);
                            }
                            else {

                                callback([], null, ids);
                            }
                        }
                        else {

                            callback(null, Hapi.Error.database(err, collectionName, 'getMany', ids), ids);
                        }
                    });
                }
                else {

                    callback(null, Hapi.Error.database(err, collectionName, 'getMany', ids), ids);
                }
            });
        }
        else {

            callback([], null, ids);
        }
    }
    else {

        callback(null, Hapi.Error.database('Collection not found', collectionName, 'getMany', ids), ids);
    }
};


// Query documents by criteria

exports.query = function (collectionName, criteria, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        internals.idifyString(criteria);
        collection.find(criteria, function (err, cursor) {

            if (err === null) {

                cursor.toArray(function (err, results) {

                    if (err === null) {

                        internals.normalize(results);
                        callback(results, null);
                    }
                    else {

                        callback(null, Hapi.Error.database(err, collectionName, 'query', criteria));
                    }
                });
            }
            else {

                callback(null, Hapi.Error.database(err, collectionName, 'query', criteria));
            }
        });
    }
    else {

        callback(null, Hapi.Error.database('Collection not found', collectionName, 'query', criteria));
    }
};


// Query for a single (unique) documents by criteria

exports.queryUnique = function (collectionName, criteria, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        internals.idifyString(criteria);
        collection.find(criteria, function (err, cursor) {

            if (err === null) {

                cursor.toArray(function (err, results) {

                    if (err === null) {

                        if (results) {

                            if (results.length > 0) {

                                if (results.length === 1) {

                                    var result = results[0];
                                    internals.normalize(result);
                                    callback(result, null);
                                }
                                else {

                                    callback(null, Hapi.Error.database('Found multiple results for unique criteria', collectionName, 'queryUnique', criteria));
                                }
                            }
                            else {

                                // Not found
                                callback(null, null);
                            }
                        }
                        else {

                            callback(null, Hapi.Error.database('Null result array', collectionName, 'queryUnique', criteria));
                        }
                    }
                    else {

                        callback(null, Hapi.Error.database(err, collectionName, 'queryUnique', criteria));
                    }
                });
            }
            else {

                callback(null, Hapi.Error.database(err, collectionName, 'queryUnique', criteria));
            }
        });
    }
    else {

        callback(null, Hapi.Error.database('Collection not found', collectionName, 'queryUnique', criteria));
    }
};


// Count documents by criteria

exports.count = function (collectionName, criteria, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        internals.idifyString(criteria);
        collection.count(criteria, function (err, count) {

            if (err === null) {

                callback(count, null);
            }
            else {

                callback(null, Hapi.Error.database(err, collectionName, 'count', criteria));
            }
        });
    }
    else {

        callback(null, Hapi.Error.database('Collection not found', collectionName, 'count', criteria));
    }
};


// Save new documents (one or many)

exports.insert = function (collectionName, items, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        var now = Hapi.Utils.getTimestamp();

        if (items instanceof Array) {

            for (var i = 0, il = items.length; i < il; ++i) {

                items[i].created = now;
                items[i].modified = now;
            }
        }
        else {

            items.created = now;
            items.modified = now;
        }

        internals.idifyString(items);
        collection.insert(items, function (err, results) {

            if (err === null) {

                if (results && results.length > 0) {

                    internals.normalize(results);
                    callback(results, null);
                }
                else {

                    callback(null, Hapi.Error.database('No database insert output', collectionName, 'insert', items));
                }
            }
            else {

                callback(null, Hapi.Error.database(err, collectionName, 'insert', items));
            }
        });
    }
    else {

        callback(null, Hapi.Error.database('Collection not found', collectionName, 'insert', items));
    }
};


// Replace a single existing document

exports.replace = function (collectionName, item, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        var now = Hapi.Utils.getTimestamp();
        if (item.created === undefined) {

            item.created = now;
        }

        item.modified = now;

        internals.idifyString(item);
        collection.update({ _id: item._id }, item, function (err, count) {

            if (err === null) {

                if (count) {

                    callback(null);
                }
                else {

                    callback(Hapi.Error.database('No document found to replace', collectionName, 'replace', item));
                }
            }
            else {

                callback(Hapi.Error.database(err, collectionName, 'replace', item));
            }
        });
    }
    else {

        callback(Hapi.Error.database('Collection not found', collectionName, 'replace', item));
    }
};


// Update a single existing document

exports.update = function (collectionName, id, changes, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        changes = changes || {};
        changes.$set = changes.$set || {};

        var now = Hapi.Utils.getTimestamp();
        changes.$set.modified = now;

        var dbId = internals.getDbId(id);
        if (dbId) {

            collection.update({ _id: dbId }, changes, function (err, count) {

                if (err === null) {

                    if (count) {

                        callback(null);
                    }
                    else {

                        callback(Hapi.Error.database('No document found to update', collectionName, 'update', [id, changes]));
                    }
                }
                else {

                    callback(Hapi.Error.database(err, collectionName, 'update', [id, changes]));
                }
            });
        }
        else {

            callback(Hapi.Error.database('Invalid id', collectionName, 'update', [id, changes]));
        }
    }
    else {

        callback(Hapi.Error.database('Collection not found', collectionName, 'update', [id, changes]));
    }
};


// Update any existing document matching criteria

exports.updateCriteria = function (collectionName, id, itemCriteria, changes, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        changes = changes || {};
        changes.$set = changes.$set || {};

        var now = Hapi.Utils.getTimestamp();
        changes.$set.modified = now;

        var isValid = true;

        // Add id to criteria if present

        var options = {};

        if (id) {

            var dbId = internals.getDbId(id);
            if (dbId) {

                itemCriteria._id = dbId;
            }
            else {

                isValid = false;
            }
        }
        else {

            options.multi = true;
        }

        if (isValid) {

            collection.update(itemCriteria, changes, options, function (err, count) {

                if (err === null) {

                    if (id) {

                        if (count) {

                            callback(null);
                        }
                        else {

                            callback(Hapi.Error.database('No document found to update', collectionName, 'updateCriteria', [id, itemCriteria, changes, options]));
                        }
                    }
                    else {

                        callback(null);
                    }
                }
                else {

                    callback(Hapi.Error.database(err, collectionName, 'updateCriteria', [id, itemCriteria, changes, options]));
                }
            });
        }
        else {

            callback(Hapi.Error.database('Invalid id', collectionName, 'updateCriteria', [id, itemCriteria, changes, options]));
        }
    }
    else {

        callback(Hapi.Error.database('Collection not found', collectionName, 'updateCriteria', [id, itemCriteria, changes]));
    }
};


// Remove item

exports.remove = function (collectionName, id, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        var dbId = new internals.ObjectID(id);
        collection.remove({ _id: dbId }, function (err, collection) {

            if (err === null) {

                callback(null);
            }
            else {

                callback(Hapi.Error.database(err, collectionName, 'remove', id));
            }
        });
    }
    else {

        callback(Hapi.Error.database('Collection not found', collectionName, 'remove', id));
    }
};


// Remove criteria

exports.removeCriteria = function (collectionName, criteria, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        internals.idifyString(criteria);
        collection.remove(criteria, function (err, collection) {

            if (err === null) {

                callback(null);
            }
            else {

                callback(Hapi.Error.database(err, collectionName, 'remove', id));
            }
        });
    }
    else {

        callback(Hapi.Error.database('Collection not found', collectionName, 'remove', id));
    }
};


// Remove multiple items

exports.removeMany = function (collectionName, ids, callback) {

    var collection = internals.collections[collectionName];
    if (collection) {

        var criteria = { _id: {} };
        criteria._id.$in = [];
        for (var i = 0, il = ids.length; i < il; ++i) {

            var dbId = internals.getDbId(ids[i]);
            if (dbId) {

                criteria._id.$in.push(dbId);
            }
        }

        if (criteria._id.$in.length > 0) {

            collection.remove(criteria, function (err, collection) {

                if (err === null) {

                    callback(null);
                }
                else {

                    callback(Hapi.Error.database(err, collectionName, 'remove', ids));
                }
            });
        }
        else {

            callback(Hapi.Error.database('Invalid ids', collectionName, 'remove', ids));
        }
    }
    else {

        callback(Hapi.Error.database('Collection not found', collectionName, 'remove', ids));
    }
};


// Convert object into update changes

exports.toChanges = function (item) {

    var changes = {};

    if (item &&
        item instanceof Object &&
        item instanceof Array === false) {

        changes.$set = {};

        for (var i in item) {

            if (item.hasOwnProperty(i)) {

                changes.$set[i] = item[i];
            }
        }
    }

    return changes;
};


// Get unique identifier

exports.generateId = function () {

    var id = new internals.ObjectID();
    return id.toString();
};


// Encode key

exports.encodeKey = function (value) {

    return value.replace(/%/g, '%25').replace(/\./g, '%2E').replace(/^\$/, '%24');
};


// Decode key

exports.decodeKey = function (value) {

    return decodeURIComponent(value);
};


// Remove db specific id object type

internals.normalize = function (obj) {

    if (obj !== null) {

        for (var i in obj) {

            if (obj.hasOwnProperty(i)) {

                if (obj[i] instanceof internals.Long) {

                    obj[i] = obj[i].toNumber();
                }
                else if (obj[i] instanceof internals.ObjectID) {

                    obj[i] = obj[i].toString();
                }
                else if (obj[i] && typeof obj[i] === 'object') {

                    internals.normalize(obj[i]);
                }
            }
        }
    }
};


// Changed id into db specific object type

internals.idifyString = function (items) {

    if (items) {

        if (items instanceof Array) {

            for (var i = 0, il = items.length; i < il; ++i) {

                if (items[i]._id) {

                    items[i]._id = new internals.ObjectID(items[i]._id);
                }
            }
        }
        else {

            if (items._id) {

                items._id = new internals.ObjectID(items._id);
            }
        }
    }
};


// Get DB id

internals.getDbId = function (id) {

    if (/^[0-9a-fA-F]{24}$/.test(id)) {

        return new internals.ObjectID(id);
    }
    else {

        return null;
    }
};
