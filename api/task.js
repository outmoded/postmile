/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Db = require('./db');
var Utils = require('hapi').Utils;
var Project = require('./project');
var Sort = require('./sort');
var Err = require('hapi').Error;
var Suggestions = require('./suggestions');
var Details = require('./details');
var Stream = require('./stream');


// Task definition

exports.type = {};

exports.type.post = {

    project:           { type: 'id',       set: false },
    title:          { type: 'string' },
    status:         { type: 'enum',                    values: { open: 1, pending: 2, close: 3 } },
    participants:   { type: 'id',                      array: true, empty: true },
    origin:         { type: 'object',   set: false,    hide: true }
};

exports.type.put = Utils.clone(exports.type.post);
exports.type.put.participants.set = false;


// Task information

exports.get = function (req, res, next) {

    exports.load(req.params.id, req.api.userId, false, function (task, err) {

        if (task) {

            Details.expandIds([req.params.id], task.project, req.api.userId, function (details) {

                if (details &&
                    details[req.params.id]) {

                    task.detailsModified = details[req.params.id].modified;
                    task.detailsModifiedBy = details[req.params.id].user;
                    task.last = details[req.params.id].last;
                }

                Utils.hide(task, exports.type.post);
                res.api.result = task;
                next();
            });
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Get list of tasks for given project

exports.list = function (req, res, next) {

    Project.load(req.params.id, req.api.userId, false, function (project, member, err) {

        if (project) {

            Sort.list('task', req.params.id, 'project', function (tasks) {

                if (tasks) {

                    var list = [];
                    var ids = [];

                    for (var i = 0, il = tasks.length; i < il; ++i) {

                        var task = {

                            id: tasks[i]._id,
                            title: tasks[i].title,
                            status: tasks[i].status
                        };

                        if (tasks[i].participants) {

                            for (var p = 0, pl = tasks[i].participants.length; p < pl; ++p) {

                                if (tasks[i].participants[p] === req.api.userId) {

                                    task.isMe = true;
                                    break;
                                }
                            }

                            task.participantsCount = tasks[i].participants.length;
                        }
                        else {

                            task.participantsCount = 0;
                        }

                        list.push(task);
                        ids.push(tasks[i]._id);
                    }

                    Details.expandIds(ids, req.params.id, req.api.userId, function (details) {

                        if (details) {

                            for (var i = 0, il = list.length; i < il; ++i) {

                                if (details[list[i].id]) {

                                    list[i].detailsModified = details[list[i].id].modified;
                                    list[i].detailsModifiedBy = details[list[i].id].user;
                                    list[i].last = details[list[i].id].last;
                                }
                            }
                        }

                        res.api.result = list;
                        next();
                    });
                }
                else {

                    res.api.error = Err.notFound();
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


// Update task properties

exports.post = function (req, res, next) {

    exports.load(req.params.id, req.api.userId, true, function (task, err, project) {

        if (task) {

            if (Object.keys(req.body).length > 0) {

                if (req.query.position === undefined) {

                    // Task fields

                    var isInvalid = false;

                    if (req.body.participants &&
                        req.body.participants.length > 0) {

                        // Verify participants are members of the project

                        var error = null;
                        var index = {};

                        for (var p = 0, pl = req.body.participants.length; p < pl; ++p) {

                            if (index[req.body.participants[p]] !== true) {

                                index[req.body.participants[p]] = true;

                                if (Project.isMember(project, req.body.participants[p]) === false) {

                                    error = 'user ' + req.body.participants[p] + ' is not a member of the Project';
                                    break;
                                }
                            }
                            else {

                                error = 'duplicate participant in list';
                                break;
                            }
                        }

                        if (error) {

                            isInvalid = true;
                            res.api.error = Err.badRequest(error);
                            next();
                        }
                    }

                    if (isInvalid === false) {

                        Db.update('task', task._id, Db.toChanges(req.body), function (err) {

                            if (err === null) {

                                Stream.update({ object: 'task', project: task.project, task: task._id }, req);
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

                    res.api.error = Err.badRequest('Cannot include both position parameter and task object in body');
                    next();
                }
            }
            else if (req.query.position !== null &&
                     req.query.position !== undefined) {        // Must test explicitly as value can be 0

                // Set task position in list

                Sort.set('task', task.project, 'project', req.params.id, req.query.position, function (err) {

                    if (err === null) {

                        Stream.update({ object: 'tasks', project: task.project }, req);
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

                res.api.error = Err.badRequest('Missing position parameter or task object in body');
                next();
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Create new task

exports.put = function (req, res, next) {

    Project.load(req.params.id, req.api.userId, true, function (project, member, err) {

        if (project) {

            if (req.query.suggestion) {

                // From suggestion

                if (!req.rawBody) {

                    Suggestions.get(req.query.suggestion, function (suggestion) {

                        if (suggestion) {

                            var task = { title: suggestion.title, origin: { type: 'suggestion', suggestion: suggestion._id} };
                            addTask(task);
                        }
                        else {

                            res.api.error = Err.badRequest('Suggestion not found');
                            next();
                        }
                    });
                }
                else {

                    res.api.error = Err.badRequest('New task cannot have both body and suggestion id');
                    next();
                }
            }
            else {

                // From body

                if (req.body.title) {

                    addTask(req.body);
                }
                else {

                    res.api.error = Err.badRequest('New task must include a title or a suggestion id');
                    next();
                }
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });

    function addTask(task) {

        task.project = req.params.id;
        task.status = task.status || 'open';

        Db.insert('task', task, function (items, err) {

            if (err === null) {

                Stream.update({ object: 'tasks', project: task.project }, req);
                res.api.result = { status: 'ok', id: items[0]._id };
                res.api.created = '/task/' + items[0]._id;

                if (req.query.position !== null &&
                    req.query.position !== undefined) {        // Must test explicitly as value can be 0

                    // Set task position in list

                    Sort.set('task', task.project, 'project', res.api.result.id, req.query.position, function (err) {

                        if (err === null) {

                            res.api.result.position = req.query.position;
                        }

                        next();
                    });
                }
                else {

                    next();
                }
            }
            else {

                res.api.error = err;
                next();
            }
        });
    }
};


// Delete a task

exports.del = function (req, res, next) {

    exports.load(req.params.id, req.api.userId, true, function (task, err) {

        if (task) {

            Db.remove('task', task._id, function (err) {

                if (err === null) {

                    Db.remove('task.details', task._id, function (err) { });

                    Stream.update({ object: 'tasks', project: task.project }, req);
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


// Load task from database and check for user rights

exports.load = function (taskId, userId, isWritable, callback) {

    Db.get('task', taskId, function (item, err) {

        if (item) {

            Project.load(item.project, userId, isWritable, function (project, member, err) {

                if (project) {

                    callback(item, null, project);
                }
                else {

                    callback(null, err, null);
                }
            });
        }
        else {

            if (err === null) {

                callback(null, Err.notFound(), null);
            }
            else {

                callback(null, err, null);
            }
        }
    });
};


// Delete all tasks for a given project

exports.delProject = function (projectId, callback) {

    Db.removeCriteria('task', { project: projectId }, function (err) {

        if (err === null) {

            Db.removeCriteria('task.details', { project: projectId }, function (err) {

                // Delete the sort list

                Sort.del('task', projectId, callback);
            });
        }
        else {

            callback(err);
        }
    });
};


// List of tasks assigned to a user

exports.userTaskList = function (projectId, userId, callback) {

    Db.query('task', { project: projectId, participants: userId }, function (items, err) {

        if (err === null) {

            callback(items, null);
        }
        else {

            callback(null, err);
        }
    });
};


// Count of tasks in a given project

exports.count = function (projectId, callback) {

    Db.count('task', { project: projectId }, function (count, err) {

        if (err === null) {

            callback(count, null);
        }
        else {

            callback(null, err);
        }
    });
};


