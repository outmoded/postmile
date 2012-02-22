/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var User = require('./user');
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

exports.type.put = Hapi.Utils.clone(exports.type.post);
exports.type.put.title.required = true;

exports.type.participants = {

    participants:   { type: 'id',       array: true },      // type can also be email
    names:          { type: 'string',   array: true }
};

exports.type.uninvite = {

    participants:   { type: 'id',       array: true,    required: true }
};


// Get project information

exports.get = function (request, reply) {

    exports.load(request.params.id, request.userId, false, function (project, member, err) {

        if (project) {

            exports.participantsList(project, function (participants) {

                project.participants = participants;

                reply(project);
            });
        }
        else {

            reply(err);
        }
    });
};


// Get list of projects for current user

exports.list = function (request, reply) {

    Sort.list('project', request.userId, 'participants.id', function (projects) {

        if (projects) {

            var list = [];
            for (var i = 0, il = projects.length; i < il; ++i) {

                var isPending = false;
                for (var p = 0, pl = projects[i].participants.length; p < pl; ++p) {

                    if (projects[i].participants[p].id &&
                        projects[i].participants[p].id === request.userId) {

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

            Last.load(request.userId, function (last, err) {

                if (last &&
                    last.projects) {

                    for (i = 0, il = list.length; i < il; ++i) {

                        if (last.projects[list[i].id]) {

                            list[i].last = last.projects[list[i].id].last;
                        }
                    }
                }

                reply(list);
            });
        }
        else {

            reply(Hapi.Error.notFound());
        }
    });
};


// Update project properties

exports.post = function (request, reply) {

    exports.load(request.params.id, request.userId, true, function (project, member, err) {

        if (project) {

            if (Object.keys(request.payload).length > 0) {

                if (request.query.position === undefined) {

                    Db.update('project', project._id, Db.toChanges(request.payload), function (err) {

                        if (err === null) {

                            Stream.update({ object: 'project', project: project._id }, request);

                            if (request.payload.title !== project.title) {

                                for (var i = 0, il = project.participants.length; i < il; ++i) {

                                    if (project.participants[i].id) {

                                        Stream.update({ object: 'projects', user: project.participants[i].id }, request);
                                    }
                                }
                            }

                            reply({ status: 'ok' });
                        }
                        else {

                            reply(err);
                        }
                    });
                }
                else {

                    reply(Hapi.Error.badRequest('Cannot include both position parameter and project object in body'));
                }
            }
            else if (request.query.position) {

                Sort.set('project', request.userId, 'participants.id', request.params.id, request.query.position, function (err) {

                    if (err === null) {

                        Stream.update({ object: 'projects', user: request.userId }, request);
                        reply({ status: 'ok' });
                    }
                    else {

                        reply(err);
                    }
                });
            }
            else {

                reply(Hapi.Error.badRequest('Missing position parameter or project object in body'));
            }
        }
        else {

            reply(err);
        }
    });
};


// Create new project

exports.put = function (request, reply) {

    var project = request.payload;
    project.participants = [{ id: request.userId}];

    Db.insert('project', project, function (items, err) {

        if (err === null) {

            Stream.update({ object: 'projects', user: request.userId }, request);
            reply({ status: 'ok', id: items[0]._id }, { created: 'project/' + items[0]._id });
        }
        else {

            reply(err);
        }
    });
};


// Delete a project

exports.del = function (request, reply) {

    exports.load(request.params.id, request.userId, false, function (project, member, err) {

        if (project) {

            // Check if owner

            if (exports.isOwner(project, request.userId)) {

                // Delete all tasks

                Task.delProject(project._id, function (err) {

                    if (err === null) {

                        // Delete project

                        Db.remove('project', project._id, function (err) {

                            if (err === null) {

                                Last.delProject(request.userId, project._id, function (err) { });

                                Stream.update({ object: 'project', project: project._id }, request);

                                for (var i = 0, il = project.participants.length; i < il; ++i) {

                                    if (project.participants[i].id) {

                                        Stream.update({ object: 'projects', user: project.participants[i].id }, request);
                                        Stream.drop(project.participants[i].id, project._id);
                                    }
                                }

                                reply({ status: 'ok' });
                            }
                            else {

                                reply(err);
                            }
                        });
                    }
                    else {

                        reply(err);
                    }
                });
            }
            else {

                // Leave project

                internals.leave(project, member, function (err) {

                    if (err === null) {

                        Stream.update({ object: 'project', project: project._id }, request);
                        Stream.update({ object: 'projects', user: request.userId }, request);
                        Stream.drop(request.userId, project._id);

                        reply({ status: 'ok' });
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
    });
};


// Get list of project tips

exports.tips = function (request, reply) {

    // Get project

    exports.load(request.params.id, request.userId, false, function (project, member, err) {

        if (project) {

            // Collect tips

            Tips.list(project, function (results) {

                reply(results);
            });
        }
        else {

            reply(err);
        }
    });
};


// Get list of project suggestions

exports.suggestions = function (request, reply) {

    // Get project

    exports.load(request.params.id, request.userId, false, function (project, member, err) {

        if (project) {

            // Collect tips

            Suggestions.list(project, request.userId, function (results) {

                reply(results);
            });
        }
        else {

            reply(err);
        }
    });
};


// Add new participants to a project

exports.participants = function (request, reply) {

    if (request.query.message) {

        if (request.query.message.length <= internals.maxMessageLength) {

            if (request.query.message.match('://') === null) {

                process();
            }
            else {

                reply(Hapi.Error.badRequest('Message cannot contain links'));
            }
        }
        else {

            reply(Hapi.Error.badRequest('Message length is greater than ' + internals.maxMessageLength));
        }
    }
    else {

        process();
    }

    function process() {

        if (request.payload.participants ||
            request.payload.names) {

            exports.load(request.params.id, request.userId, true, function (project, member, err) {

                if (project) {

                    var change = { $pushAll: { participants: []} };

                    // Add pids (non-users)

                    if (request.payload.names) {

                        for (var i = 0, il = request.payload.names.length; i < il; ++i) {

                            var participant = { pid: Db.generateId(), display: request.payload.names[i] };
                            change.$pushAll.participants.push(participant);
                        }

                        if (request.payload.participants === undefined) {

                            // No user accounts to invite, save project

                            Db.update('project', project._id, change, function (err) {

                                if (err === null) {

                                    // Return success

                                    finalize();
                                }
                                else {

                                    reply(err);
                                }
                            });
                        }
                    }

                    // Add users or emails

                    if (request.payload.participants) {

                        // Get user

                        User.load(request.userId, function (user, err) {

                            if (user) {

                                // Lookup existing users

                                User.find(request.payload.participants, function (users, emailsNotFound, err) {

                                    if (err === null) {

                                        var prevParticipants = Hapi.Utils.map(project.participants, 'id');

                                        // Check for changes

                                        var contactsChange = { $set: {} };
                                        var now = Hapi.Utils.getTimestamp();

										var changedUsers = [];
                                        for (var i = 0, il = users.length; i < il; ++i) {

                                            // Add / update contact

                                            if (users[i]._id !== request.userId) {

                                                contactsChange.$set['contacts.' + users[i]._id] = { type: 'user', last: now };
                                            }

                                            // Add participant if new

                                            if (prevParticipants[users[i]._id] !== true) {

                                                change.$pushAll.participants.push({ id: users[i]._id, isPending: true });
												changedUsers.push(users[i]);
                                            }
                                        }

                                        var prevPids = Hapi.Utils.map(project.participants, 'email');

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
                                                    code: Hapi.Utils.getRandomString(6),
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

                                                    Stream.update({ object: 'contacts', user: user._id }, request);
                                                }
                                            });
                                        }

                                        // Update project participants

                                        if (change.$pushAll.participants.length > 0) {

                                            Db.update('project', project._id, change, function (err) {

                                                if (err === null) {

                                                    for (var i = 0, il = changedUsers.length; i < il; ++i) {

                                                        Stream.update({ object: 'projects', user: changedUsers[i]._id }, request);
                                                    }

                                                    // Invite new participants

                                                    Email.projectInvite(changedUsers, pids, project, request.query.message, user);

                                                    // Return success

                                                    finalize();
                                                }
                                                else {

                                                    reply(err);
                                                }
                                            });
                                        }
                                        else {

                                            reply(Hapi.Error.badRequest('All users are already project participants'));
                                        }
                                    }
                                    else {

                                        reply(err);
                                    }
                                });
                            }
                            else {

                                reply(Hapi.Error.internal(err));
                            }
                        });
                    }
                }
                else {

                    reply(err);
                }
            });
        }
        else {

            reply(Hapi.Error.badRequest('Body must contain a participants or names array'));
        }
    }

    function finalize() {

        Stream.update({ object: 'project', project: request.params.id }, request);

        // Reload project (changed, use direct DB to skip load processing)

        Db.get('project', request.params.id, function (project, err) {

            if (project) {

                exports.participantsList(project, function (participants) {

                    var response = { status: 'ok', participants: participants };

                    reply(response);
                });
            }
            else {

                reply(err);
            }
        });
    }
};


// Remove participant from project

exports.uninvite = function (request, reply) {

    // Load project for write

    exports.load(request.params.id, request.userId, true, function (project, member, err) {

        if (project) {

            // Check if owner

            if (exports.isOwner(project, request.userId)) {

                // Check if single delete or batch

                if (request.params.user) {

                    // Single delete

                    if (request.userId !== request.params.user) {

                        // Lookup user

                        var uninvitedMember = exports.getMember(project, request.params.user);
                        if (uninvitedMember) {

                            internals.leave(project, uninvitedMember, function (err) {

                                if (err === null) {

                                    // Return success

                                    Stream.update({ object: 'projects', user: request.params.user }, request);
                                    Stream.drop(request.params.user, project._id);

                                    finalize();
                                }
                                else {

                                    reply(err);
                                }
                            });
                        }
                        else {

                            reply(Hapi.Error.notFound('Not a project participant'));
                        }
                    }
                    else {

                        reply(Hapi.Error.badRequest('Cannot uninvite self'));
                    }
                }
                else if (request.payload.participants) {

                    // Batch delete

                    var error = null;
                    var uninvitedMembers = [];

                    for (var i = 0, il = request.payload.participants.length; i < il; ++i) {

                        var removeId = request.payload.participants[i];

                        if (request.userId !== removeId) {

                            // Lookup user

                            var uninvited = exports.getMember(project, removeId);
                            if (uninvited) {

                                uninvitedMembers.push(uninvited);
                            }
                            else {

                                error = Hapi.Error.notFound('Not a project participant: ' + removeId);
                                break;
                            }
                        }
                        else {

                            error = Hapi.Error.badRequest('Cannot uninvite self');
                            break;
                        }
                    }

                    if (uninvitedMembers.length === 0) {

                        error = Hapi.Error.badRequest('No members to remove');
                    }

                    if (error === null) {

                        // Batch leave

                        batch(project, uninvitedMembers, 0, function (err) {

                            if (err === null) {

                                // Return success

                                finalize();
                            }
                            else {

                                reply(err);
                            }
                        });
                    }
                    else {

                        reply(error);
                    }
                }
                else {

                    reply(Hapi.Error.badRequest('No participant for removal included'));
                }
            }
            else {

                reply(Hapi.Error.badRequest('Not an owner'));
            }
        }
        else {

            reply(err);
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

                        Stream.update({ object: 'projects', user: members[pos].id }, request);
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

    function finalize() {

        Stream.update({ object: 'project', project: request.params.id }, request);

        // Reload project (changed, use direct DB to skip load processing)

        Db.get('project', request.params.id, function (project, err) {

            if (project) {

                exports.participantsList(project, function (participants) {

                    var response = { status: 'ok', participants: participants };

                    reply(response);
                });
            }
            else {

                reply(err);
            }
        });
    }
};


// Accept project invitation

exports.join = function (request, reply) {

    // The only place allowed to request a non-writable copy for modification
    exports.load(request.params.id, request.userId, false, function (project, member, err) {

        if (project) {

            // Verify user is pending

            if (member.isPending) {

                Db.updateCriteria('project', project._id, { 'participants.id': request.userId }, { $unset: { 'participants.$.isPending': 1} }, function (err) {

                    if (err === null) {

                        // Return success

                        Stream.update({ object: 'project', project: project._id }, request);
                        Stream.update({ object: 'projects', user: request.userId }, request);

                        reply({ status: 'ok' });
                    }
                    else {

                        reply(err);
                    }
                });
            }
            else {

                reply(Hapi.Error.badRequest('Already a member of the project'));
            }
        }
        else {

            reply(err);
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
                    callback(null, null, Hapi.Error.forbidden('Must accept project invitation before making changes'));
                }
            }
            else {

                // Not allowed
                callback(null, null, Hapi.Error.forbidden('Not a project member'));
            }
        }
        else {

            if (err === null) {

                callback(null, null, Hapi.Error.notFound());
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

                        callback(Hapi.Error.badRequest('Cannot remove pid user with task assignments'));
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

    Db.query('project', { 'participants.id': request.userId }, function (projects, err) {

        if (err === null) {

            if (projects.length > 0) {

                var owner = [];
                var notOwner = [];

                for (var i = 0, il = projects.length; i < il; ++i) {

                    for (var p = 0, pl = projects[i].participants.length; p < pl; ++p) {

                        if (projects[i].participants[p].id &&
                            projects[i].participants[p].id === request.userId) {

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


