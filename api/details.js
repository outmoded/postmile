/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Db = require('./db');
var Utils = require('./utils');
var Task = require('./task');
var Last = require('./last');
var User = require('./user');
var Err = require('./error');
var Stream = require('./stream');


// Type definition

exports.type = {

    created:        { type: 'number',   set: false },
    type:           { type: 'enum',                     required: true,     values: { text: 1 } },
    content:        { type: 'string',                   required: true },
    user:           { type: 'id',       set: false }
};


// Task details

exports.get = function (req, res, next) {

    exports.load(req.params.id, req.api.userId, false, function (details, err, task, sled) {

        details = details || { id: req.params.id, thread: [] };

        if (err === null) {

            // Clear thread from old entries

            if (req.query.since) {

                var since = parseInt(req.query.since, 10);
                if (since &&
                    since > 0) {

                    var thread = [];
                    for (var i = 0, il = details.thread.length; i < il; ++i) {

                        if (details.thread[i].created > since) {

                            thread.push(details.thread[i]);
                        }
                    }

                    details.thread = thread;
                }
            }

            // Load user display information

            var userIds = [];
            for (i = 0, il = details.thread.length; i < il; ++i) {

                userIds.push(details.thread[i].user);
            }

            User.quickList(userIds, function (users, usersMap) {

                // Assign to each thread item

                for (i = 0, il = details.thread.length; i < il; ++i) {

                    details.thread[i].user = usersMap[details.thread[i].user] || { id: details.thread[i].user };
                }

                res.api.result = details;

                next();
            });
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Add task detail

exports.post = function (req, res, next) {

    var now = Utils.getTimestamp();

    exports.load(req.params.id, req.api.userId, true, function (details, err, task, sled) {

        if (task) {

            if (err === null) {

                var detail = req.body;
                detail.created = now;
                detail.user = req.api.userId;

                if (details) {

                    // Existing details

                    Db.update('task.details', details._id, { $push: { thread: detail} }, function (err) {

                        if (err === null) {

                            reply(task, sled);
                        }
                        else {

                            res.api.error = err;
                            next();
                        }
                    });
                }
                else {

                    // First detail

                    details = { _id: task._id, sled: sled._id, thread: [] };
                    details.thread.push(detail);

                    Db.insert('task.details', details, function (items, err) {

                        if (err === null) {

                            reply(task, sled);
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
        }
        else {

            res.api.error = err;
            next();
        }
    });

    function reply(task, sled) {

        if (req.query.last &&
            req.query.last === 'true') {

            Last.setLast(req.api.userId, sled, task, function (err) {});    // Ignore response
        }

        Stream.update({ object: 'details', sled: task.sled, task: task._id }, req);
        res.api.result = { status: 'ok' };
        next();
    }
};


// Load task from database and check for user rights

exports.load = function (taskId, userId, isWritable, callback) {

    Task.load(taskId, userId, isWritable, function (task, err, sled) {      // Check ownership

        if (task) {

            Db.get('task.details', taskId, function (item, err) {

                if (item) {

                    callback(item, null, task, sled);
                }
                else {

                    if (err === null) {

                        callback(null, null, task, sled);
                    }
                    else {

                        callback(null, err, null, null);
                    }
                }
            });
        }
        else {

            callback(null, err, null, null);
        }
    });
};


// Get details quick list

exports.quickList = function (ids, sledId, userId, callback) {

    Db.getMany('task.details', ids, function (items, err, notFound) {

        if (err === null) {

            Last.load(userId, function (last, err) {

                var records = {};
                var userIds = [];
                for (var i = 0, il = items.length; i < il; ++i) {

                    var details = items[i];
                    var threadHead = (details.thread && details.thread.length > 0 ? details.thread[details.thread.length - 1] : null);
                    if (threadHead) {

                        records[details._id] = { modified: threadHead.created, user: threadHead.user };
                        userIds.push(threadHead.user);

                        if (last &&
                            last.sleds &&
                            last.sleds[sledId] &&
                            last.sleds[sledId].tasks &&
                            last.sleds[sledId].tasks[details._id]) {

                            records[details._id].last = last.sleds[sledId].tasks[details._id];
                        }
                    }
                }

                // Load user display information

                User.quickList(userIds, function (users, usersMap) {

                    // Assign to each thread item

                    for (var i in records) {

                        if (records.hasOwnProperty(i)) {

                            records[i].user = usersMap[records[i].user] || { id: records[i].user };
                        }
                    }

                    callback(records);
                });
            });
        }
        else {

            // Request fails

            callback([]);
        }
    });
};
