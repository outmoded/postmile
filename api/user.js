/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var Email = require('./email');
var Invite = require('./invite');
var Last = require('./last');
var Session = require('./session');
var Project = require('./project');
var Sort = require('./sort');
var Stream = require('./stream');
var Storage = require('./storage');
var Suggestions = require('./suggestions');


// Declare internals

var internals = {};


// Definition

exports.type = {};

exports.type.user = {

    name:       { type: 'string' },
    emails:     { type: 'object',       set: false,     array: true },
    contacts:   { type: 'object',       set: false,                     hide: true },

    username:   { type: 'string',                       empty: true },
    twitter:    { type: 'string',       set: false },
    facebook:   { type: 'string',       set: false },
    yahoo:      { type: 'string',       set: false },

    origin:     { type: 'object',       set: false,                     hide: true },
    tos:        { type: 'object',       set: false,                     hide: true },
    tickets:    { type: 'object',       set: false,                     hide: true },
    view:       { type: 'string',       set: false }
};

exports.type.put = {

    username:   { type: 'string' },
    name:       { type: 'string' },
    network:    { type: 'string',       array: true },
    email:      { type: 'email' }
};

exports.type.link = {

    id:         { type: 'string',       required: true }
};

exports.type.reminder = {

    account:    { type: 'string',       required: true }
};

exports.type.email = {

    address:    { type: 'string',       required: true },
    action:     { type: 'enum',         required: true, values: { remove: 1, primary: 2, add: 3, verify: 4 } }
};


// Forbidden usernames

internals.forbiddenUsernames = {

    about: true,
    account: true,
    auth: true,
    blog: true,
    copyright: true,
    css: true,
    developer: true,
    gallery: true,
    guide: true,
    help: true,
    images: true,
    imwithstupid: true,
    login: true,
    logout: true,
    oauth: true,
    privacy: true,
    scripts: true,
    script: true,
    search: true,
    signup: true,
    support: true,
    terms: true,
    test: true,
    tos: true,
    view: true,
    welcome: true
};


// Current user information

exports.get = function (request, reply) {

    exports.load(request.userId, function (user, err) {

        if (user) {

            Hapi.Utils.hide(user, exports.type.user);
            reply(user);
        }
        else {

            reply(err);
        }
    });
};


// Change profile properties

exports.post = function (request, reply) {

    exports.load(request.userId, function (user, err) {

        if (user) {

            // Remove identical username

            if (request.payload.username &&
                request.payload.username === user.username) {

                delete request.payload.username;
            }

            // Lookup username

            if (request.payload.username) {

                internals.checkUsername(request.payload.username, function (lookupUser, err) {

                    if (err &&
                        err.code === Hapi.Error.notFound().code) {

                        Db.update('user', user._id, Db.toChanges(request.payload), function (err) {

                            if (err === null) {

                                Stream.update({ object: 'profile', user: user._id }, request);
                                reply({ status: 'ok' });
                            }
                            else {

                                reply(err);
                            }
                        });
                    }
                    else {

                        reply(typeof err === 'string' ? Hapi.Error.badRequest('Invalid username: ' + err) : err);
                    }
                });
            }
            else {

                Db.update('user', user._id, Db.toChanges(request.payload), function (err) {

                    if (err === null) {

                        Stream.update({ object: 'profile', user: user._id }, request);
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


// Change profile email settings

exports.email = function (request, reply) {

    var address = request.payload.address.toLowerCase();

    exports.load(request.userId, function (user, err) {

        if (user) {

            var isFound = false;

            // Find the address

            user.emails = user.emails || [];
            for (var i = 0, il = user.emails.length; i < il; ++i) {

                if (user.emails[i].address === address) {

                    isFound = true;
                    break;
                }
            }

            switch (request.payload.action) {

                case 'add':

                    // Add

                    if (isFound === false) {

                        // Check is already used by someone else

                        Db.count('user', { 'emails.address': address }, function (count, err) {

                            if (err === null) {

                                if (count === 0) {

                                    // Save

                                    Db.update('user', user._id, { '$push': { emails: { address: address, isVerified: false}} }, function (err) {

                                        if (err === null) {

                                            Email.sendValidation(user, address, function (err) {

                                                // Ignore errors

                                                if (err) {

                                                    Hapi.Log.err(err, request);
                                                }

                                                Stream.update({ object: 'profile', user: user._id }, request);
                                                reply({ status: 'ok' });
                                            });
                                        }
                                        else {

                                            reply(err);
                                        }
                                    });
                                }
                                else {

                                    reply(Hapi.Error.badRequest('Email already assigned to another account'));
                                }
                            }
                            else {

                                reply(err);
                            }
                        });
                    }
                    else {

                        reply(Hapi.Error.badRequest('Address already present'));
                    }

                    break;

                case 'primary':

                    // Primary

                    if (isFound) {

                        // Check if current primary

                        if (i !== 0) {

                            // Check if verified

                            if (user.emails[i].isVerified) {

                                // Remove from list

                                user.emails.splice(i, 1);

                                // Add back at head

                                user.emails.unshift({ address: address, isVerified: true });

                                // OVerride entire array

                                Db.update('user', user._id, { '$set': { 'emails': user.emails} }, function (err) {

                                    if (err === null) {

                                        Stream.update({ object: 'profile', user: user._id }, request);
                                        reply({ status: 'ok' });
                                    }
                                    else {

                                        reply(err);
                                    }
                                });
                            }
                            else {

                                reply(Hapi.Error.badRequest('Email must be verified before made primary'));
                            }
                        }
                        else {

                            reply(Hapi.Error.badRequest('Address already primary'));
                        }
                    }
                    else {

                        reply(Hapi.Error.notFound('No such email address'));
                    }

                    break;

                case 'remove':

                    // Remove

                    if (isFound) {

                        // Check if current primary

                        if (i !== 0) {

                            if (user.emails.length > 1) {

                                // Save

                                Db.update('user', user._id, { '$pull': { emails: { address: address}} }, function (err) {

                                    if (err === null) {

                                        Stream.update({ object: 'profile', user: user._id }, request);
                                        reply({ status: 'ok' });
                                    }
                                    else {

                                        reply(err);
                                    }
                                });
                            }
                            else {

                                reply(Hapi.Error.badRequest('Cannot remove the only address present'));
                            }
                        }
                        else {

                            reply(Hapi.Error.badRequest('Cannot remove primary address'));
                        }
                    }
                    else {

                        reply(Hapi.Error.notFound('No such email address'));
                    }

                    break;

                case 'verify':

                    // Verify

                    if (isFound) {

                        if (user.emails[i].isVerified !== true) {

                            Email.sendValidation(user, address, function (err) {

                                if (err === null) {

                                    reply({ result: 'ok' });
                                }
                                else {

                                    reply(err);
                                }
                            });
                        }
                        else {

                            reply(Hapi.Error.badRequest('Account already verified'));
                        }
                    }
                    else {

                        reply(Hapi.Error.notFound('No such email address'));
                    }
                    break;
            }
        }
        else {

            reply(err);
        }
    });
};


// Current user contacts list

exports.contacts = function (request, reply) {

    if (request.query.exclude) {

        Project.load(request.query.exclude, request.userId, false, function (project, member, err) {

            if (err === null) {

                getList(Project.participantsMap(project));
            }
            else {

                reply(err);
            }
        });
    }
    else {

        getList(null);
    }

    function getList(exclude) {

        exports.load(request.userId, function (user, err) {

            if (user) {

                var userIds = [];
                for (var i in user.contacts) {

                    if (user.contacts.hasOwnProperty(i)) {

                        if (user.contacts[i].type === 'user' &&
                            (exclude === null || exclude.users[i] !== true)) {

                            userIds.push(i);
                        }
                    }
                }

                exports.expandIds(userIds, function (users, usersMap) {

                    var contacts = [];
                    for (var i in user.contacts) {

                        if (user.contacts.hasOwnProperty(i)) {

                            var contact = null;
                            if (user.contacts[i].type === 'user') {

                                // Registered user

                                contact = usersMap[i];
                                if (contact) {

                                    contact.type = 'user';
                                    contact.last = user.contacts[i].last;
                                    contacts.push(contact);
                                }
                            }
                            else if (user.contacts[i].type === 'email') {

                                // Email contact

                                var email = Db.decodeKey(i);
                                if (exclude === null ||
                                    exclude.emails[email] !== true) {

                                    contact = {

                                        id: email,
                                        display: email,
                                        last: user.contacts[i].last,
                                        type: 'email'
                                    };

                                    contacts.push(contact);
                                }
                            }
                        }
                    }

                    contacts.sort(function (a, b) {

                        if (a.last > b.last) {

                            return -1;
                        }

                        if (a.last < b.last) {

                            return 1;
                        }

                        return 0;
                    });

                    reply(contacts);
                });
            }
            else {

                reply(err);
            }
        });
    }
};


// Who am I?

exports.who = function (request, reply) {

    reply({ user: request.userId });
};


// Register new user

exports.put = function (request, reply) {

    // Check invitation code

    var inviteId = null;
    var origin = null;
    var projectPid = null;

    var email = null;
    var isEmailVerified = null;

    if (request.query.invite) {

        // Check code source (invite or project participation)

        if (request.query.invite.indexOf('project:') === 0) {

            // Project participation

            var inviteRegex = /^project:([^:]+):([^:]+):([^:]+)$/;
            var parts = inviteRegex.exec(request.query.invite);

            if (parts &&
                parts.length === 4) {

                var projectId = parts[1];
                var pid = parts[2];
                var code = parts[3];

                // Load project (not using Project.load since there is no active user)

                Db.get('project', projectId, function (project, err) {

                    if (project) {

                        // Lookup code

                        for (var i = 0, il = project.participants.length; i < il; ++i) {

                            if (project.participants[i].pid &&
                                project.participants[i].pid === pid) {

                                if (project.participants[i].code &&
                                    project.participants[i].code === code) {

                                    projectPid = project.participants[i];
                                    projectPid.project = project;                // Pass on for later use

                                    origin = { type: 'project', project: project._id };

                                    if (project.participants[i].inviter) {

                                        origin.user = project.participants[i].inviter;
                                    }

                                    break;
                                }
                                else {

                                    // Invalid code
                                    break;
                                }
                            }
                        }

                        if (origin) {

                            validate();
                        }
                        else {

                            reply(Hapi.Error.badRequest('Invalid invitation code'));
                        }
                    }
                    else {

                        reply(err);
                    }
                });
            }
            else {

                reply(Hapi.Error.badRequest('Invalid invitation format'));
            }
        }
        else {

            // Invite code

            Invite.load(request.query.invite, function (invite, err) {

                if (err === null) {

                    inviteId = invite._id;
                    origin = { type: 'invite', invite: inviteId };

                    validate();
                }
                else {

                    reply(err);
                }
            });
        }
    }
    else {

        reply(Hapi.Error.badRequest('Invitation code missing'));
    }

    function validate() {

        // Look for email address

        email = (request.payload.email ? request.payload.email : (projectPid && projectPid.email ? projectPid.email : null));
        isEmailVerified = (projectPid && projectPid.email && projectPid.email === email ? true : false);

        // Check for at least one identifier

        if (request.payload.network ||
            email) {

            validateEmail();
        }
        else {

            reply(Hapi.Error.badRequest('Must include either a network id or email address'));
        }
    }

    function validateEmail() {

        if (email) {

            Db.count('user', { 'emails.address': email }, function (count, err) {

                if (err === null) {

                    if (count === 0) {

                        validateNetwork();
                    }
                    else {

                        reply(Hapi.Error.badRequest('Email address already linked to an existing user'));
                    }
                }
                else {

                    reply(err);
                }
            });
        }
        else {

            validateNetwork();
        }
    }

    function validateNetwork() {

        if (request.payload.network) {

            var isValid = true;
            var error = null;

            if (request.payload.network.length === 2) {

                var network = request.payload.network[0];
                var networkId = request.payload.network[1];

                if (networkId) {

                    if (network !== 'twitter' &&
                        network !== 'facebook' &&
                        network !== 'yahoo') {

                        isValid = false;
                        error = 'Unknown network';
                    }
                }
                else {

                    isValid = false;
                    error = 'Empty network id';
                }
            }
            else {

                isValid = false;
                error = 'Bad network array size';
            }

            if (isValid) {

                var criteria = {};
                criteria[request.payload.network[0]] = request.payload.network[1];

                Db.count('user', criteria, function (count, err) {

                    if (err === null) {

                        if (count === 0) {

                            validateUsername();
                        }
                        else {

                            reply(Hapi.Error.badRequest(request.payload.network[0].replace(/^\w/, function ($0) { return $0.toUpperCase(); }) + ' account already linked to an existing user'));
                        }
                    }
                    else {

                        reply(err);
                    }
                });
            }
            else {

                reply(Hapi.Error.badRequest(error));
            }
        }
        else {

            validateUsername();
        }
    }

    function validateUsername() {

        if (request.payload.username) {

            internals.checkUsername(request.payload.username, function (lookupUser, err) {

                if (err &&
                    err.code === Hapi.Error.notFound().code) {

                    createAccount();
                }
                else {

                    reply(typeof err === 'string' ? Hapi.Error.badRequest('Invalid username: ' + err) : err);
                }
            });
        }
        else {

            createAccount();
        }
    }

    function createAccount() {

        var user = { origin: origin };

        if (request.payload.name) {

            user.name = request.payload.name;
        }

        if (request.payload.username) {

            user.username = request.payload.username;
        }

        if (email) {

            user.emails = [{ address: email, isVerified: isEmailVerified}];
        }

        if (request.payload.network) {

            user[request.payload.network[0]] = request.payload.network[1];
        }

        Db.insert('user', user, function (items, err) {

            if (err === null) {

                if (items.length === 1 &&
                    items[0]._id) {

                    var userId = items[0]._id;

                    if (inviteId) {

                        // Decrease invitation count

                        Db.update('invite', inviteId, { $inc: { count: 1} }, function (err) { });
                    }

                    if (projectPid) {

                        // Update project with new participant

                        Project.replacePid(projectPid.project, projectPid.pid, userId, function (err) {

                            if (err === null) {

                                Stream.update({ object: 'project', project: projectPid.project._id }, request);
                                sendWelcome(items[0]);
                            }
                            else {

                                reply(err);
                            }
                        });
                    }
                    else {

                        sendWelcome(items[0]);
                    }
                }
                else {

                    reply(Hapi.Error.internal('Failed to retrieve new user id', user));
                }
            }
            else {

                reply(err);
            }
        });
    }

    function sendWelcome(user) {

        // Send welcome email (also serves as verification email)

        Email.sendWelcome(user, function (err) {    // Ignore error

            reply({ status: 'ok', id: user._id });
        });
    }
};


// Set Terms of Service version

exports.tos = function (request, reply) {

    exports.load(request.params.id, function (user, err) {

        if (user) {

            user.tos = user.tos || {};
            user.tos[request.params.version] = Hapi.Utils.getTimestamp();

            Db.update('user', user._id, { $set: { 'tos': user.tos} }, function (err) {

                if (err === null) {

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
};


// Link other account

exports.link = function (request, reply) {

    if (request.params.network === 'facebook' ||
        request.params.network === 'twitter' ||
        request.params.network === 'yahoo') {

        exports.load(request.params.id, function (user, err) {

            if (user) {

                // Check if already has a linked account for this network
                
                if (!user[request.params.network]) {
                
                    // Check if already assigned to someone else

                    var criteria = {};
                    criteria[request.params.network] = request.params.id;

                    Db.count('user', criteria, function (count, err) {

                        if (err === null) {

                            if (count === 0) {

                                var changes = { $set: {} };
                                changes.$set[request.params.network] = request.payload.id;

                                Db.update('user', user._id, changes, function (err) {

                                    if (err === null) {

                                        Stream.update({ object: 'profile', user: user._id }, request);
                                        reply({ status: 'ok' });
                                    }
                                    else {

                                        reply(err);
                                    }
                                });
                            }
                            else {

                                reply(Hapi.Error.badRequest('Network id already linked to another user'));
                            }
                        }
                        else {

                            reply(err);
                        }
                    });
                }
                else {
                
                    reply(Hapi.Error.badRequest('Network already linked'));
                }
            }
            else {

                reply(err);
            }
        });
    }
    else {

        reply(Hapi.Error.badRequest('Unknown network'));
    }
};


// Unlink other account

exports.unlink = function (request, reply) {

    if (request.params.network === 'facebook' ||
        request.params.network === 'twitter' ||
        request.params.network === 'yahoo') {

        exports.load(request.params.id, function (user, err) {

            if (user) {

                // Is set?

                if (user[request.params.network]) {

                    // Is last (and no email)

                    var linkCount = (user.facebook ? 1 : 0) + (user.twitter ? 1 : 0) + (user.yahoo ? 1 : 0);

                    if ((user.emails && user.emails.length > 0) ||
                        linkCount > 1) {

                        var changes = { $unset: {} };
                        changes.$unset[request.params.network] = 1;

                        Db.update('user', user._id, changes, function (err) {

                            if (err === null) {

                                Stream.update({ object: 'profile', user: user._id }, request);
                                reply({ status: 'ok' });
                            }
                            else {

                                reply(err);
                            }
                        });
                    }
                    else {

                        reply(Hapi.Error.badRequest('Cannot remove last linked account'));
                    }
                }
                else {

                    reply(Hapi.Error.badRequest('Account not linked'));
                }
            }
            else {

                reply(err);
            }
        });
    }
    else {

        reply(Hapi.Error.badRequest('Unknown network'));
    }
};


// Set default view

exports.view = function (request, reply) {

    exports.load(request.params.id, function (user, err) {

        if (user) {

            Db.update('user', user._id, { $set: { 'view': request.params.path } }, function (err) {

                if (err === null) {

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
};


// Lookup user based on account and type

exports.lookup = function (request, reply) {

    if (request.params.type === 'username') {

        internals.checkUsername(request.params.id, function (lookupUser, err) {

            if (lookupUser) {

                reply({ user: lookupUser._id });
            }
            else {

                reply(typeof err === 'string' ? Hapi.Error.badRequest(err) : err);
            }
        });
    }
    else if (request.params.type === 'email') {

        if (Hapi.Utils.checkEmail(request.params.id)) {

            Db.queryUnique('user', { 'emails.address': request.params.id }, function (item, err) {

                if (err === null) {

                    if (item) {

                        reply({ user: item._id });
                    }
                    else {

                        reply(Hapi.Error.notFound());
                    }
                }
                else {

                    reply(err);
                }
            });
        }
        else {

            reply(Hapi.Error.badRequest('Invalid email address'));
        }
    }
    else if (request.params.type === 'facebook' ||
             request.params.type === 'twitter' ||
             request.params.type === 'yahoo') {

        var criteria = {};
        criteria[request.params.type] = request.params.id;

        Db.queryUnique('user', criteria, function (item, err) {

            if (err === null) {

                if (item) {

                    reply({ user: item._id });
                }
                else {

                    reply(Hapi.Error.notFound());
                }
            }
            else {

                reply(err);
            }
        });
    }
    else {

        reply(Hapi.Error.badRequest('Unknown network type'));
    }
};


// Send email reminder account based on email or username and take action

exports.reminder = function (request, reply) {

    var isEmail = request.payload.account.indexOf('@') !== -1;
    var account = request.payload.account.toLowerCase();

    if (isEmail === false ||
        Hapi.Utils.checkEmail(account)) {

        var criteria = {};
        criteria[isEmail ? 'emails.address' : 'username'] = account;

        Db.queryUnique('user', criteria, function (user, err) {

            if (err === null) {

                if (user) {

                    Email.sendReminder(user, function (err) {

                        if (err === null) {

                            reply({ result: 'ok' });
                        }
                        else {

                            reply(err);
                        }
                    });
                }
                else {

                    reply(Hapi.Error.notFound());
                }
            }
            else {

                reply(err);
            }
        });
    }
    else {

        reply(Hapi.Error.badRequest());
    }
};


// Delete account

exports.del = function (request, reply) {

    // Check if user has any projects

    Project.unsortedList(request.userId, function (projects, owner, notOwner, err) {

        if (err === null) {

            // Check if member of any projects

            if (notOwner.length === 0) {

                // Check if owner of any projects

                if (owner.length === 0) {

                    // No own projects

                    deleteAccount(null);
                }
                else if (owner.length === 1) {

                    // If only one project, check if it has other participants or any tasks (UX creates an empty project automatically)

                    if (owner[0].participants.length === 1) {

                        Task.count(owner[0]._id, function (count, err) {

                            if (err === null) {

                                if (count === 0) {

                                    deleteAccount(owner[0]._id);
                                }
                                else {

                                    reply(Hapi.Error.badRequest('Must first delete project'));
                                }
                            }
                            else {

                                reply(err);
                            }
                        });
                    }
                    else {

                        reply(Hapi.Error.badRequest('Must first delete project (has participants)'));
                    }
                }
                else {

                    // Multiple own projects

                    reply(Hapi.Error.badRequest('Must first delete all projects'));
                }
            }
            else {

                // Member of projects

                reply(Hapi.Error.badRequest('Must first leave all projects'));
            }
        }
        else {

            reply(err);
        }
    });

    function deleteAccount(projectId) {

        var ignore = function () { };

        // Delete account first

        Db.remove('user', request.userId, function (err) {

            if (err === null) {

                // Remove own empty project

                if (projectId) {

                    Project.delEmpty(projectId, ignore);
                }

                // Delete the projects sort list

                Sort.del('project', request.userId, ignore);

                // Remove grants

                Session.delUser(request.userId, ignore);

                // Remove excluded suggestions

                Suggestions.delUser(request.userId, ignore);

                // Remove last

                Last.delUser(request.userId, ignore);

                // Remove client storage

                Storage.delUser(request.userId, ignore);

                // Return result

                reply({ result: 'ok' });
            }
            else {

                reply(err);
            }
        });
    }
};


// Load user

exports.load = function (userId, callback) {

    if (userId) {

        Db.get('user', userId, function (item, err) {

            if (item) {

                callback(item, null);
            }
            else {

                if (err === null) {

                    callback(null, Hapi.Error.notFound());
                }
                else {

                    callback(null, err);
                }
            }
        });
    }
    else {

        callback(null, Hapi.Error.internal('Missing user id'));
    }
};


// Get user quick info

exports.quick = function (id, callback) {

    Db.get('user', id, function (user, err) {

        if (user) {

            var display = (user.name ? user.name
                                     : (user.username ? user.username
                                                      : (user.emails && user.emails[0] && user.emails[0].address ? user.emails[0].address : null)));

            callback({ id: user._id, display: display });
        }
        else {

            callback(null);
        }
    });
};


// Get user quick list

exports.expandIds = function (ids, callback) {

    Db.getMany('user', ids, function (items, err, notFound) {

        if (err === null) {

            var records = [];
            var map = {};

            for (var i = 0, il = items.length; i < il; ++i) {

                var user = items[i];
                if (user) {

                    var display = (user.name ? user.name
                                             : (user.username ? user.username
                                                              : (user.emails && user.emails[0] && user.emails[0].address ? user.emails[0].address
                                                                                                                         : null)));

                    var record = { id: user._id, display: display };
                    records.push(record);
                    map[user._id] = record;
                }
            }

            callback(records, map);
        }
        else {

            // Request fails

            callback([], {});
        }
    });
};


// Check username

internals.checkUsername = function (username, callback) {

    // Defined

    if (username) {

        // String

        if (typeof username === 'string') {

            // Minimum length

            if (username.length >= 2) {

                // Maximum length

                if (username.length <= 20) {

                    // Begins with a letter

                    if (username.search(/^[a-zA-Z]/) === 0) {

                        // Includes only letters, numbers, and _

                        if (username.search(/^\w*$/) === 0) {

                            // Not forbidden

                            if (internals.forbiddenUsernames[username] !== true) {

                                // Available

                                Db.queryUnique('user', { username: username.toLowerCase() }, function (item, err) {

                                    if (err === null) {

                                        if (item) {

                                            // Valid

                                            callback(item, 'Already taken');
                                        }
                                        else {

                                            callback(null, Hapi.Error.notFound());
                                        }
                                    }
                                    else {

                                        callback(null, err);
                                    }
                                });
                            }
                            else {

                                callback(null, 'Reserved keyword');
                            }
                        }
                        else {

                            callback(null, 'Value must only contain letters, numbers and _');
                        }
                    }
                    else {

                        callback(null, 'First character must be a letter');
                    }
                }
                else {

                    callback(null, 'Value is too long (maximum 20 characters)');
                }
            }
            else {

                callback(null, 'Value is too short (2 characters or more required)');
            }
        }
        else {

            callback(null, 'Value is not a string');
        }
    }
    else {

        callback(null, 'Value is undefined');
    }
};


// Lookup user by ID or email

exports.find = function (ids, callback) {

    var isValid = true;
    var userIds = [];
    var emails = [];

    // Separate user Ids from emails, and verify emails have valid format

    for (var i = 0, il = ids.length; i < il; ++i) {

        if (ids[i].indexOf('@') === -1) {

            // ID

            userIds.push(ids[i]);
        }
        else {

            // Email

            if (Hapi.Utils.checkEmail(ids[i])) {

                emails.push(ids[i].toLowerCase());
            }
            else {

                isValid = false;
                error = Hapi.Error.badRequest('Invalid email address');
                break;
            }
        }
    }

    if (isValid) {

        // Get all users

        Db.getMany('user', userIds, function (items, err, notFound) {

            if (err === null) {

                var users = items;
                if (items.length === userIds.length) {

                    // Try getting all emails

                    Db.query('user', { 'emails.address': { '$in': emails} }, function (items, err) {

                        if (err === null) {

                            var usersByEmail = items;

                            // Add users to list

                            var emailsFound = {};

                            for (var i = 0, il = usersByEmail.length; i < il; ++i) {

                                users.push(usersByEmail[i]);

                                for (var e = 0, el = usersByEmail[i].emails.length; e < el; ++e) {

                                    emailsFound[usersByEmail[i].emails[e].address] = true;
                                }
                            }

                            // Remove potential duplicates between emails and across emails and users

                            users = Hapi.Utils.unique(users, '_id');

                            // Find which emails were not found

                            var emailsNotFound = [];
                            for (i = 0, il = emails.length; i < il; ++i) {

                                if (emailsFound[emails[i]] !== true) {

                                    emailsNotFound.push(emails[i]);
                                }
                            }

                            // Return results

                            callback(users, emailsNotFound, null);
                        }
                        else {

                            callback(null, null, err);
                        }
                    });
                }
                else {

                    callback(null, null, Hapi.Error.badRequest('Invalid user ID: ' + JSON.stringify(notFound)));
                }
            }
            else {

                callback(null, null, err);
            }
        });
    }
    else {

        callback(null, null, error);
    }
};


// Validate linked account

exports.validate = function (id, network, callback) {

    if (id) {

        var criteria = {};
        criteria[network] = id;

        Db.queryUnique('user', criteria, function (user, err) {

            if (err === null) {

                if (user) {

                    callback(user, null);
                }
                else {

                    callback(null, null);
                }
            }
            else {

                callback(null, err);
            }
        });
    }
    else {

        callback(null, null);
    }
};


