/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var Task = require('./task');
var Last = require('./last');
var User = require('./user');
var Stream = require('./stream');


// Type definition

exports.type = {

    created:        { type: 'number',   set: false },
    type:           { type: 'enum',                     required: true,     values: { text: 1 } },
    content:        { type: 'string',                   required: true },
    user:           { type: 'id',       set: false }
};


// Task details

exports.get = function (request, reply) {

    exports.load(request.params.id, request.userId, false, function (details, err, task, project) {

        details = details || { id: request.params.id, thread: [] };

        if (err === null) {

            // Clear thread from old entries

            if (request.query.since) {

                var since = parseInt(request.query.since, 10);
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

            User.expandIds(userIds, function (users, usersMap) {

                // Assign to each thread item

                for (i = 0, il = details.thread.length; i < il; ++i) {

                    details.thread[i].user = usersMap[details.thread[i].user] || { id: details.thread[i].user };
                }

                reply(details);
            });
        }
        else {

            reply(err);
        }
    });
};


// Add task detail

exports.post = function (request, reply) {

    var now = Hapi.Utils.getTimestamp();

    exports.load(request.params.id, request.userId, true, function (details, err, task, project) {

        if (task) {

            if (err === null) {

                var detail = request.payload;
                detail.created = now;
                detail.user = request.userId;

                if (details) {

                    // Existing details

                    Db.update('task.details', details._id, { $push: { thread: detail} }, function (err) {

                        if (err === null) {

                            finalize(task, project);
                        }
                        else {

                            reply(err);
                        }
                    });
                }
                else {

                    // First detail

                    details = { _id: task._id, project: project._id, thread: [] };
                    details.thread.push(detail);

                    Db.insert('task.details', details, function (items, err) {

                        if (err === null) {

                            finalize(task, project);
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
        }
        else {

            reply(err);
        }
    });

    function finalize(task, project) {

        if (request.query.last &&
            request.query.last === 'true') {

            Last.setLast(request.userId, project, task, function (err) {});    // Ignore response
        }

        Stream.update({ object: 'details', project: task.project, task: task._id }, request);
        reply({ status: 'ok' });
    }
};


// Load task from database and check for user rights

exports.load = function (taskId, userId, isWritable, callback) {

    Task.load(taskId, userId, isWritable, function (task, err, project) {      // Check ownership

        if (task) {

            Db.get('task.details', taskId, function (item, err) {

                if (item) {

                    callback(item, null, task, project);
                }
                else {

                    if (err === null) {

                        callback(null, null, task, project);
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

exports.expandIds = function (ids, projectId, userId, callback) {

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
                            last.projects &&
                            last.projects[projectId] &&
                            last.projects[projectId].tasks &&
                            last.projects[projectId].tasks[details._id]) {

                            records[details._id].last = last.projects[projectId].tasks[details._id];
                        }
                    }
                }

                // Load user display information

                User.expandIds(userIds, function (users, usersMap) {

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
