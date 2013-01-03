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

exports.get = {
    auth: {
        tos: null
    },
    handler: function (request) {

        exports.load(request.session.user, function (err, user) {

            if (user) {
                Hapi.Utils.removeKeys(user, ['contacts', 'origin', 'tos', 'tickets']);
                return request.reply(user);
            }
            else {
                return request.reply(err);
            }
        });
    }
};


// Change profile properties

exports.post = {
    validate: {
        schema: {
            name: Hapi.types.String(),
            username: Hapi.types.String().emptyOk()
        }
    },
    auth: {
        tos: null
    },
    handler: function (request) {

        exports.load(request.session.user, function (err, user) {

            if (err || !user) {
                return request.reply(err);
            }

            // Remove identical username

            if (request.payload.username &&
                request.payload.username === user.username) {

                delete request.payload.username;
            }

            // Lookup username

            if (request.payload.username) {
                internals.checkUsername(request.payload.username, function (err, lookupUser) {

                    if (!err ||
                        err.code !== Hapi.Error.notFound().code) {

                        return request.reply(typeof err === 'string' ? Hapi.Error.badRequest('Invalid username: ' + err) : err);
                    }

                    Db.update('user', user._id, Db.toChanges(request.payload), function (err) {

                        if (err) {
                            return request.reply(err);
                        }

                        Stream.update({ object: 'profile', user: user._id }, request);
                        return request.reply({ status: 'ok' });
                    });
                });
            }
            else {
                Db.update('user', user._id, Db.toChanges(request.payload), function (err) {

                    if (err) {
                        return request.reply(err);
                    }

                    Stream.update({ object: 'profile', user: user._id }, request);
                    return request.reply({ status: 'ok' });
                });
            }
        });
    }
};


// Change profile email settings

exports.email = {
    validate: {
        schema: {
            address: Hapi.types.String().required(),
            action: Hapi.types.String().required().valid('remove', 'primary', 'add', 'verify')
        }
    },
    auth: {
        tos: null
    },
    handler: function (request) {

        var address = request.payload.address.toLowerCase();
        exports.load(request.session.user, function (err, user) {

            if (err || !user) {
                return request.reply(err);
            }

            // Find the address

            var isFound = false;
            user.emails = user.emails || [];
            for (var i = 0, il = user.emails.length; i < il; ++i) {
                if (user.emails[i].address === address) {
                    isFound = true;
                    break;
                }
            }

            if (request.payload.action === 'add') {

                // Add

                if (isFound) {
                    return request.reply(Hapi.Error.badRequest('Address already present'));
                }

                // Check is already used by someone else

                Db.count('user', { 'emails.address': address }, function (err, count) {

                    if (err) {
                        return request.reply(err);
                    }

                    if (count) {
                        return request.reply(Hapi.Error.badRequest('Email already assigned to another account'));
                    }

                    // Save

                    Db.update('user', user._id, { '$push': { emails: { address: address, isVerified: false } } }, function (err) {

                        if (err) {
                            return request.reply(err);
                        }

                        Email.sendValidation(user, address, function (err) {

                            // Ignore errors

                            Stream.update({ object: 'profile', user: user._id }, request);
                            return request.reply({ status: 'ok' });
                        });
                    });
                });
            }
            else if (request.payload.action === 'primary') {

                // Primary

                if (!isFound) {
                    return request.reply(Hapi.Error.notFound('No such email address'));
                }

                // Check if current primary

                if (i === 0) {
                    return request.reply(Hapi.Error.badRequest('Address already primary'));
                }

                // Check if verified

                if (!user.emails[i].isVerified) {
                    return request.reply(Hapi.Error.badRequest('Email must be verified before made primary'));
                }

                // Remove from list

                user.emails.splice(i, 1);

                // Add back at head

                user.emails.unshift({ address: address, isVerified: true });

                // OVerride entire array

                Db.update('user', user._id, { '$set': { 'emails': user.emails } }, function (err) {

                    if (err) {
                        return request.reply(err);
                    }

                    Stream.update({ object: 'profile', user: user._id }, request);
                    return request.reply({ status: 'ok' });
                });
            }
            else if (request.payload.action === 'remove') {

                // Remove

                if (!isFound) {
                    return request.reply(Hapi.Error.notFound('No such email address'));
                }

                // Check if current primary

                if (i === 0) {
                    return request.reply(Hapi.Error.badRequest('Cannot remove primary address'));
                }

                if (user.emails.length <= 1) {
                    return request.reply(Hapi.Error.badRequest('Cannot remove the only address present'));
                }

                // Save

                Db.update('user', user._id, { '$pull': { emails: { address: address } } }, function (err) {

                    if (err) {
                        return request.reply(err);
                    }

                    Stream.update({ object: 'profile', user: user._id }, request);
                    return request.reply({ status: 'ok' });
                });
            }
            else if (request.payload.action === 'verify') {

                // Verify

                if (!isFound) {
                    return request.reply(Hapi.Error.notFound('No such email address'));
                }

                if (user.emails[i].isVerified) {
                    return request.reply(Hapi.Error.badRequest('Account already verified'));
                }

                Email.sendValidation(user, address, function (err) {

                    if (err) {
                        return request.reply(err);
                    }

                    return request.reply({ result: 'ok' });
                });
            }
        });
    }
};


// Current user contacts list

exports.contacts = {
    query: {
        exclude: Hapi.types.String()
    },
    auth: {
        tos: null
    },
    handler: function (request) {

        var load = function () {

            if (request.query.exclude) {
                Project.load(request.query.exclude, request.session.user, false, function (err, project, member) {

                    if (err) {
                        return request.reply(err);
                    }

                    getList(Project.participantsMap(project));
                });
            }
            else {
                getList(null);
            }
        };

        var getList = function (exclude) {

            exports.load(request.session.user, function (err, user) {

                if (err || !user) {
                    return request.reply(err);
                }

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

                    return request.reply(contacts);
                });
            });
        };

        load();
    }
};


// Who am I?

exports.who = {
    auth: {
        tos: null
    },
    handler: function (request) {

        return request.reply({ user: request.session.user });
    }
};


// Register new user

exports.put = {
    validate: {
        query: {
            invite: Hapi.types.String().required()
        },
        schema: {
            username: Hapi.types.String(),
            name: Hapi.types.String(),
            network: Hapi.types.Array().includes(Hapi.types.String()),
            email: Hapi.types.String().email()
        }
    },
    auth: {
        scope: 'signup',
        entity: 'app'
    },
    handler: function (request) {

        // Check invitation code

        var inviteId = null;
        var origin = null;
        var projectPid = null;

        var email = null;
        var isEmailVerified = null;

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

                Db.get('project', projectId, function (err, project) {

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

                            return request.reply(Hapi.Error.badRequest('Invalid invitation code'));
                        }
                    }
                    else {

                        return request.reply(err);
                    }
                });
            }
            else {

                return request.reply(Hapi.Error.badRequest('Invalid invitation format'));
            }
        }
        else {

            // Invite code

            Invite.load(request.query.invite, function (err, invite) {

                if (!err) {

                    inviteId = invite._id;
                    origin = { type: 'invite', invite: inviteId };

                    validate();
                }
                else {

                    return request.reply(err);
                }
            });
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

                return request.reply(Hapi.Error.badRequest('Must include either a network id or email address'));
            }
        }

        function validateEmail() {

            if (email) {

                Db.count('user', { 'emails.address': email }, function (err, count) {

                    if (!err) {

                        if (count === 0) {

                            validateNetwork();
                        }
                        else {

                            return request.reply(Hapi.Error.badRequest('Email address already linked to an existing user'));
                        }
                    }
                    else {

                        return request.reply(err);
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

                    Db.count('user', criteria, function (err, count) {

                        if (!err) {

                            if (count === 0) {

                                validateUsername();
                            }
                            else {

                                return request.reply(Hapi.Error.badRequest(request.payload.network[0].replace(/^\w/, function ($0) { return $0.toUpperCase(); }) + ' account already linked to an existing user'));
                            }
                        }
                        else {

                            return request.reply(err);
                        }
                    });
                }
                else {

                    return request.reply(Hapi.Error.badRequest(error));
                }
            }
            else {

                validateUsername();
            }
        }

        function validateUsername() {

            if (request.payload.username) {

                internals.checkUsername(request.payload.username, function (err, lookupUser) {

                    if (err &&
                        err.code === Hapi.Error.notFound().code) {

                        createAccount();
                    }
                    else {

                        return request.reply(typeof err === 'string' ? Hapi.Error.badRequest('Invalid username: ' + err) : err);
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

                user.emails = [{ address: email, isVerified: isEmailVerified }];
            }

            if (request.payload.network) {

                user[request.payload.network[0]] = request.payload.network[1];
            }

            Db.insert('user', user, function (err, items) {

                if (!err) {

                    if (items.length === 1 &&
                        items[0]._id) {

                        var userId = items[0]._id;

                        if (inviteId) {

                            // Decrease invitation count

                            Db.update('invite', inviteId, { $inc: { count: 1 } }, function (err) { });
                        }

                        if (projectPid) {

                            // Update project with new participant

                            Project.replacePid(projectPid.project, projectPid.pid, userId, function (err) {

                                if (!err) {

                                    Stream.update({ object: 'project', project: projectPid.project._id }, request);
                                    sendWelcome(items[0]);
                                }
                                else {

                                    return request.reply(err);
                                }
                            });
                        }
                        else {

                            sendWelcome(items[0]);
                        }
                    }
                    else {

                        return request.reply(Hapi.Error.internal('Failed to retrieve new user id', user));
                    }
                }
                else {

                    return request.reply(err);
                }
            });
        }

        function sendWelcome(user) {

            // Send welcome email (also serves as verification email)

            Email.sendWelcome(user, function (err) {    // Ignore error

                return request.reply({ status: 'ok', id: user._id });
            });
        }
    }
};


// Set Terms of Service version

exports.tos = {

    auth: {
        tos: null,
        scope: 'tos',
        entity: 'app'
    },

    handler: function (request) {

        exports.load(request.params.id, function (err, user) {

            if (user) {

                user.tos = user.tos || {};
                user.tos[request.params.version] = Date.now();

                Db.update('user', user._id, { $set: { 'tos': user.tos } }, function (err) {

                    if (!err) {

                        return request.reply({ status: 'ok' });
                    }
                    else {

                        return request.reply(err);
                    }
                });
            }
            else {

                return request.reply(err);
            }
        });
    }
};


// Link other account

exports.link = {
    validate: {
        schema: {
            id: Hapi.types.String().required()
        }
    },
    auth: {
        scope: 'login',
        entity: 'app'
    },
    handler: function (request) {

        if (request.params.network === 'facebook' ||
            request.params.network === 'twitter' ||
            request.params.network === 'yahoo') {

            exports.load(request.params.id, function (err, user) {

                if (user) {

                    // Check if already has a linked account for this network

                    if (!user[request.params.network]) {

                        // Check if already assigned to someone else

                        var criteria = {};
                        criteria[request.params.network] = request.params.id;

                        Db.count('user', criteria, function (err, count) {

                            if (!err) {

                                if (count === 0) {

                                    var changes = { $set: {} };
                                    changes.$set[request.params.network] = request.payload.id;

                                    Db.update('user', user._id, changes, function (err) {

                                        if (!err) {

                                            Stream.update({ object: 'profile', user: user._id }, request);
                                            return request.reply({ status: 'ok' });
                                        }
                                        else {

                                            return request.reply(err);
                                        }
                                    });
                                }
                                else {

                                    return request.reply(Hapi.Error.badRequest('Network id already linked to another user'));
                                }
                            }
                            else {

                                return request.reply(err);
                            }
                        });
                    }
                    else {

                        return request.reply(Hapi.Error.badRequest('Network already linked'));
                    }
                }
                else {

                    return request.reply(err);
                }
            });
        }
        else {

            return request.reply(Hapi.Error.badRequest('Unknown network'));
        }
    }
};


// Unlink other account

exports.unlink = {

    auth: {

        scope: 'login',
        entity: 'app'
    },

    handler: function (request) {

        if (request.params.network === 'facebook' ||
            request.params.network === 'twitter' ||
            request.params.network === 'yahoo') {

            exports.load(request.params.id, function (err, user) {

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

                                if (!err) {

                                    Stream.update({ object: 'profile', user: user._id }, request);
                                    return request.reply({ status: 'ok' });
                                }
                                else {

                                    return request.reply(err);
                                }
                            });
                        }
                        else {

                            return request.reply(Hapi.Error.badRequest('Cannot remove last linked account'));
                        }
                    }
                    else {

                        return request.reply(Hapi.Error.badRequest('Account not linked'));
                    }
                }
                else {

                    return request.reply(err);
                }
            });
        }
        else {

            return request.reply(Hapi.Error.badRequest('Unknown network'));
        }
    }
};


// Set default view

exports.view = {

    auth: {

        scope: 'view',
        entity: 'app'
    },

    handler: function (request) {

        exports.load(request.params.id, function (err, user) {

            if (user) {

                Db.update('user', user._id, { $set: { 'view': request.params.path } }, function (err) {

                    if (!err) {

                        return request.reply({ status: 'ok' });
                    }
                    else {

                        return request.reply(err);
                    }
                });
            }
            else {

                return request.reply(err);
            }
        });
    }
};


// Lookup user based on account and type

exports.lookup = {
    auth: {
        mode: 'none'
    },
    handler: function (request) {

        if (request.params.type === 'username') {

            internals.checkUsername(request.params.id, function (err, lookupUser) {

                if (lookupUser) {

                    return request.reply({ user: lookupUser._id });
                }
                else {

                    return request.reply(typeof err === 'string' ? Hapi.Error.badRequest(err) : err);
                }
            });
        }
        else if (request.params.type === 'email') {

            if (Email.checkAddress(request.params.id)) {

                Db.queryUnique('user', { 'emails.address': request.params.id }, function (err, item) {

                    if (!err) {

                        if (item) {

                            return request.reply({ user: item._id });
                        }
                        else {

                            return request.reply(Hapi.Error.notFound());
                        }
                    }
                    else {

                        return request.reply(err);
                    }
                });
            }
            else {

                return request.reply(Hapi.Error.badRequest('Invalid email address'));
            }
        }
        else if (request.params.type === 'facebook' ||
                 request.params.type === 'twitter' ||
                 request.params.type === 'yahoo') {

            var criteria = {};
            criteria[request.params.type] = request.params.id;

            Db.queryUnique('user', criteria, function (err, item) {

                if (!err) {

                    if (item) {

                        return request.reply({ user: item._id });
                    }
                    else {

                        return request.reply(Hapi.Error.notFound());
                    }
                }
                else {

                    return request.reply(err);
                }
            });
        }
        else {

            return request.reply(Hapi.Error.badRequest('Unknown network type'));
        }
    }
};


// Send email reminder account based on email or username and take action

exports.reminder = {
    validate: {
        schema: {
            account: Hapi.types.String().required()
        }
    },
    auth: {
        scope: 'reminder',
        entity: 'app'
    },
    handler: function (request) {

        var isEmail = request.payload.account.indexOf('@') !== -1;
        var account = request.payload.account.toLowerCase();

        if (isEmail === false ||
            Email.checkAddress(account)) {

            var criteria = {};
            criteria[isEmail ? 'emails.address' : 'username'] = account;

            Db.queryUnique('user', criteria, function (err, user) {

                if (!err) {

                    if (user) {

                        Email.sendReminder(user, function (err) {

                            if (!err) {

                                return request.reply({ result: 'ok' });
                            }
                            else {

                                return request.reply(err);
                            }
                        });
                    }
                    else {

                        return request.reply(Hapi.Error.notFound());
                    }
                }
                else {

                    return request.reply(err);
                }
            });
        }
        else {

            return request.reply(Hapi.Error.badRequest());
        }
    }
};


// Delete account

exports.del = {
    auth: {
        scope: 'quit',
        tos: null
    },
    handler: function (request) {

        // Check if user has any projects

        Project.unsortedList(request.session.user, function (err, projects, owner, notOwner) {

            if (!err) {

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

                            Task.count(owner[0]._id, function (err, count) {

                                if (!err) {

                                    if (count === 0) {

                                        deleteAccount(owner[0]._id);
                                    }
                                    else {

                                        return request.reply(Hapi.Error.badRequest('Must first delete project'));
                                    }
                                }
                                else {

                                    return request.reply(err);
                                }
                            });
                        }
                        else {

                            return request.reply(Hapi.Error.badRequest('Must first delete project (has participants)'));
                        }
                    }
                    else {

                        // Multiple own projects

                        return request.reply(Hapi.Error.badRequest('Must first delete all projects'));
                    }
                }
                else {

                    // Member of projects

                    return request.reply(Hapi.Error.badRequest('Must first leave all projects'));
                }
            }
            else {

                return request.reply(err);
            }
        });

        function deleteAccount(projectId) {

            var ignore = function () { };

            // Delete account first

            Db.remove('user', request.session.user, function (err) {

                if (!err) {

                    // Remove own empty project

                    if (projectId) {

                        Project.delEmpty(projectId, ignore);
                    }

                    // Delete the projects sort list

                    Sort.del('project', request.session.user, ignore);

                    // Remove grants

                    Session.delUser(request.session.user, ignore);

                    // Remove excluded suggestions

                    Suggestions.delUser(request.session.user, ignore);

                    // Remove last

                    Last.delUser(request.session.user, ignore);

                    // Remove client storage

                    Storage.delUser(request.session.user, ignore);

                    // Return result

                    return request.reply({ result: 'ok' });
                }
                else {

                    return request.reply(err);
                }
            });
        }
    }
};


// Load user

exports.load = function (userId, callback) {

    if (userId) {

        Db.get('user', userId, function (err, item) {

            if (item) {

                callback(null, item);
            }
            else {

                if (!err) {

                    callback(Hapi.Error.notFound());
                }
                else {

                    callback(err);
                }
            }
        });
    }
    else {

        callback(Hapi.Error.internal('Missing user id'));
    }
};


// Get user quick info

exports.quick = function (id, callback) {

    Db.get('user', id, function (err, user) {

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

    Db.getMany('user', ids, function (err, items, notFound) {

        if (!err) {

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

                                Db.queryUnique('user', { username: username.toLowerCase() }, function (err, item) {

                                    if (!err) {

                                        if (item) {

                                            // Valid

                                            callback('Already taken', item);
                                        }
                                        else {

                                            callback(Hapi.Error.notFound());
                                        }
                                    }
                                    else {

                                        callback(err);
                                    }
                                });
                            }
                            else {

                                callback('Reserved keyword');
                            }
                        }
                        else {

                            callback('Value must only contain letters, numbers and _');
                        }
                    }
                    else {

                        callback('First character must be a letter');
                    }
                }
                else {

                    callback('Value is too long (maximum 20 characters)');
                }
            }
            else {

                callback('Value is too short (2 characters or more required)');
            }
        }
        else {

            callback('Value is not a string');
        }
    }
    else {

        callback('Value is undefined');
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

            if (Email.checkAddress(ids[i])) {

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

        Db.getMany('user', userIds, function (err, items, notFound) {

            if (!err) {

                var users = items;
                if (items.length === userIds.length) {

                    // Try getting all emails

                    Db.query('user', { 'emails.address': { '$in': emails } }, function (err, items) {

                        if (!err) {

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

                            callback(null, users, emailsNotFound);
                        }
                        else {

                            callback(err);
                        }
                    });
                }
                else {

                    callback(Hapi.Error.badRequest('Invalid user ID: ' + JSON.stringify(notFound)));
                }
            }
            else {

                callback(err);
            }
        });
    }
    else {

        callback(error);
    }
};


// Validate linked account

exports.validate = function (id, network, callback) {

    if (!id) {
        return callback(null, null);
    }

    var criteria = {};
    criteria[network] = id;
    Db.queryUnique('user', criteria, function (err, user) {

        if (err) {
            return callback(err);
        }

        return callback(null, user);
    });
};


