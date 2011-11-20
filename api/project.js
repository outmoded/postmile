/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Db = require('./db');
var User = require('./user');
var Utils = require('hapi').Utils;
var Err = require('hapi').Error;
var Tips = require('./tips');
var Suggestions = require('./suggestions');
var Sort = require('./sort');
var Task = require('./task');
var Email = require('./email');
var Last = require('./last');
var Stream = require('./stream');


// Declare internals

var internals = {

    maxMessageLength: 250
};


// Project definitions

exports.type = {};

exports.type.post = {

    title:          { type: 'string' },
    date:           { type: 'date',     empty: true },
    time:           { type: 'time',     empty: true },
    place:          { type: 'string',   empty: true },
    participants:   { type: 'object',                   set: false, array: true }
};

exports.type.put = Utils.clone(exports.type.post);
exports.type.put.title.required = true;

exports.type.participants = {

    participants:   { type: 'id',       array: true },      // type can also be email
    names:          { type: 'string',   array: true }
};

exports.type.uninvite = {

    participants:   { type: 'id',       array: true,    required: true }
};


// Get project information

exports.get = function (req, res, next) {

    exports.load(req.params.id, req.api.userId, false, function (project, member, err) {

        if (project) {

            exports.participantsList(project, function (participants) {

                project.participants = participants;

                res.api.result = project;
                next();
            });
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Get list of projects for current user

exports.list = function (req, res, next) {

    Sort.list('project', req.api.userId, 'participants.id', function (projects) {

        if (projects) {

            var list = [];
            for (var i = 0, il = projects.length; i < il; ++i) {

                var isPending = false;
                for (var p = 0, pl = projects[i].participants.length; p < pl; ++p) {

                    if (projects[i].participants[p].id &&
                        projects[i].participants[p].id === req.api.userId) {

                        isPending = projects[i].participants[p].isPending || false;
                        break;
                    }
                }

                var item = { id: projects[i]._id, title: projects[i].title };

                if (isPending) {

                    item.isPending = true;
                }

                list.push(item);
            }

            Last.load(req.api.userId, function (last, err) {

                if (last &&
                    last.projects) {

                    for (i = 0, il = list.length; i < il; ++i) {

                        if (last.projects[list[i].id]) {

                            list[i].last = last.projects[list[i].id].last;
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
};


// Update project properties

exports.post = function (req, res, next) {

    exports.load(req.params.id, req.api.userId, true, function (project, member, err) {

        if (project) {

            if (Object.keys(req.body).length > 0) {

                if (req.query.position === undefined) {

                    Db.update('project', project._id, Db.toChanges(req.body), function (err) {

                        if (err === null) {

                            Stream.update({ object: 'project', project: project._id }, req);

                            if (req.body.title !== project.title) {

                                for (var i = 0, il = project.participants.length; i < il; ++i) {

                                    if (project.participants[i].id) {

                                        Stream.update({ object: 'projects', user: project.participants[i].id }, req);
                                    }
                                }
                            }

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

                    res.api.error = Err.badRequest('Cannot include both position parameter and project object in body');
                    next();
                }
            }
            else if (req.query.position) {

                Sort.set('project', req.api.userId, 'participants.id', req.params.id, req.query.position, function (err) {

                    if (err === null) {

                        Stream.update({ object: 'projects', user: req.api.userId }, req);
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

                res.api.error = Err.badRequest('Missing position parameter or project object in body');
                next();
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Create new project

exports.put = function (req, res, next) {

    var project = req.body;
    project.participants = [{ id: req.api.userId}];

    Db.insert('project', project, function (items, err) {

        if (err === null) {

            Stream.update({ object: 'projects', user: req.api.userId }, req);

            res.api.result = { status: 'ok', id: items[0]._id };
            res.api.created = '/project/' + items[0]._id;
            next();
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Delete a project

exports.del = function (req, res, next) {

    exports.load(req.params.id, req.api.userId, false, function (project, member, err) {

        if (project) {

            // Check if owner

            if (exports.isOwner(project, req.api.userId)) {

                // Delete all tasks

                Task.delProject(project._id, function (err) {

                    if (err === null) {

                        // Delete project

                        Db.remove('project', project._id, function (err) {

                            if (err === null) {

                                Last.delProject(req.api.userId, project._id, function (err) { });

                                Stream.update({ object: 'project', project: project._id }, req);

                                for (var i = 0, il = project.participants.length; i < il; ++i) {

                                    if (project.participants[i].id) {

                                        Stream.update({ object: 'projects', user: project.participants[i].id }, req);
                                        Stream.drop(project.participants[i].id, project._id);
                                    }
                                }

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
            }
            else {

                // Leave project

                internals.leave(project, member, function (err) {

                    if (err === null) {

                        Stream.update({ object: 'project', project: project._id }, req);
                        Stream.update({ object: 'projects', user: req.api.userId }, req);
                        Stream.drop(req.api.userId, project._id);

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

            res.api.error = err;
            next();
        }
    });
};


// Get list of project tips

exports.tips = function (req, res, next) {

    // Get project

    exports.load(req.params.id, req.api.userId, false, function (project, member, err) {

        if (project) {

            // Collect tips

            Tips.list(project, function (results) {

                res.api.result = results;
                next();
            });
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Get list of project suggestions

exports.suggestions = function (req, res, next) {

    // Get project

    exports.load(req.params.id, req.api.userId, false, function (project, member, err) {

        if (project) {

            // Collect tips

            Suggestions.list(project, req.api.userId, function (results) {

                res.api.result = results;
                next();
            });
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Add new participants to a project

exports.participants = function (req, res, next) {

    if (req.query.message) {

        if (req.query.message.length <= internals.maxMessageLength) {

            if (req.query.message.match('://') === null) {

                process();
            }
            else {

                res.api.error = Err.badRequest('Message cannot contain links');
                next();
            }
        }
        else {

            res.api.error = Err.badRequest('Message length is greater than ' + internals.maxMessageLength);
            next();
        }
    }
    else {

        process();
    }

    function process() {

        if (req.body.participants ||
            req.body.names) {

            exports.load(req.params.id, req.api.userId, true, function (project, member, err) {

                if (project) {

                    var change = { $pushAll: { participants: []} };

                    // Add pids (non-users)

                    if (req.body.names) {

                        for (var i = 0, il = req.body.names.length; i < il; ++i) {

                            var participant = { pid: Db.generateId(), display: req.body.names[i] };
                            change.$pushAll.participants.push(participant);
                        }

                        if (req.body.participants === undefined) {

                            // No user accounts to invite, save project

                            Db.update('project', project._id, change, function (err) {

                                if (err === null) {

                                    // Return success

                                    reply();
                                }
                                else {

                                    res.api.error = err;
                                    next();
                                }
                            });
                        }
                    }

                    // Add users or emails

                    if (req.body.participants) {

                        // Get user

                        User.load(req.api.userId, function (user, err) {

                            if (user) {

                                // Lookup existing users

                                User.find(req.body.participants, function (users, emailsNotFound, err) {

                                    if (err === null) {

                                        var prevParticipants = Utils.map(project.participants, 'id');

                                        // Check for changes

                                        var contactsChange = { $set: {} };
                                        var now = Utils.getTimestamp();

										var changedUsers = [];
                                        for (var i = 0, il = users.length; i < il; ++i) {

                                            // Add / update contact

                                            if (users[i]._id !== req.api.userId) {

                                                contactsChange.$set['contacts.' + users[i]._id] = { type: 'user', last: now };
                                            }

                                            // Add participant if new

                                            if (prevParticipants[users[i]._id] !== true) {

                                                change.$pushAll.participants.push({ id: users[i]._id, isPending: true });
												changedUsers.push(users[i]);
                                            }
                                        }

                                        var prevPids = Utils.map(project.participants, 'email');

                                        var pids = [];
                                        for (i = 0, il = emailsNotFound.length; i < il; ++i) {

                                            contactsChange.$set['contacts.' + Db.encodeKey(emailsNotFound[i])] = { type: 'email', last: now };

                                            if (prevPids[emailsNotFound[i]] !== true) {

                                                var pid = {

                                                    pid: Db.generateId(),
                                                    display: emailsNotFound[i],
                                                    isPending: true,

                                                    // Internal fields

                                                    email: emailsNotFound[i],
                                                    code: Utils.getRandomString(6),
                                                    inviter: user._id
                                                };

                                                change.$pushAll.participants.push(pid);
                                                pids.push(pid);
                                            }
                                        }

                                        // Update user contacts

                                        if (Object.keys(contactsChange.$set).length > 0) {

                                            Db.update('user', user._id, contactsChange, function (err) {

                                                // Non-blocking

                                                if (err === null) {

                                                    Stream.update({ object: 'contacts', user: user._id }, req);
                                                }
                                            });
                                        }

                                        // Update project participants

                                        if (change.$pushAll.participants.length > 0) {

                                            Db.update('project', project._id, change, function (err) {

                                                if (err === null) {

                                                    for (var i = 0, il = changedUsers.length; i < il; ++i) {

                                                        Stream.update({ object: 'projects', user: changedUsers[i]._id }, req);
                                                    }

                                                    // Invite new participants

                                                    Email.projectInvite(changedUsers, pids, project, req.query.message, user);

                                                    // Return success

                                                    reply();
                                                }
                                                else {

                                                    res.api.error = err;
                                                    next();
                                                }
                                            });
                                        }
                                        else {

                                            res.api.error = Err.badRequest('All users are already project participants');
                                            next();
                                        }
                                    }
                                    else {

                                        res.api.error = err;
                                        next();
                                    }
                                });
                            }
                            else {

                                res.api.error = Err.internal(err);
                                next();
                            }
                        });
                    }
                }
                else {

                    res.api.error = err;
                    next();
                }
            });
        }
        else {

            res.api.error = Err.badRequest('Body must contain a participants or names array');
            next();
        }
    }

    function reply() {

        Stream.update({ object: 'project', project: req.params.id }, req);

        // Reload project (changed, use direct DB to skip load processing)

        Db.get('project', req.params.id, function (project, err) {

            if (project) {

                exports.participantsList(project, function (participants) {

                    var response = { status: 'ok', participants: participants };

                    res.api.result = response;
                    next();
                });
            }
            else {

                res.api.error = err;
                next();
            }
        });
    }
};


// Remove participant from project

exports.uninvite = function (req, res, next) {

    // Load project for write

    exports.load(req.params.id, req.api.userId, true, function (project, member, err) {

        if (project) {

            // Check if owner

            if (exports.isOwner(project, req.api.userId)) {

                // Check if single delete or batch

                if (req.params.user) {

                    // Single delete

                    if (req.api.userId !== req.params.user) {

                        // Lookup user

                        var uninvitedMember = exports.getMember(project, req.params.user);
                        if (uninvitedMember) {

                            internals.leave(project, uninvitedMember, function (err) {

                                if (err === null) {

                                    // Return success

                                    Stream.update({ object: 'projects', user: req.params.user }, req);
                                    Stream.drop(req.params.user, project._id);

                                    reply();
                                }
                                else {

                                    res.api.error = err;
                                    next();
                                }
                            });
                        }
                        else {

                            res.api.error = Err.notFound('Not a project participant');
                            next();
                        }
                    }
                    else {

                        res.api.error = Err.badRequest('Cannot uninvite self');
                        next();
                    }
                }
                else if (req.body.participants) {

                    // Batch delete

                    var error = null;
                    var uninvitedMembers = [];

                    for (var i = 0, il = req.body.participants.length; i < il; ++i) {

                        var removeId = req.body.participants[i];

                        if (req.api.userId !== removeId) {

                            // Lookup user

                            var uninvited = exports.getMember(project, removeId);
                            if (uninvited) {

                                uninvitedMembers.push(uninvited);
                            }
                            else {

                                error = Err.notFound('Not a project participant: ' + removeId);
                                break;
                            }
                        }
                        else {

                            error = Err.badRequest('Cannot uninvite self');
                            break;
                        }
                    }

                    if (uninvitedMembers.length === 0) {

                        error = Err.badRequest('No members to remove');
                    }

                    if (error === null) {

                        // Batch leave

                        batch(project, uninvitedMembers, 0, function (err) {

                            if (err === null) {

                                // Return success

                                reply();
                            }
                            else {

                                res.api.error = err;
                                next();
                            }
                        });
                    }
                    else {

                        res.api.error = error;
                        next();
                    }
                }
                else {

                    res.api.error = Err.badRequest('No participant for removal included');
                    next();
                }
            }
            else {

                res.api.error = Err.badRequest('Not an owner');
                next();
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });

    function batch(project, members, pos, callback) {

        if (pos >= members.length) {

            callback(null);
        }
        else {

            internals.leave(project, members[pos], function (err) {

                if (err === null) {

                    // Return success

                    if (members[pos].id) {

                        Stream.update({ object: 'projects', user: members[pos].id }, req);
                        Stream.drop(members[pos].id, project._id);
                    }

                    batch(project, members, pos + 1, callback);
                }
                else {

                    callback(err);
                }
            });
        }
    }

    function reply() {

        Stream.update({ object: 'project', project: req.params.id }, req);

        // Reload project (changed, use direct DB to skip load processing)

        Db.get('project', req.params.id, function (project, err) {

            if (project) {

                exports.participantsList(project, function (participants) {

                    var response = { status: 'ok', participants: participants };

                    res.api.result = response;
                    next();
                });
            }
            else {

                res.api.error = err;
                next();
            }
        });
    }
};


// Accept project invitation

exports.join = function (req, res, next) {

    // The only place allowed to request a non-writable copy for modification
    exports.load(req.params.id, req.api.userId, false, function (project, member, err) {

        if (project) {

            // Verify user is pending

            if (member.isPending) {

                Db.updateCriteria('project', project._id, { 'participants.id': req.api.userId }, { $unset: { 'participants.$.isPending': 1} }, function (err) {

                    if (err === null) {

                        // Return success

                        Stream.update({ object: 'project', project: project._id }, req);
                        Stream.update({ object: 'projects', user: req.api.userId }, req);

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

                res.api.error = Err.badRequest('Already a member of the project');
                next();
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Load project from database and check for user rights

exports.load = function (projectId, userId, isWritable, callback) {

    Db.get('project', projectId, function (item, err) {

        if (item) {

            var member = null;
            for (var i = 0, il = item.participants.length; i < il; ++i) {

                if (item.participants[i].id &&
                    item.participants[i].id === userId) {

                    member = item.participants[i];
                    if (member.isPending) {

                        item.isPending = true;
                    }

                    break;
                }
            }

            if (member) {

                if (isWritable === false ||
                    item.isPending !== true) {

                    callback(item, member, null);
                }
                else {

                    // Invitation pending
                    callback(null, null, Err.forbidden('Must accept project invitation before making changes'));
                }
            }
            else {

                // Not allowed
                callback(null, null, Err.forbidden('Not a project member'));
            }
        }
        else {

            if (err === null) {

                callback(null, null, Err.notFound());
            }
            else {

                callback(null, null, err);
            }
        }
    });
};


// Get participants list

exports.participantsList = function (project, callback) {

    var userIds = [];
    for (var i = 0, il = project.participants.length; i < il; ++i) {

        if (project.participants[i].id) {

            userIds.push(project.participants[i].id);
        }
    }

    User.expandIds(userIds, function (users, usersMap) {

        var participants = [];
        for (var i = 0, il = project.participants.length; i < il; ++i) {

            var participant = null;

            if (project.participants[i].id) {

                // Registered user participant

                participant = usersMap[project.participants[i].id];
            }
            else if (project.participants[i].pid) {

                // Non-user participant

                participant = {

                    id: 'pid:' + project.participants[i].pid,
                    display: project.participants[i].display,
                    isPid: true
                };
            }

            if (participant) {

                if (project.participants[i].isPending) {

                    participant.isPending = project.participants[i].isPending;
                }

                participants.push(participant);
            }
        }

        callback(participants);
    });
};


// Get participants map

exports.participantsMap = function (project) {

    var participants = { users: {}, emails: {} };

    for (var i = 0, il = project.participants.length; i < il; ++i) {

        if (project.participants[i].id) {

            // Registered user participant

            participants.users[project.participants[i].id] = true;
        }
        else if (project.participants[i].email) {

            // Non-user email-invited participant

            participants.emails[project.participants[i].email] = true;
        }
    }

    return participants;
};


// Get member

exports.getMember = function (project, userId) {

    var isPid = userId.indexOf('pid:') === 0;
    if (isPid) {

        userId = userId.substring(4);           // Remove 'pid:' prefix
    }

    for (var i = 0, il = project.participants.length; i < il; ++i) {

        if (isPid &&
            project.participants[i].pid &&
            project.participants[i].pid === userId) {

            return project.participants[i];
        }
        else if (project.participants[i].id &&
                 project.participants[i].id === userId) {

            return project.participants[i];
        }
    }

    return null;
};


// Check if member

exports.isMember = function (project, userId) {

    return (exports.getMember(project, userId) !== null);
};


// Check if owner

exports.isOwner = function (project, userId) {

    return (project.participants[0].id && project.participants[0].id === userId);
};


// Leave project

internals.leave = function (project, member, callback) {

    var isPid = (member.pid !== null && member.pid !== undefined);
    var userId = (isPid ? member.pid : member.id);

    // Check if user is assigned tasks

    Task.userTaskList(project._id, (isPid ? 'pid:' + userId : userId), function (tasks, err) {

        if (err === null) {

            if (tasks.length > 0) {

                // Check if removing a pid

                if (isPid === false) {

                    // Load user

                    User.load(userId, function (user, err) {

                        if (user) {

                            // Add unregistered project account (pid)

                            var display = (user.name ? user.name
                                                     : (user.username ? user.username
                                                                      : (user.emails && user.emails[0] && user.emails[0].address ? user.emails[0].address : null)));

                            var participant = { pid: Db.generateId(), display: display };

                            // Move any assignments to pid account (not details) and save tasks

                            var taskCriteria = { project: project._id, participants: userId };
                            var taskChange = { $set: { 'participants.$': 'pid:' + participant.pid} };
                            Db.updateCriteria('task', null, taskCriteria, taskChange, function (err) {

                                if (err === null) {

                                    // Save project

                                    Db.updateCriteria('project', project._id, { 'participants.id': userId }, { $set: { 'participants.$': participant} }, function (err) {

                                        if (err === null) {

                                            // Cleanup last information

                                            Last.delProject(userId, project._id, function (err) { });

                                            callback(null);
                                        }
                                        else {

                                            callback(err);
                                        }
                                    });
                                }
                                else {

                                    callback(err);
                                }
                            });
                        }
                        else {

                            callback(err);
                        }
                    });
                }
                else {

                    // Remove pid

                    if (member.isPending) {

                        // Remove invitation from pid

                        var participant = { pid: member.pid, display: member.display };
                        Db.updateCriteria('project', project._id, { 'participants.pid': userId }, { $set: { 'participants.$': participant } }, function (err) {

                            callback(err);
                        });
                    }
                    else {

                        callback(Err.badRequest('Cannot remove pid user with task assignments'));
                    }
                }
            }
            else {

                var change = { $pull: { participants: {}} };
                change.$pull.participants[isPid ? 'pid' : 'id'] = userId;

                Db.update('project', project._id, change, function (err) {

                    if (err === null) {

                        if (isPid === false) {

                            // Cleanup last information

                            Last.delProject(userId, project._id, function (err) { });
                        }

                        callback(null);
                    }
                    else {

                        callback(err);
                    }
                });
            }
        }
        else {

            callback(err);
        }
    });
};


// Replace pid with actual user

exports.replacePid = function (project, pid, userId, callback) {

    // Move any assignments to pid account (not details) and save tasks

    var taskCriteria = { project: project._id, participants: 'pid:' + pid };
    var taskChange = { $set: { 'participants.$': userId} };
    Db.updateCriteria('task', null, taskCriteria, taskChange, function (err) {

        if (err === null) {

            // Check if user already a member

            if (exports.isMember(project, userId)) {

                // Remove Pid without adding

                Db.update('project', project._id, { $pull: { participants: { pid: pid}} }, function (err) {

                    if (err === null) {

                        callback(null);
                    }
                    else {

                        callback(err);
                    }
                });
            }
            else {

                // Replace pid with user

                Db.updateCriteria('project', project._id, { 'participants.pid': pid }, { $set: { 'participants.$': { id: userId}} }, function (err) {

                    if (err === null) {

                        callback(null);
                    }
                    else {

                        callback(err);
                    }
                });
            }
        }
        else {

            callback(err);
        }
    });
};


// Unsorted list

exports.unsortedList = function (userId, callback) {

    Db.query('project', { 'participants.id': req.api.userId }, function (projects, err) {

        if (err === null) {

            if (projects.length > 0) {

                var owner = [];
                var notOwner = [];

                for (var i = 0, il = projects.length; i < il; ++i) {

                    for (var p = 0, pl = projects[i].participants.length; p < pl; ++p) {

                        if (projects[i].participants[p].id &&
                            projects[i].participants[p].id === req.api.userId) {

                            projects[i]._isPending = projects[i].participants[p].isPending || false;

                            if (i == 0) {

                                projects[i]._isOwner = true;
                                owner.push(projects[i]);
                            }
                            else {

                                projects[i]._isOwner = false;
                                notOwner.push(projects[i]);
                            }

                            break;
                        }
                    }
                }

                callback(projects, owner, notOwner, null);
            }
            else {

                callback([], [], [], null);
            }
        }
        else {

            callback(null, null, null, err);
        }
    });
};


// Delete an empty project (verified by caller)

exports.delEmpty = function (projectId, callback) {

    // Delete all tasks

    Task.delProject(projectId, function (err) {

        if (err === null) {

            // Delete project

            Db.remove('project', project._id, function (err) {

                callback(err);
            });
        }
        else {

            callback(err);
        }
    });
};


