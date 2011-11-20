/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Db = require('./db');
var Utils = require('hapi').Utils;
var Err = require('hapi').Error;
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

exports.get = function (req, res, next) {

    exports.load(req.api.userId, function (user, err) {

        if (user) {

            Utils.hide(user, exports.type.user);
            res.api.result = user;
            next();
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Change profile properties

exports.post = function (req, res, next) {

    exports.load(req.api.userId, function (user, err) {

        if (user) {

            // Remove identical username

            if (req.body.username &&
                req.body.username === user.username) {

                delete req.body.username;
            }

            // Lookup username

            if (req.body.username) {

                internals.checkUsername(req.body.username, function (lookupUser, err) {

                    if (err &&
                        err.code === Err.notFound().code) {

                        Db.update('user', user._id, Db.toChanges(req.body), function (err) {

                            if (err === null) {

                                Stream.update({ object: 'profile', user: user._id }, req);
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

                        res.api.error = (typeof err === 'string' ? Err.badRequest('Invalid username: ' + err) : err);
                        next();
                    }
                });
            }
            else {

                Db.update('user', user._id, Db.toChanges(req.body), function (err) {

                    if (err === null) {

                        Stream.update({ object: 'profile', user: user._id }, req);
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


// Change profile email settings

exports.email = function (req, res, next) {

    var address = req.body.address.toLowerCase();

    exports.load(req.api.userId, function (user, err) {

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

            switch (req.body.action) {

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

                                                    Log.err(err, req);
                                                }

                                                Stream.update({ object: 'profile', user: user._id }, req);
                                                res.api.result = { status: 'ok' };
                                                next();
                                            });
                                        }
                                        else {

                                            res.api.error = err;
                                            next();
                                        }
                                    });
                                }
                                else {

                                    res.api.error = Err.badRequest('Email already assigned to another account');
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

                        res.api.error = Err.badRequest('Address already present');
                        next();
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

                                        Stream.update({ object: 'profile', user: user._id }, req);
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

                                res.api.error = Err.badRequest('Email must be verified before made primary');
                                next();
                            }
                        }
                        else {

                            res.api.error = Err.badRequest('Address already primary');
                            next();
                        }
                    }
                    else {

                        res.api.error = Err.notFound('No such email address');
                        next();
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

                                        Stream.update({ object: 'profile', user: user._id }, req);
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

                                res.api.error = Err.badRequest('Cannot remove the only address present');
                                next();
                            }
                        }
                        else {

                            res.api.error = Err.badRequest('Cannot remove primary address');
                            next();
                        }
                    }
                    else {

                        res.api.error = Err.notFound('No such email address');
                        next();
                    }

                    break;

                case 'verify':

                    // Verify

                    if (isFound) {

                        if (user.emails[i].isVerified !== true) {

                            Email.sendValidation(user, address, function (err) {

                                if (err === null) {

                                    res.api.result = { result: 'ok' };
                                    next();
                                }
                                else {

                                    res.api.error = err;
                                    next();
                                }
                            });
                        }
                        else {

                            res.api.error = Err.badRequest('Account already verified');
                            next();
                        }
                    }
                    else {

                        res.api.error = Err.notFound('No such email address');
                        next();
                    }
                    break;
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Current user contacts list

exports.contacts = function (req, res, next) {

    if (req.query.exclude) {

        Project.load(req.query.exclude, req.api.userId, false, function (project, member, err) {

            if (err === null) {

                getList(Project.participantsMap(project));
            }
            else {

                res.api.error = err;
                next();
            }
        });
    }
    else {

        getList(null);
    }

    function getList(exclude) {

        exports.load(req.api.userId, function (user, err) {

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

                    res.api.result = contacts;
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


// Who am I?

exports.who = function (req, res, next) {

    res.api.result = { user: req.api.userId };
    next();
};


// Register new user

exports.put = function (req, res, next) {

    // Check invitation code

    var inviteId = null;
    var origin = null;
    var projectPid = null;

    var email = null;
    var isEmailVerified = null;

    if (req.query.invite) {

        // Check code source (invite or project participation)

        if (req.query.invite.indexOf('project:') === 0) {

            // Project participation

            var inviteRegex = /^project:([^:]+):([^:]+):([^:]+)$/;
            var parts = inviteRegex.exec(req.query.invite);

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

                            res.api.error = Err.badRequest('Invalid invitation code');
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

                res.api.error = Err.badRequest('Invalid invitation format');
                next();
            }
        }
        else {

            // Invite code

            Invite.load(req.query.invite, function (invite, err) {

                if (err === null) {

                    inviteId = invite._id;
                    origin = { type: 'invite', invite: inviteId };

                    validate();
                }
                else {

                    res.api.error = err;
                    next();
                }
            });
        }
    }
    else {

        res.api.error = Err.badRequest('Invitation code missing');
        next();
    }

    function validate() {

        // Look for email address

        email = (req.body.email ? req.body.email : (projectPid && projectPid.email ? projectPid.email : null));
        isEmailVerified = (projectPid && projectPid.email && projectPid.email === email ? true : false);

        // Check for at least one identifier

        if (req.body.network ||
            email) {

            validateEmail();
        }
        else {

            res.api.error = Err.badRequest('Must include either a network id or email address');
            next();
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

                        res.api.error = Err.badRequest('Email address already linked to an existing user');
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

            validateNetwork();
        }
    }

    function validateNetwork() {

        if (req.body.network) {

            var isValid = true;
            var error = null;

            if (req.body.network.length === 2) {

                var network = req.body.network[0];
                var networkId = req.body.network[1];

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
                criteria[req.body.network[0]] = req.body.network[1];

                Db.count('user', criteria, function (count, err) {

                    if (err === null) {

                        if (count === 0) {

                            validateUsername();
                        }
                        else {

                            res.api.error = Err.badRequest(req.body.network[0].replace(/^\w/, function ($0) { return $0.toUpperCase(); }) + ' account already linked to an existing user');
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

                res.api.error = Err.badRequest(error);
                next();
            }
        }
        else {

            validateUsername();
        }
    }

    function validateUsername() {

        if (req.body.username) {

            internals.checkUsername(req.body.username, function (lookupUser, err) {

                if (err &&
                    err.code === Err.notFound().code) {

                    createAccount();
                }
                else {

                    res.api.error = (typeof err === 'string' ? Err.badRequest('Invalid username: ' + err) : err);
                    next();
                }
            });
        }
        else {

            createAccount();
        }
    }

    function createAccount() {

        var user = { origin: origin };

        if (req.body.name) {

            user.name = req.body.name;
        }

        if (req.body.username) {

            user.username = req.body.username;
        }

        if (email) {

            user.emails = [{ address: email, isVerified: isEmailVerified}];
        }

        if (req.body.network) {

            user[req.body.network[0]] = req.body.network[1];
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

                                Stream.update({ object: 'project', project: projectPid.project._id }, req);
                                sendWelcome(items[0]);
                            }
                            else {

                                res.api.error = err;
                                next();
                            }
                        });
                    }
                    else {

                        sendWelcome(items[0]);
                    }
                }
                else {

                    res.api.error = Err.internal('Failed to retrieve new user id', user);
                    next();
                }
            }
            else {

                res.api.error = err;
                next();
            }
        });
    }

    function sendWelcome(user) {

        // Send welcome email (also serves as verification email)

        Email.sendWelcome(user, function (err) {    // Ignore error

            res.api.result = { status: 'ok', id: user._id };
            next();
        });
    }
};


// Set Terms of Service version

exports.tos = function (req, res, next) {

    exports.load(req.params.id, function (user, err) {

        if (user) {

            user.tos = user.tos || {};
            user.tos[req.params.version] = Utils.getTimestamp();

            Db.update('user', user._id, { $set: { 'tos': user.tos} }, function (err) {

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


// Link other account

exports.link = function (req, res, next) {

    if (req.params.network === 'facebook' ||
        req.params.network === 'twitter' ||
        req.params.network === 'yahoo') {

        exports.load(req.params.id, function (user, err) {

            if (user) {

                // Check if already has a linked account for this network
                
                if (!user[req.params.network]) {
                
                    // Check if already assigned to someone else

                    var criteria = {};
                    criteria[req.params.network] = req.params.id;

                    Db.count('user', criteria, function (count, err) {

                        if (err === null) {

                            if (count === 0) {

                                var changes = { $set: {} };
                                changes.$set[req.params.network] = req.body.id;

                                Db.update('user', user._id, changes, function (err) {

                                    if (err === null) {

                                        Stream.update({ object: 'profile', user: user._id }, req);
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

                                res.api.error = Err.badRequest('Network id already linked to another user');
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
                
                    res.api.error = Err.badRequest('Network already linked');
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

        res.api.error = Err.badRequest('Unknown network');
        next();
    }
};


// Unlink other account

exports.unlink = function (req, res, next) {

    if (req.params.network === 'facebook' ||
        req.params.network === 'twitter' ||
        req.params.network === 'yahoo') {

        exports.load(req.params.id, function (user, err) {

            if (user) {

                // Is set?

                if (user[req.params.network]) {

                    // Is last (and no email)

                    var linkCount = (user.facebook ? 1 : 0) + (user.twitter ? 1 : 0) + (user.yahoo ? 1 : 0);

                    if ((user.emails && user.emails.length > 0) ||
                        linkCount > 1) {

                        var changes = { $unset: {} };
                        changes.$unset[req.params.network] = 1;

                        Db.update('user', user._id, changes, function (err) {

                            if (err === null) {

                                Stream.update({ object: 'profile', user: user._id }, req);
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

                        res.api.error = Err.badRequest('Cannot remove last linked account');
                        next();
                    }
                }
                else {

                    res.api.error = Err.badRequest('Account not linked');
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

        res.api.error = Err.badRequest('Unknown network');
        next();
    }
};


// Set default view

exports.view = function (req, res, next) {

    exports.load(req.params.id, function (user, err) {

        if (user) {

            Db.update('user', user._id, { $set: { 'view': req.params.path } }, function (err) {

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


// Lookup user based on account and type

exports.lookup = function (req, res, next) {

    if (req.params.type === 'username') {

        internals.checkUsername(req.params.id, function (lookupUser, err) {

            if (lookupUser) {

                res.api.result = { user: lookupUser._id };
                next();
            }
            else {

                res.api.error = (typeof err === 'string' ? Err.badRequest(err) : err);
                next();
            }
        });
    }
    else if (req.params.type === 'email') {

        if (Utils.checkEmail(req.params.id)) {

            Db.queryUnique('user', { 'emails.address': req.params.id }, function (item, err) {

                if (err === null) {

                    if (item) {

                        res.api.result = { user: item._id };
                        next();
                    }
                    else {

                        res.api.error = Err.notFound();
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

            res.api.error = Err.badRequest('Invalid email address');
            next();
        }
    }
    else if (req.params.type === 'facebook' ||
             req.params.type === 'twitter' ||
             req.params.type === 'yahoo') {

        var criteria = {};
        criteria[req.params.type] = req.params.id;

        Db.queryUnique('user', criteria, function (item, err) {

            if (err === null) {

                if (item) {

                    res.api.result = { user: item._id };
                    next();
                }
                else {

                    res.api.error = Err.notFound();
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

        res.api.error = Err.badRequest('Unknown network type');
        next();
    }
};


// Send email reminder account based on email or username and take action

exports.reminder = function (req, res, next) {

    var isEmail = req.body.account.indexOf('@') !== -1;
    var account = req.body.account.toLowerCase();

    if (isEmail === false ||
        Utils.checkEmail(account)) {

        var criteria = {};
        criteria[isEmail ? 'emails.address' : 'username'] = account;

        Db.queryUnique('user', criteria, function (user, err) {

            if (err === null) {

                if (user) {

                    Email.sendReminder(user, function (err) {

                        if (err === null) {

                            res.api.result = { result: 'ok' };
                            next();
                        }
                        else {

                            res.api.error = err;
                            next();
                        }
                    });
                }
                else {

                    res.api.error = Err.notFound();
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

        res.api.error = Err.badRequest();
        next();
    }
};


// Delete account

exports.del = function (req, res, next) {

    // Check if user has any projects

    Project.unsortedList(req.api.userId, function (projects, owner, notOwner, err) {

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

                                    res.api.error = Err.badRequest('Must first delete project');
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

                        res.api.error = Err.badRequest('Must first delete project (has participants)');
                        next();
                    }
                }
                else {

                    // Multiple own projects

                    res.api.error = Err.badRequest('Must first delete all projects');
                    next();
                }
            }
            else {

                // Member of projects

                res.api.error = Err.badRequest('Must first leave all projects');
                next();
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });

    function deleteAccount(projectId) {

        var ignore = function () { };

        // Delete account first

        Db.remove('user', req.api.userId, function (err) {

            if (err === null) {

                // Remove own empty project

                if (projectId) {

                    Project.delEmpty(projectId, ignore);
                }

                // Delete the projects sort list

                Sort.del('project', req.api.userId, ignore);

                // Remove grants

                Session.delUser(req.api.userId, ignore);

                // Remove excluded suggestions

                Suggestions.delUser(req.api.userId, ignore);

                // Remove last

                Last.delUser(req.api.userId, ignore);

                // Remove client storage

                Storage.delUser(req.api.userId, ignore);

                // Return result

                res.api.result = { result: 'ok' }
                next();
            }
            else {

                res.api.error = err;
                next();
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

                    callback(null, Err.notFound());
                }
                else {

                    callback(null, err);
                }
            }
        });
    }
    else {

        callback(null, Err.internal('Missing user id'));
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

                                            callback(null, Err.notFound());
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

            if (Utils.checkEmail(ids[i])) {

                emails.push(ids[i].toLowerCase());
            }
            else {

                isValid = false;
                error = Err.badRequest('Invalid email address');
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

                            users = Utils.unique(users, '_id');

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

                    callback(null, null, Err.badRequest('Invalid user ID: ' + JSON.stringify(notFound)));
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


