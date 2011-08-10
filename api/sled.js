/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Db = require('./db');
var User = require('./user');
var Utils = require('./utils');
var Err = require('./error');
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


// Sled definitions

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


// Get sled information

exports.get = function (req, res, next) {

    exports.load(req.params.id, req.api.userId, false, function (sled, member, err) {

        if (sled) {

            exports.participantsList(sled, function (participants) {

                sled.participants = participants;

                res.api.result = sled;
                next();
            });
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Get list of sleds for current user

exports.list = function (req, res, next) {

    Sort.list('sled', req.api.userId, 'participants.id', function (sleds) {

        if (sleds) {

            var list = [];
            for (var i = 0, il = sleds.length; i < il; ++i) {

                var isPending = false;
                for (var p = 0, pl = sleds[i].participants.length; p < pl; ++p) {

                    if (sleds[i].participants[p].id &&
                        sleds[i].participants[p].id === req.api.userId) {

                        isPending = sleds[i].participants[p].isPending || false;
                        break;
                    }
                }

                var item = { id: sleds[i]._id, title: sleds[i].title };

                if (isPending) {

                    item.isPending = true;
                }

                list.push(item);
            }

            Last.load(req.api.userId, function (last, err) {

                if (last &&
                    last.sleds) {

                    for (i = 0, il = list.length; i < il; ++i) {

                        if (last.sleds[list[i].id]) {

                            list[i].last = last.sleds[list[i].id].last;
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


// Update sled properties

exports.post = function (req, res, next) {

    exports.load(req.params.id, req.api.userId, true, function (sled, member, err) {

        if (sled) {

            if (Object.keys(req.body).length > 0) {

                if (req.query.position === undefined) {

                    Db.update('sled', sled._id, Db.toChanges(req.body), function (err) {

                        if (err === null) {

                            Stream.update({ object: 'sled', sled: sled._id }, req);

                            if (req.body.title !== sled.title) {

                                for (var i = 0, il = sled.participants.length; i < il; ++i) {

                                    if (sled.participants[i].id) {

                                        Stream.update({ object: 'sleds', user: sled.participants[i].id }, req);
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

                    res.api.error = Err.badRequest('Cannot include both position parameter and sled object in body');
                    next();
                }
            }
            else if (req.query.position) {

                Sort.set('sled', req.api.userId, 'participants.id', req.params.id, req.query.position, function (err) {

                    if (err === null) {

                        Stream.update({ object: 'sleds', user: req.api.userId }, req);
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

                res.api.error = Err.badRequest('Missing position parameter or sled object in body');
                next();
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Create new sled

exports.put = function (req, res, next) {

    var sled = req.body;
    sled.participants = [{ id: req.api.userId}];

    Db.insert('sled', sled, function (items, err) {

        if (err === null) {

            Stream.update({ object: 'sleds', user: req.api.userId }, req);

            res.api.result = { status: 'ok', id: items[0]._id };
            res.api.created = '/sled/' + items[0]._id;
            next();
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Delete a sled

exports.del = function (req, res, next) {

    exports.load(req.params.id, req.api.userId, false, function (sled, member, err) {

        if (sled) {

            // Check if owner

            if (exports.isOwner(sled, req.api.userId)) {

                // Delete all tasks

                Task.delSled(sled._id, function (err) {

                    if (err === null) {

                        // Delete sled

                        Db.remove('sled', sled._id, function (err) {

                            if (err === null) {

                                Last.delSled(req.api.userId, sled._id, function (err) { });

                                Stream.update({ object: 'sled', sled: sled._id }, req);

                                for (var i = 0, il = sled.participants.length; i < il; ++i) {

                                    if (sled.participants[i].id) {

                                        Stream.update({ object: 'sleds', user: sled.participants[i].id }, req);
                                        Stream.drop(sled.participants[i].id, sled._id);
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

                // Leave sled

                internals.leave(sled, member, function (err) {

                    if (err === null) {

                        Stream.update({ object: 'sled', sled: sled._id }, req);
                        Stream.update({ object: 'sleds', user: req.api.userId }, req);
                        Stream.drop(req.api.userId, sled._id);

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


// Get list of sled tips

exports.tips = function (req, res, next) {

    // Get sled

    exports.load(req.params.id, req.api.userId, false, function (sled, member, err) {

        if (sled) {

            // Collect tips

            Tips.list(sled, function (results) {

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


// Get list of sled suggestions

exports.suggestions = function (req, res, next) {

    // Get sled

    exports.load(req.params.id, req.api.userId, false, function (sled, member, err) {

        if (sled) {

            // Collect tips

            Suggestions.list(sled, req.api.userId, function (results) {

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


// Add new participants to a sled

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

            exports.load(req.params.id, req.api.userId, true, function (sled, member, err) {

                if (sled) {

                    var change = { $pushAll: { participants: []} };

                    // Add pids (non-users)

                    if (req.body.names) {

                        for (var i = 0, il = req.body.names.length; i < il; ++i) {

                            var participant = { pid: Db.generateId(), display: req.body.names[i] };
                            change.$pushAll.participants.push(participant);
                        }

                        if (req.body.participants === undefined) {

                            // No user accounts to invite, save sled

                            Db.update('sled', sled._id, change, function (err) {

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

                                        var prevParticipants = Utils.map(sled.participants, 'id');

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

                                        var prevPids = Utils.map(sled.participants, 'email');

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

                                        // Update sled participants

                                        if (change.$pushAll.participants.length > 0) {

                                            Db.update('sled', sled._id, change, function (err) {

                                                if (err === null) {

                                                    for (var i = 0, il = changedUsers.length; i < il; ++i) {

                                                        Stream.update({ object: 'sleds', user: changedUsers[i]._id }, req);
                                                    }

                                                    // Invite new participants

                                                    Email.sledInvite(changedUsers, pids, sled, req.query.message, user);

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

                                            res.api.error = Err.badRequest('All users are already sled participants');
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

        Stream.update({ object: 'sled', sled: req.params.id }, req);

        // Reload sled (changed, use direct DB to skip load processing)

        Db.get('sled', req.params.id, function (sled, err) {

            if (sled) {

                exports.participantsList(sled, function (participants) {

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


// Remove participant from sled

exports.uninvite = function (req, res, next) {

    // Load sled for write

    exports.load(req.params.id, req.api.userId, true, function (sled, member, err) {

        if (sled) {

            // Check if owner

            if (exports.isOwner(sled, req.api.userId)) {

                // Check if single delete or batch

                if (req.params.user) {

                    // Single delete

                    if (req.api.userId !== req.params.user) {

                        // Lookup user

                        var uninvitedMember = exports.getMember(sled, req.params.user);
                        if (uninvitedMember) {

                            internals.leave(sled, uninvitedMember, function (err) {

                                if (err === null) {

                                    // Return success

                                    Stream.update({ object: 'sleds', user: req.params.user }, req);
                                    Stream.drop(req.params.user, sled._id);

                                    reply();
                                }
                                else {

                                    res.api.error = err;
                                    next();
                                }
                            });
                        }
                        else {

                            res.api.error = Err.notFound('Not a sled participant');
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

                            var uninvited = exports.getMember(sled, removeId);
                            if (uninvited) {

                                uninvitedMembers.push(uninvited);
                            }
                            else {

                                error = Err.notFound('Not a sled participant: ' + removeId);
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

                        batch(sled, uninvitedMembers, 0, function (err) {

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

    function batch(sled, members, pos, callback) {

        if (pos >= members.length) {

            callback(null);
        }
        else {

            internals.leave(sled, members[pos], function (err) {

                if (err === null) {

                    // Return success

                    if (members[pos].id) {

                        Stream.update({ object: 'sleds', user: members[pos].id }, req);
                        Stream.drop(members[pos].id, sled._id);
                    }

                    batch(sled, members, pos + 1, callback);
                }
                else {

                    callback(err);
                }
            });
        }
    }

    function reply() {

        Stream.update({ object: 'sled', sled: req.params.id }, req);

        // Reload sled (changed, use direct DB to skip load processing)

        Db.get('sled', req.params.id, function (sled, err) {

            if (sled) {

                exports.participantsList(sled, function (participants) {

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


// Accept sled invitation

exports.join = function (req, res, next) {

    // The only place allowed to request a non-writable copy for modification
    exports.load(req.params.id, req.api.userId, false, function (sled, member, err) {

        if (sled) {

            // Verify user is pending

            if (member.isPending) {

                Db.updateCriteria('sled', sled._id, { 'participants.id': req.api.userId }, { $unset: { 'participants.$.isPending': 1} }, function (err) {

                    if (err === null) {

                        // Return success

                        Stream.update({ object: 'sled', sled: sled._id }, req);
                        Stream.update({ object: 'sleds', user: req.api.userId }, req);

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

                res.api.error = Err.badRequest('Already a member of the sled');
                next();
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Load sled from database and check for user rights

exports.load = function (sledId, userId, isWritable, callback) {

    Db.get('sled', sledId, function (item, err) {

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
                    callback(null, null, Err.forbidden('Must accept sled invitation before making changes'));
                }
            }
            else {

                // Not allowed
                callback(null, null, Err.forbidden('Not a sled member'));
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

exports.participantsList = function (sled, callback) {

    var userIds = [];
    for (var i = 0, il = sled.participants.length; i < il; ++i) {

        if (sled.participants[i].id) {

            userIds.push(sled.participants[i].id);
        }
    }

    User.quickList(userIds, function (users, usersMap) {

        var participants = [];
        for (var i = 0, il = sled.participants.length; i < il; ++i) {

            var participant = null;

            if (sled.participants[i].id) {

                // Registered user participant

                participant = usersMap[sled.participants[i].id];
            }
            else if (sled.participants[i].pid) {

                // Non-user participant

                participant = {

                    id: 'pid:' + sled.participants[i].pid,
                    display: sled.participants[i].display,
                    isPid: true
                };
            }

            if (participant) {

                if (sled.participants[i].isPending) {

                    participant.isPending = sled.participants[i].isPending;
                }

                participants.push(participant);
            }
        }

        callback(participants);
    });
};


// Get participants map

exports.participantsMap = function (sled) {

    var participants = { users: {}, emails: {} };

    for (var i = 0, il = sled.participants.length; i < il; ++i) {

        if (sled.participants[i].id) {

            // Registered user participant

            participants.users[sled.participants[i].id] = true;
        }
        else if (sled.participants[i].email) {

            // Non-user email-invited participant

            participants.emails[sled.participants[i].email] = true;
        }
    }

    return participants;
};


// Get member

exports.getMember = function (sled, userId) {

    var isPid = userId.indexOf('pid:') === 0;
    if (isPid) {

        userId = userId.substring(4);           // Remove 'pid:' prefix
    }

    for (var i = 0, il = sled.participants.length; i < il; ++i) {

        if (isPid &&
            sled.participants[i].pid &&
            sled.participants[i].pid === userId) {

            return sled.participants[i];
        }
        else if (sled.participants[i].id &&
                 sled.participants[i].id === userId) {

            return sled.participants[i];
        }
    }

    return null;
};


// Check if member

exports.isMember = function (sled, userId) {

    return (exports.getMember(sled, userId) !== null);
};


// Check if owner

exports.isOwner = function (sled, userId) {

    return (sled.participants[0].id && sled.participants[0].id === userId);
};


// Leave sled

internals.leave = function (sled, member, callback) {

    var isPid = (member.pid !== null && member.pid !== undefined);
    var userId = (isPid ? member.pid : member.id);

    // Check if user is assigned tasks

    Task.userTaskList(sled._id, (isPid ? 'pid:' + userId : userId), function (tasks, err) {

        if (err === null) {

            if (tasks.length > 0) {

                // Check if removing a pid

                if (isPid === false) {

                    // Load user

                    User.load(userId, function (user, err) {

                        if (user) {

                            // Add unregistered sled account (pid)

                            var display = (user.name ? user.name
                                                     : (user.username ? user.username
                                                                      : (user.emails && user.emails[0] && user.emails[0].address ? user.emails[0].address : null)));

                            var participant = { pid: Db.generateId(), display: display };

                            // Move any assignments to pid account (not details) and save tasks

                            var taskCriteria = { sled: sled._id, participants: userId };
                            var taskChange = { $set: { 'participants.$': 'pid:' + participant.pid} };
                            Db.updateCriteria('task', null, taskCriteria, taskChange, function (err) {

                                if (err === null) {

                                    // Save sled

                                    Db.updateCriteria('sled', sled._id, { 'participants.id': userId }, { $set: { 'participants.$': participant} }, function (err) {

                                        if (err === null) {

                                            // Cleanup last information

                                            Last.delSled(userId, sled._id, function (err) { });

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
                        Db.updateCriteria('sled', sled._id, { 'participants.pid': userId }, { $set: { 'participants.$': participant } }, function (err) {

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

                Db.update('sled', sled._id, change, function (err) {

                    if (err === null) {

                        if (isPid === false) {

                            // Cleanup last information

                            Last.delSled(userId, sled._id, function (err) { });
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

exports.replacePid = function (sled, pid, userId, callback) {

    // Move any assignments to pid account (not details) and save tasks

    var taskCriteria = { sled: sled._id, participants: 'pid:' + pid };
    var taskChange = { $set: { 'participants.$': userId} };
    Db.updateCriteria('task', null, taskCriteria, taskChange, function (err) {

        if (err === null) {

            // Check if user already a member

            if (exports.isMember(sled, userId)) {

                // Remove Pid without adding

                Db.update('sled', sled._id, { $pull: { participants: { pid: pid}} }, function (err) {

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

                Db.updateCriteria('sled', sled._id, { 'participants.pid': pid }, { $set: { 'participants.$': { id: userId}} }, function (err) {

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

    Db.query('sled', { 'participants.id': req.api.userId }, function (sleds, err) {

        if (err === null) {

            if (sleds.length > 0) {

                var owner = [];
                var notOwner = [];

                for (var i = 0, il = sleds.length; i < il; ++i) {

                    for (var p = 0, pl = sleds[i].participants.length; p < pl; ++p) {

                        if (sleds[i].participants[p].id &&
                            sleds[i].participants[p].id === req.api.userId) {

                            sleds[i]._isPending = sleds[i].participants[p].isPending || false;

                            if (i == 0) {

                                sleds[i]._isOwner = true;
                                owner.push(sleds[i]);
                            }
                            else {

                                sleds[i]._isOwner = false;
                                notOwner.push(sleds[i]);
                            }

                            break;
                        }
                    }
                }

                callback(sleds, owner, notOwner, null);
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


// Delete an empty sled (verified by caller)

exports.delEmpty = function (sledId, callback) {

    // Delete all tasks

    Task.delSled(sledId, function (err) {

        if (err === null) {

            // Delete sled

            Db.remove('sled', sled._id, function (err) {

                callback(err);
            });
        }
        else {

            callback(err);
        }
    });
};


