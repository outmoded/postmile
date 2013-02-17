// Load modules

var Hapi = require('hapi');
var Db = require('./db');


// Get ordered items list

exports.list = function (collectionName, listId, key, callback) {

    var criteria = {};
    criteria[key] = listId;

    Db.query(collectionName, criteria, function (err, items) {

        if (err) {
            return callback(err);
        }

        Db.get(collectionName + '.sort', listId, function (err, sort) {

            if (sort) {

                //    { _id: '55cf68766341e7a35c85222e78740e03',
                //      order: [ 'c577a77d8ef182964c38879838000c76' ] }

                // Note: sort.order may include deleted items

                var order = {};
                for (var i = 0, il = sort.order.length; i < il; ++i) {
                    order[sort.order[i]] = parseInt(i, 10);
                }

                for (i = 0, il = items.length; i < il; ++i) {
                    var position = order[items[i]._id];
                    items[i]._position = ((position !== undefined && position !== null) ? position : Infinity);     // Must check explicitly as value can be 0
                }
            }

            items.sort(function (a, b) {

                if (a._position < b._position) {
                    return -1;
                }

                if (a._position > b._position) {
                    return 1;
                }

                if (a.created < b.created) {
                    return -1;
                }

                if (a.created > b.created) {
                    return 1;
                }

                return 0;
            });

            return callback(null, items, sort);
        });
    });
};


// Set task position in list

exports.set = function (collectionName, listId, key, itemId, pos, callback) {

    exports.list(collectionName, listId, key, function (err, items, sort) {

        if (err || !items) {
            return callback(err || Hapi.Error.badRequest('No items'));
        }

        var newPos = parseInt(pos, 10);

        if (newPos < 0 ||
            newPos >= items.length) {

            return callback(Hapi.Error.badRequest('Bad position'));
        }

        var isNew = false;
        var newSort = Hapi.Utils.clone(sort);
        if (newSort === null) {
            newSort = { _id: listId };
            isNew = true;
        }

        newSort.order = [];

        var focusItem = null;
        for (var i = 0, il = items.length; i < il; ++i) {
            items[i]._prevPosition = items[i]._position;
            items[i]._position = i;

            if (items[i]._id === itemId) {
                focusItem = items[i];
            }
        }

        if (newPos === focusItem._position) {
            return callback(Hapi.Error.badRequest('Unchanged position'));
        }

        focusItem._position = newPos + (newPos > focusItem._position ? 0.5 : -0.5);

        items.sort(function (a, b) {

            if (a._position < b._position) {
                return -1;
            }

            if (a._position > b._position) {
                return 1;
            }

            return 0;
        });

        var oldChop = sort ? sort.order.length : 0;
        var chop = (newPos >= oldChop ? newPos + 1 : (focusItem._prevPosition !== Infinity ? oldChop : oldChop + 1));

        items.splice(chop);

        for (i = 0, il = items.length; i < il; ++i) {
            newSort.order.push(items[i]._id);
        }

        if (isNew) {
            Db.insert(collectionName + '.sort', newSort, function (err, items) {

                return callback(err);
            });
        }
        else {
            Db.replace(collectionName + '.sort', newSort, function (err) {

                return callback(err);
            });
        }
    });
};


// Delete a sort record

exports.del = function (collectionName, listId, callback) {

    Db.remove(collectionName + '.sort', listId, callback);
};
