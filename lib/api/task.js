// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var Project = require('./project');
var Sort = require('./sort');
var Suggestions = require('./suggestions');
var Details = require('./details');
var Stream = require('./stream');


// Task information

exports.get = {

    handler: function (request, reply) {

        exports.load(request.params.id, request.auth.credentials.user, false, function (err, task) {

            if (err || !task) {
                return reply(err);
            }

            Details.expandIds([request.params.id], task.project, request.auth.credentials.user, function (details) {

                if (details &&
                    details[request.params.id]) {

                    task.detailsModified = details[request.params.id].modified;
                    task.detailsModifiedBy = details[request.params.id].user;
                    task.last = details[request.params.id].last;
                }

                Hapi.utils.removeKeys(task, ['origin']);
                return reply(task);
            });
        });
    }
};


// Get list of tasks for given project

exports.list = {
    handler: function (request, reply) {

        Project.load(request.params.id, request.auth.credentials.user, false, function (err, project, member) {

            if (err || !project) {
                return reply(err);
            }

            Sort.list('task', request.params.id, 'project', function (err, tasks) {

                if (err || !tasks) {
                    return reply(Hapi.Error.notFound());
                }

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
                            if (tasks[i].participants[p] === request.auth.credentials.user) {
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

                Details.expandIds(ids, request.params.id, request.auth.credentials.user, function (details) {

                    if (details) {
                        for (var i = 0, il = list.length; i < il; ++i) {
                            if (details[list[i].id]) {
                                list[i].detailsModified = details[list[i].id].modified;
                                list[i].detailsModifiedBy = details[list[i].id].user;
                                list[i].last = details[list[i].id].last;
                            }
                        }
                    }

                    return reply(list);
                });
            });
        });
    }
};


// Update task properties

exports.post = {
    validate: {
        query: {
            position: Hapi.types.Number().min(0)
        },
        payload: {
            title: Hapi.types.String(),
            status: Hapi.types.String().valid('open', 'pending', 'close'),
            participants: Hapi.types.Array().includes(Hapi.types.String()) //!! .emptyOk()
        }
    },
    handler: function (request, reply) {

        exports.load(request.params.id, request.auth.credentials.user, true, function (err, task, project) {

            if (err || !task) {
                return reply(err);
            }

            if (Object.keys(request.payload).length > 0) {

                if (request.query.position) {
                    return reply(Hapi.Error.badRequest('Cannot include both position parameter and task object in body'));
                }

                // Task fields

                if (request.payload.participants &&
                    request.payload.participants.length > 0) {

                    // Verify participants are members of the project

                    var index = {};
                    for (var p = 0, pl = request.payload.participants.length; p < pl; ++p) {
                        if (index[request.payload.participants[p]]) {
                            return reply(Hapi.Error.badRequest('duplicate participant in list'));
                        }

                        if (Project.isMember(project, request.payload.participants[p]) === false) {
                            return reply(Hapi.Error.badRequest('user ' + request.payload.participants[p] + ' is not a member of the Project'));
                        }

                        index[request.payload.participants[p]] = true;
                    }
                }

                Db.update('task', task._id, Db.toChanges(request.payload), function (err) {

                    if (err) {
                        return reply(err);
                    }

                    Stream.update({ object: 'task', project: task.project, task: task._id }, request);
                    return reply({ status: 'ok' });
                });
            }
            else if (request.query.position !== null &&
                     request.query.position !== undefined) {        // Must test explicitly as value can be 0

                // Set task position in list

                Sort.set('task', task.project, 'project', request.params.id, request.query.position, function (err) {

                    if (err) {
                        return reply(err);
                    }

                    Stream.update({ object: 'tasks', project: task.project }, request);
                    return reply({ status: 'ok' });
                });
            }
            else {
                return reply(Hapi.Error.badRequest('Missing position parameter or task object in body'));
            }
        });
    }
};


// Create new task

exports.put = {
    validate: {
        query: {
            position: Hapi.types.Number(),
            suggestion: Hapi.types.String()
        },
        payload: {
            title: Hapi.types.String(),
            status: Hapi.types.String().valid('open', 'pending', 'close')
        }
    },
    handler: function (request, reply) {

        var check = function () {

            Project.load(request.params.id, request.auth.credentials.user, true, function (err, project, member) {

                if (err || !project) {
                    return reply(err);
                }

                if (request.query.suggestion) {

                    // From suggestion

                    if (request.rawBody) {
                        return reply(Hapi.Error.badRequest('New task cannot have both body and suggestion id'));
                    }

                    Suggestions.get(request.query.suggestion, function (suggestion) {

                        if (!suggestion) {
                            return reply(Hapi.Error.badRequest('Suggestion not found'));
                        }

                        var task = { title: suggestion.title, origin: { type: 'suggestion', suggestion: suggestion._id } };
                        addTask(task);
                    });
                }
                else {

                    // From body

                    if (!request.payload.title) {
                        return reply(Hapi.Error.badRequest('New task must include a title or a suggestion id'));
                    }

                    addTask(request.payload);
                }
            });
        };

        var addTask = function (task) {

            task.project = request.params.id;
            task.status = task.status || 'open';

            Db.insert('task', task, function (err, items) {

                if (err) {
                    return reply(err);
                }

                Stream.update({ object: 'tasks', project: task.project }, request);
                var result = { status: 'ok', id: items[0]._id };
                var created = 'task/' + items[0]._id;

                if (request.query.position === null ||
                    request.query.position === undefined) {        // Must test explicitly as value can be 0

                    return reply(result).created(created);
                }

                // Set task position in list

                Sort.set('task', task.project, 'project', result.id, request.query.position, function (err) {

                    if (!err) {
                        result.position = request.query.position;
                    }

                    return reply(result).created(created);
                });
            });
        };

        check();
    }
};


// Delete a task

exports.del = {
    handler: function (request, reply) {

        exports.load(request.params.id, request.auth.credentials.user, true, function (err, task) {

            if (err || !task) {
                return reply(err);
            }

            Db.remove('task', task._id, function (err) {

                if (err) {
                    return reply(err);
                }

                Db.remove('task.details', task._id, function (err) { });

                Stream.update({ object: 'tasks', project: task.project }, request);
                return reply({ status: 'ok' });
            });
        });
    }
};


// Load task from database and check for user rights

exports.load = function (taskId, userId, isWritable, callback) {

    Db.get('task', taskId, function (err, item) {

        if (err) {
            return callback(err);
        }

        if (!item) {
            return callback(Hapi.Error.notFound());
        }

        Project.load(item.project, userId, isWritable, function (err, project, member) {

            if (err || !project) {
                return callback(err);
            }

            return callback(null, item, project);
        });
    });
};


// Delete all tasks for a given project

exports.delProject = function (projectId, callback) {

    Db.removeCriteria('task', { project: projectId }, function (err) {

        if (err) {
            return callback(err);
        }

        Db.removeCriteria('task.details', { project: projectId }, function (err) {

            // Delete the sort list
            Sort.del('task', projectId, callback);
        });
    });
};


// List of tasks assigned to a user

exports.userTaskList = function (projectId, userId, callback) {

    Db.query('task', { project: projectId, participants: userId }, function (err, items) {

        if (err) {
            return callback(err);
        }

        return callback(null, items);
    });
};


// Count of tasks in a given project

exports.count = function (projectId, callback) {

    Db.count('task', { project: projectId }, function (err, count) {

        if (err) {
            return callback(err);
        }

        return callback(null, count);
    });
};


