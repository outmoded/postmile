// Load modules

var Hapi = require('hapi');
var Validator = require('validator');
var Email = require('emailjs');
var Db = require('./db');
var Vault = require('./vault');
var User = require('./user');
var Config = require('./config');
var Utils = require('./utils');


// Declare internals

var internals = {};


// Generate email ticket

exports.generateTicket = function (user, email, arg1, arg2) {

    var callback = (arg2 ? arg2 : arg1);
    var options = (arg2 ? arg1 : {});

    // Create new ticket

    var now = Date.now();
    var ticketId = now.toString(36);                                                // assuming users cannot generate more than one ticket per msec
    var token = Utils.encrypt(Vault.emailToken.aes256Key, [user._id, ticketId]);

    var ticket = { timestamp: now, email: email };

    if (options.action) {
        ticket.action = options.action;
    }

    if (options.expiresInMin) {
        ticket.expires = now + (options.expiresInMin * 60 * 1000);
    }

    if (options.isSingleUse !== undefined) {
        ticket.isSingleUse = options.isSingleUse;
    }

    var change = { $set: {} };
    change.$set['tickets.' + ticketId] = ticket;

    // Cleanup expired tickets

    if (user.tickets) {
        var expiredIds = [];

        for (var i in user.tickets) {
            if (user.tickets.hasOwnProperty(i)) {
                if (user.tickets[i].expires &&
                    user.tickets[i].expires <= now) {

                    expiredIds.push(i);
                }
            }
        }

        if (expiredIds.length > 0) {
            change.$unset = {};

            for (i = 0, il = expiredIds.length; i < il; ++i) {
                change.$unset['tickets.' + expiredIds[i]] = 1;
            }
        }
    }

    // Save changes

    Db.update('user', user._id, change, function (err) {

        if (err) {
            return callback(err);
        }

        return callback(null, token);
    });
};


// Parse email ticket

exports.loadTicket = function (token, callback) {

    // Decode ticket

    var record = Utils.decrypt(Vault.emailToken.aes256Key, token);

    if (!record ||
        record instanceof Array === false ||
        record.length !== 2) {

        return callback(Hapi.Error.internal('Invalid email token syntax'));
    }

    var userId = record[0];
    var ticketId = record[1];

    // Load user

    User.load(userId, function (err, user) {

        if (err || !user) {
            return callback(Hapi.Error.notFound('Unknown email token account'));
        }

        // Lookup ticket

        if (!user.tickets ||
            !user.tickets[ticketId]) {

            return callback(Hapi.Error.notFound('Invalid or expired email token'), null, user);
        }

        var ticket = user.tickets[ticketId];
        var now = Date.now();

        // Check expiration

        if ((ticket.expires || Infinity) <= now) {

            return callback(Hapi.Error.notFound('Expired email token'), null, user);        // Don't cleanup now, do it later
        }

        // Verify email is still in user emails

        var email = null;
        for (var i = 0, il = user.emails.length; i < il; ++i) {
            if (ticket.email &&
                user.emails[i].address === ticket.email) {

                email = user.emails[i];
                break;
            }
        }

        if (!email) {
            return callback(Hapi.Error.notFound('Email token sent to address no longer associated with this account'), null, user);     // Don't cleanup now, do it later
        }

        if (!email.isVerified &&
            !ticket.isSingleUse) {

            return callback(null, ticket, user);
        }

        var change = {};
        var criteria = null;

        // Mark as verified

        if (email.isVerified !== true) {
            criteria = { 'emails.address': email.address };
            change.$set = { 'emails.$.isVerified': true };
        }

        // While at it, cleanup expired tickets

        if (user.tickets) {
            var expiredIds = [];

            for (i in user.tickets) {
                if (user.tickets.hasOwnProperty(i)) {
                    if (user.tickets[i].expires &&
                        user.tickets[i].expires <= now) {

                        expiredIds.push(i);
                    }
                }
            }

            if (expiredIds.length > 0) {
                change.$unset = change.$unset || {};
                for (i = 0, il = expiredIds.length; i < il; ++i) {
                    change.$unset['tickets.' + expiredIds[i]] = 1;
                }
            }
        }

        // Remove single use token

        if (ticket.isSingleUse) {
            change.$unset = change.$unset || {};
            change.$unset['tickets.' + ticketId] = 1;
        }

        // Save changes

        if (criteria) {
            Db.updateCriteria('user', user._id, criteria, change, function (err) {

                if (err) {
                    return callback(err);
                }

                return callback(null, ticket, user);
            });
        }
        else {

            Db.update('user', user._id, change, function (err) {

                if (err) {
                    return callback(err);
                }

                return callback(null, ticket, user);
            });
        }
    });
};


// Login reminder

exports.sendReminder = function (user, callback) {

    if (!user ||
        !user.emails ||
        !user.emails[0] ||
        !user.emails[0].address) {

        return callback(Hapi.Error.internal('User has no email address'));
    }

    var options = { action: { type: 'reminder' }, expiresInMin: 20160 };                      // Two weeks
    exports.generateTicket(user, user.emails[0].address, options, function (err, ticket) {

        if (err || !ticket) {
            return callback(err);
        }

        var subject = 'Help signing into ' + Config.product.name;
        var text = 'Hey ' + (user.name || user.username || user.emails[0].address) + ',\n\n' +
               'Use this link to sign into ' + Config.product.name + ': \n\n' +
               '    ' + Config.host.uri('web') + '/t/' + ticket;

        internals.sendEmail(user.emails[0].address, subject, text);
        return callback(null);
    });
};


// New address validation

exports.sendValidation = function (user, address, callback) {

    if (!user ||
        !address) {

        return callback(Hapi.Error.internal('User has no email address'));
    }

    var options = { action: { type: 'verify' }, expiresInMin: 1440, isSingleUse: true };                           // One day
    exports.generateTicket(user, address, options, function (err, ticket) {

        if (err || !ticket) {
            return callback(err);
        }

        var subject = 'Verify your email addess with ' + Config.product.name;
        var text = 'Hey ' + (user.name || user.username || address) + ',\n\n' +
               'Use this link to verify your email address: \n\n' +
               '    ' + Config.host.uri('web') + '/t/' + ticket;

        internals.sendEmail(address, subject, text);
        return callback(null);
    });
};


// New address validation

exports.sendWelcome = function (user, callback) {

    if (!user ||
        !user.emails ||
        !user.emails[0] ||
        !user.emails[0].address) {

        return callback(Hapi.Error.internal('User has no email address'));
    }

    var options = null;
    var address = user.emails[0].address;
    var subject = 'Welcome to ' + Config.product.name;
    var text = 'Hey ' + (user.name || user.username || address) + ',\n\n' +
               'We are excited to have you!\n\n';

    if (user.emails[0].isVerified !== true) {

        // Email verification email

        options = { action: { type: 'verify' }, expiresInMin: 1440, isSingleUse: true };                           // One day
        exports.generateTicket(user, address, options, function (err, ticket) {

            if (err || !ticket) {
                return callback(err);
            }

            text += 'Use this link to verify your email address: \n\n';
            text += '    ' + Config.host.uri('web') + '/t/' + ticket + '\n\n';

            internals.sendEmail(address, subject, text);
            return callback(null);
        });
    }
    else if (user.twitter ||
             user.facebook ||
             user.yahoo) {

        // Plain link

        text += 'Use this link to sign-into ' + Config.product.name + ': \n\n';
        text += '    ' + Config.host.uri('web') + '/\n\n';

        internals.sendEmail(address, subject, text);
        return callback(null);
    }
    else {

        // Login link email

        options = { action: { type: 'reminder' }, expiresInMin: 20160 };                      // Two weeks
        exports.generateTicket(user, address, options, function (err, ticket) {

            if (err || !ticket) {
                return callback(err);
            }

            text += 'Since you have not yet linked a Facebook, Twitter, or Yahoo! account, you will need to use this link to sign back into ' + Config.product.name + ': \n\n';
            text += '    ' + Config.host.uri('web') + '/t/' + ticket + '\n\n';

            internals.sendEmail(address, subject, text);
            return callback(null);
        });
    }
};


// Invite project participants

exports.projectInvite = function (users, pids, project, message, inviter) {

    if (!inviter ||
        !inviter.emails ||
        !inviter.emails[0] ||
        !inviter.emails[0].address) {

        return;
    }

    var subject = null;
    var link = null;
    var from = (inviter.name || inviter.username) ? (inviter.name || inviter.username) + ' (' + inviter.emails[0].address + ')'
                                                  : inviter.emails[0].address;

    var text = from + ' invited you to collaborate on \'' + project.title + '\'' +
               (message ? ', and included the following message: ' + message : '.') + '\n\n';

    // Existing users

    for (var i = 0, il = users.length; i < il; ++i) {
        if (users[i].emails &&
            users[i].emails[0] &&
            users[i].emails[0].address) {

            subject = 'Invitation to participate in ' + project.title;
            link = 'Use this link to join: \n\n' +
                   '    ' + Config.host.uri('web') + '/view/#project=' + project._id;

            internals.sendEmail(users[i].emails[0].address,
                                subject,
                                'Hi ' + (users[i].name || users[i].username || users[i].emails[0].address) + ',\n\n' + text + link);
        }
    }

    // New users

    for (i = 0, il = pids.length; i < il; ++i) {
        var pid = pids[i];            // { pid, display, isPending, email, code, inviter }
        if (pid.email) {
            subject = 'Invitation to join ' + Config.product.name + ' and participate in ' + project.title;
            var invite = 'project:' + project._id + ':' + pid.pid + ':' + pid.code;
            link = 'Use this link to join: \n\n' +
                   '    ' + Config.host.uri('web') + '/i/' + invite;

            internals.sendEmail(pid.email, subject, 'Hi ' + (pid.display || pid.email) + ',\n\n' + text + link);
        }
    }
};


// Check if a valid email address

exports.checkAddress = function (email) {

    try {
        Validator.check(email).len(6, 64).isEmail();
    }
    catch (e) {
        return false;
    }

    return true;
};


internals.sendEmail = function (to, subject, text) {

    var headers = {
        from: (Config.email.fromName || 'Postmaster') + ' <' + (Config.email.replyTo || 'no-reply@localhost') + '>',
        to: to,
        subject: subject,
        text: text
    };

    var message = Email.message.create(headers);
    var mailer = Email.server.connect(Config.email.server || {});
    mailer.send(message, function (err, message) {

        if (err) {
            Hapi.Log.event('err', 'Email error', { to: to, subject: subject, text: text, error: err });
        }
    });
};






