// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var Task = require('./task');
var Last = require('./last');
var User = require('./user');
var Stream = require('./stream');


// Declare internals

var internals = {};


// Task details

exports.get = {
    validate: {
        query: {
            since: Hapi.types.Number().min(0)
        }
    },
    handler: function (request) {

        internals.load(request.params.id, request.auth.credentials.user, false, function (err, details, task, project) {

            details = details || { id: request.params.id, thread: [] };

            if (err) {
                return request.reply(err);
            }

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

                return request.reply(details);
            });
        });
    }
};


// Add task detail

exports.post = {
    validate: {
        query: {
            last: Hapi.types.Boolean()
        },
        payload: {
            type: Hapi.types.String().required().valid('text'),
            content: Hapi.types.String().required()
        }
    },
    handler: function (request) {

        var now = Date.now();

        var post = function () {

            internals.load(request.params.id, request.auth.credentials.user, true, function (err, details, task, project) {

                if (err || !task) {
                    return request.reply(err);
                }

                var detail = request.payload;
                detail.created = now;
                detail.user = request.auth.credentials.user;

                if (details) {

                    // Existing details

                    Db.update('task.details', details._id, { $push: { thread: detail } }, function (err) {

                        if (err) {
                            return request.reply(err);
                        }

                        finalize(task, project);
                    });
                }
                else {

                    // First detail

                    details = { _id: task._id, project: project._id, thread: [] };
                    details.thread.push(detail);

                    Db.insert('task.details', details, function (err, items) {

                        if (err) {
                            return request.reply(err);
                        }

                        finalize(task, project);
                    });
                }
            });
        };

        var finalize = function (task, project) {

            if (request.query.last === 'true') {
                Last.setLast(request.auth.credentials.user, project, task, function (err) { });    // Ignore response
            }

            Stream.update({ object: 'details', project: task.project, task: task._id }, request);
            return request.reply({ status: 'ok' });
        };

        post();
    }
};


// Get details quick list

exports.expandIds = function (ids, projectId, userId, callback) {

    Db.getMany('task.details', ids, function (err, items, notFound) {

        if (err) {
            return callback([]);
        }

        Last.load(userId, function (err, last) {

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

                return callback(records);
            });
        });
    });
};


// Load task from database and check for user rights

internals.load = function (taskId, userId, isWritable, callback) {

    Task.load(taskId, userId, isWritable, function (err, task, project) {      // Check ownership

        if (err || !task) {
            return callback(err);
        }

        Db.get('task.details', taskId, function (err, item) {

            if (err) {
                return callback(err);
            }

            if (!item) {
                return callback(null, null, task, project);
            }

            return callback(null, item, task, project);
        });
    });
};

