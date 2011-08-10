/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Db = require('./db');
var Err = require('./error');
var Utils = require('./utils');
var Sled = require('./sled');
var Task = require('./task');


// Declare internals

var internals = {};


// Last information for sled (with tasks)

exports.getSled = function (req, res, next) {

    exports.load(req.api.userId, function (last, err) {

        if (last &&
            last.sleds &&
            last.sleds[req.params.id]) {

            var record = { id: last._id, sleds: {} };
            record.sleds[req.params.id] = last.sleds[req.params.id];

            res.api.result = record;
            next();
        }
        else if (err === null) {

            res.api.result = { id: req.api.userId, sleds: {} };
            next();
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Set last sled timestamp

exports.postSled = function (req, res, next) {

    Sled.load(req.params.id, req.api.userId, false, function (sled, member, err) {

        if (sled) {

            exports.setLast(req.api.userId, sled, null, function (err) {

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

            res.api.error = err;
            next();
        }
    });
};


// Last information for single task

exports.getTask = function (req, res, next) {

    Task.load(req.params.id, req.api.userId, false, function (task, err, sled) {

        if (task) {

            exports.load(req.api.userId, function (last, err) {

                if (last &&
                    last.sleds &&
                    last.sleds[task.sled] &&
                    last.sleds[task.sled].tasks &&
                    last.sleds[task.sled].tasks[req.params.id]) {

                    var record = { id: last._id, sleds: {} };
                    record.sleds[task.sled] = { tasks: {} };
                    record.sleds[task.sled].tasks[req.params.id] = last.sleds[task.sled].tasks[req.params.id];

                    res.api.result = record;
                    next();
                }
                else if (err === null) {

                    res.api.result = { id: req.api.userId, sleds: {} };
                    next();
                }
                else {

                    res.api.error = err;
                    next();
                }
            });
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Set last task timestamp

exports.postTask = function (req, res, next) {

    Task.load(req.params.id, req.api.userId, false, function (task, err, sled) {

        if (task) {

            exports.setLast(req.api.userId, sled, task, function (err) {

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

            res.api.error = err;
            next();
        }
    });
};


// Load user last timestamps

exports.load = function (userId, callback) {

    Db.get('user.last', userId, function (item, err) {

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


// Clear sled last

exports.delSled = function (userId, sledId, callback) {

    exports.load(userId, function (last, err) {

        if (last &&
            last.sleds &&
            last.sleds[sledId]) {

            var changes = { $unset: {} };
            changes.$unset['sleds.' + sledId] = 1;

            Db.update('user.last', last._id, changes, function (err) {

                if (err === null) {

                    callback(null);
                }
                else {

                    callback(err);
                }
            });
        }
        else if (err) {

            callback(err);
        }
    });
};


// Set last timestamp

exports.setLast = function (userId, sled, task, callback) {

    var now = Utils.getTimestamp();

    exports.load(userId, function (last, err) {

        if (err === null) {

            if (last) {

                // Existing last record

                var changes = { $set: {} };

                if (task === null) {

                    // Sled last: last->sleds.{sledId}.last

                    if (last.sleds) {

                        if (last.sleds[sled._id]) {

                            changes.$set['sleds.' + sled._id + '.last'] = now;
                        }
                        else {

                            changes.$set['sleds.' + sled._id] = { tasks: {}, last: now };
                        }
                    }
                    else {

                        changes.$set.sleds = {};
                        changes.$set.sleds[sled._id] = { tasks: {}, last: now };
                    }
                }
                else {

                    // Task last: last->sleds.{sledId}.tasks.{taskId}

                    if (last.sleds) {

                        if (last.sleds[sled._id]) {

                            if (last.sleds[sled._id].tasks) {

                                changes.$set['sleds.' + sled._id + '.tasks.' + task._id] = now;
                            }
                            else {

                                changes.$set['sleds.' + sled._id + '.tasks'] = {};
                                changes.$set['sleds.' + sled._id + '.tasks'][task._id] = now;
                            }
                        }
                        else {

                            changes.$set['sleds.' + sled._id] = { tasks: {} };
                            changes.$set['sleds.' + sled._id].tasks[task._id] = now;
                        }
                    }
                    else {

                        changes.$set.sleds = {};
                        changes.$set.sleds[sled._id] = { tasks: {} };
                        changes.$set.sleds[sled._id].tasks[task._id] = now;
                    }
                }

                Db.update('user.last', last._id, changes, function (err) {

                    callback(err);
                });
            }
            else {

                // First last timestamp

                last = { _id: userId, sleds: {} };
                last.sleds[sled._id] = { tasks: {} };

                if (task === null) {

                    last.sleds[sled._id].last = now;
                }
                else {

                    last.sleds[sled._id].tasks[task._id] = now;
                }

                Db.insert('user.last', last, function (items, err) {

                    callback(err);
                });
            }
        }
        else {

            callback(err);
        }
    });
};


// Remove entire last record

exports.delUser = function (userId, callback) {

    Db.remove('user.last', userId, callback);
};



