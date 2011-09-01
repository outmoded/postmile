/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Db = require('./db');
var Err = require('./error');
var Utils = require('./utils');
var Project = require('./project');
var Task = require('./task');


// Declare internals

var internals = {};


// Last information for project (with tasks)

exports.getProject = function (req, res, next) {

    exports.load(req.api.userId, function (last, err) {

        if (last &&
            last.projects &&
            last.projects[req.params.id]) {

            var record = { id: last._id, projects: {} };
            record.projects[req.params.id] = last.projects[req.params.id];

            res.api.result = record;
            next();
        }
        else if (err === null) {

            res.api.result = { id: req.api.userId, projects: {} };
            next();
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Set last project timestamp

exports.postProject = function (req, res, next) {

    Project.load(req.params.id, req.api.userId, false, function (project, member, err) {

        if (project) {

            exports.setLast(req.api.userId, project, null, function (err) {

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

    Task.load(req.params.id, req.api.userId, false, function (task, err, project) {

        if (task) {

            exports.load(req.api.userId, function (last, err) {

                if (last &&
                    last.projects &&
                    last.projects[task.project] &&
                    last.projects[task.project].tasks &&
                    last.projects[task.project].tasks[req.params.id]) {

                    var record = { id: last._id, projects: {} };
                    record.projects[task.project] = { tasks: {} };
                    record.projects[task.project].tasks[req.params.id] = last.projects[task.project].tasks[req.params.id];

                    res.api.result = record;
                    next();
                }
                else if (err === null) {

                    res.api.result = { id: req.api.userId, projects: {} };
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

    Task.load(req.params.id, req.api.userId, false, function (task, err, project) {

        if (task) {

            exports.setLast(req.api.userId, project, task, function (err) {

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


// Clear project last

exports.delProject = function (userId, projectId, callback) {

    exports.load(userId, function (last, err) {

        if (last &&
            last.projects &&
            last.projects[projectId]) {

            var changes = { $unset: {} };
            changes.$unset['projects.' + projectId] = 1;

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

exports.setLast = function (userId, project, task, callback) {

    var now = Utils.getTimestamp();

    exports.load(userId, function (last, err) {

        if (err === null) {

            if (last) {

                // Existing last record

                var changes = { $set: {} };

                if (task === null) {

                    // Project last: last->projects.{projectId}.last

                    if (last.projects) {

                        if (last.projects[project._id]) {

                            changes.$set['projects.' + project._id + '.last'] = now;
                        }
                        else {

                            changes.$set['projects.' + project._id] = { tasks: {}, last: now };
                        }
                    }
                    else {

                        changes.$set.projects = {};
                        changes.$set.projects[project._id] = { tasks: {}, last: now };
                    }
                }
                else {

                    // Task last: last->projects.{projectId}.tasks.{taskId}

                    if (last.projects) {

                        if (last.projects[project._id]) {

                            if (last.projects[project._id].tasks) {

                                changes.$set['projects.' + project._id + '.tasks.' + task._id] = now;
                            }
                            else {

                                changes.$set['projects.' + project._id + '.tasks'] = {};
                                changes.$set['projects.' + project._id + '.tasks'][task._id] = now;
                            }
                        }
                        else {

                            changes.$set['projects.' + project._id] = { tasks: {} };
                            changes.$set['projects.' + project._id].tasks[task._id] = now;
                        }
                    }
                    else {

                        changes.$set.projects = {};
                        changes.$set.projects[project._id] = { tasks: {} };
                        changes.$set.projects[project._id].tasks[task._id] = now;
                    }
                }

                Db.update('user.last', last._id, changes, function (err) {

                    callback(err);
                });
            }
            else {

                // First last timestamp

                last = { _id: userId, projects: {} };
                last.projects[project._id] = { tasks: {} };

                if (task === null) {

                    last.projects[project._id].last = now;
                }
                else {

                    last.projects[project._id].tasks[task._id] = now;
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



