// Load Modules

var MongoDB = require('mongodb');
var Hapi = require('hapi');
var Vault = require('./vault');
var Config = require('./config');


// Declare internals

var internals = {

    collectionNames: ['client',
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

        if (err) {
            return callback('Database connection error: ' + JSON.stringify(err));
        }

        if (!Vault.database.username) {
            return internals.initCollection(0, isNew, callback);
        }

        internals.client.authenticate(Vault.database.username, Vault.database.password, function (err, result) {

            if (err) {
                return callback('Database authentication error: ' + JSON.stringify(err));
            }

            if (!result) {
                return callback('Database authentication failed');
            }

            return internals.initCollection(0, isNew, callback);
        });
    });

    // TODO: find a way to close the connection
};


internals.initCollection = function (i, isNew, callback) {

    var next = function (err, collection) {

        if (err) {
            return callback('Failed opening collection: ' + internals.collectionNames[i] + ' due to: ' + err);
        }

        internals.collections[internals.collectionNames[i]] = collection;
        internals.initCollection(i + 1, isNew, callback);
    };

    if (i >= internals.collectionNames.length) {
        return callback(null);
    }

    if (isNew) {
        return internals.client.createCollection(internals.collectionNames[i], next);
    }

    return internals.client.collection(internals.collectionNames[i], next);
};


// Get entire collection

exports.all = function (collectionName, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'all'));
    }

    collection.find(function (err, cursor) {

        if (err) {
            return callback(internals.error(err, collectionName, 'all'));
        }

        cursor.toArray(function (err, results) {

            if (err) {
                return callback(internals.error(err, collectionName, 'all'));
            }

            internals.normalize(results);
            return callback(null, results);
        });
    });
};


// Get document by id

exports.get = function (collectionName, id, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'get', id));
    }

    var dbId = internals.getDbId(id);
    if (!dbId) {
        return callback(null, null);
    }

    collection.findOne(dbId, function (err, result) {

        if (err) {
            return callback(internals.error(err, collectionName, 'get', id));
        }

        internals.normalize(result);
        return callback(null, result);
    });
};


// Get multiple documents by id list

exports.getMany = function (collectionName, ids, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'getMany', ids), ids);
    }

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

    if (criteria._id.$in.length <= 0) {
        return callback(null, [], ids);
    }

    collection.find(criteria, function (err, cursor) {

        if (err) {
            return callback(internals.error(err, collectionName, 'getMany', ids), ids);
        }

        cursor.toArray(function (err, results) {

            if (err) {
                return callback(internals.error(err, collectionName, 'getMany', ids), ids);
            }

            if (results.length <= 0) {
                return callback(null, [], ids);
            }

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

            return callback(null, items, notFound);
        });
    });
};


// Query documents by criteria

exports.query = function (collectionName, criteria, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'query', criteria));
    }

    internals.idifyString(criteria);
    collection.find(criteria, function (err, cursor) {

        if (err) {
            return callback(internals.error(err, collectionName, 'query', criteria));
        }

        cursor.toArray(function (err, results) {

            if (err) {
                return callback(internals.error(err, collectionName, 'query', criteria));
            }

            internals.normalize(results);
            return callback(null, results);
        });
    });
};


// Query for a single (unique) documents by criteria

exports.queryUnique = function (collectionName, criteria, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'queryUnique', criteria));
    }

    internals.idifyString(criteria);
    collection.find(criteria, function (err, cursor) {

        if (err) {
            return callback(internals.error(err, collectionName, 'queryUnique', criteria));
        }

        cursor.toArray(function (err, results) {

            if (err) {
                return callback(internals.error(err, collectionName, 'queryUnique', criteria));
            }

            if (!results) {
                return callback(internals.error('Null result array', collectionName, 'queryUnique', criteria));
            }

            if (results.length <= 0) {
                return callback(null, null);
            }

            if (results.length !== 1) {
                return callback(internals.error('Found multiple results for unique criteria', collectionName, 'queryUnique', criteria));
            }

            var result = results[0];
            internals.normalize(result);
            return callback(null, result);
        });
    });
};


// Count documents by criteria

exports.count = function (collectionName, criteria, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'count', criteria));
    }

    internals.idifyString(criteria);
    collection.count(criteria, function (err, count) {

        if (err) {
            return callback(internals.error(err, collectionName, 'count', criteria));
        }

        return callback(null, count);
    });
};


// Save new documents (one or many)

exports.insert = function (collectionName, items, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'insert', items));
    }

    var now = Date.now();

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

        if (err) {
            return callback(internals.error(err, collectionName, 'insert', items));
        }

        if (!results ||
            results.length <= 0) {

            return callback(internals.error('No database insert output', collectionName, 'insert', items));
        }

        internals.normalize(results);
        return callback(null, results);
    });
};


// Replace a single existing document

exports.replace = function (collectionName, item, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'replace', item));
    }

    var now = Date.now();
    if (item.created === undefined) {

        item.created = now;
    }

    item.modified = now;

    internals.idifyString(item);
    collection.update({ _id: item._id }, item, function (err, count) {

        if (err) {
            return callback(internals.error(err, collectionName, 'replace', item));
        }

        if (!count) {
            return callback(internals.error('No document found to replace', collectionName, 'replace', item));
        }

        return callback(null);
    });
};


// Update a single existing document

exports.update = function (collectionName, id, changes, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'update', [id, changes]));
    }

    changes = changes || {};
    changes.$set = changes.$set || {};

    var now = Date.now();
    changes.$set.modified = now;

    var dbId = internals.getDbId(id);
    if (!dbId) {
        return callback(internals.error('Invalid id', collectionName, 'update', [id, changes]));
    }

    collection.update({ _id: dbId }, changes, function (err, count) {

        if (err) {
            return callback(internals.error(err, collectionName, 'update', [id, changes]));
        }

        if (!count) {
            return callback(internals.error('No document found to update', collectionName, 'update', [id, changes]));
        }

        return callback(null);
    });
};


// Update any existing document matching criteria

exports.updateCriteria = function (collectionName, id, itemCriteria, changes, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'updateCriteria', [id, itemCriteria, changes]));
    }

    changes = changes || {};
    changes.$set = changes.$set || {};

    var now = Date.now();
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

    if (!isValid) {
        return callback(internals.error('Invalid id', collectionName, 'updateCriteria', [id, itemCriteria, changes, options]));
    }

    collection.update(itemCriteria, changes, options, function (err, count) {

        if (err) {
            return callback(internals.error(err, collectionName, 'updateCriteria', [id, itemCriteria, changes, options]));
        }

        if (!id) {
            return callback(null);
        }

        if (!count) {
            return callback(internals.error('No document found to update', collectionName, 'updateCriteria', [id, itemCriteria, changes, options]));
        }

        return callback(null);
    });
};


// Remove item

exports.remove = function (collectionName, id, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'remove', id));
    }

    var dbId = new internals.ObjectID(id);
    collection.remove({ _id: dbId }, function (err, collection) {

        if (err) {
            return callback(internals.error(err, collectionName, 'remove', id));
        }

        return callback(null);
    });
};


// Remove criteria

exports.removeCriteria = function (collectionName, criteria, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'remove', id));
    }

    internals.idifyString(criteria);
    collection.remove(criteria, function (err, collection) {

        if (err) {
            return callback(internals.error(err, collectionName, 'remove', id));
        }

        return callback(null);
    });
};


// Remove multiple items

exports.removeMany = function (collectionName, ids, callback) {

    var collection = internals.collections[collectionName];
    if (!collection) {
        return callback(internals.error('Collection not found', collectionName, 'remove', ids));
    }

    var criteria = { _id: {} };
    criteria._id.$in = [];
    for (var i = 0, il = ids.length; i < il; ++i) {
        var dbId = internals.getDbId(ids[i]);
        if (dbId) {
            criteria._id.$in.push(dbId);
        }
    }

    if (criteria._id.$in.length <= 0) {
        return callback(internals.error('Invalid ids', collectionName, 'remove', ids));
    }

    collection.remove(criteria, function (err, collection) {

        if (err) {
            return callback(internals.error(err, collectionName, 'remove', ids));
        }

        return callback(null);
    });
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


// Construct error artifact

internals.error = function (error, collection, action, input) {

    return Hapi.Error.internal('Database error', { error: error, collection: collection, action: action, input: input });
};

