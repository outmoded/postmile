/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Db = require('./db');
var Utils = require('./utils');
var Err = require('./error');
var Project = require('./project');
var User = require('./user');
var Stream = require('./stream');


// Check invitation code

exports.get = function (req, res, next) {

    // Check invitation code type

    var inviteRegex = /^project:([^:]+):([^:]+):([^:]+)$/;
    var parts = inviteRegex.exec(req.params.id);

    if (parts &&
        parts.length === 4) {

        // Project invitation code

        var projectId = parts[1];
        var pid = parts[2];
        var code = parts[3];

        // Load project (not using Project.load since active user is not a member)

        Db.get('project', projectId, function (project, err) {

            if (project) {

                // Lookup code

                var projectPid = null;

                for (var i = 0, il = project.participants.length; i < il; ++i) {

                    if (project.participants[i].pid &&
                        project.participants[i].pid === pid) {

                        if (project.participants[i].code &&
                            project.participants[i].code === code) {

                            projectPid = project.participants[i];
                            break;
                        }
                        else {

                            // Invalid code
                            break;
                        }
                    }
                }

                if (projectPid) {

                    User.quick(projectPid.inviter, function (inviter) {

                        var about = { title: project.title, project: project._id };

                        if (inviter &&
                            inviter.display) {

                            about.inviter = inviter.display;
                        }

                        res.api.result = about;
                        next();
                    });
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

        // Registration invitation code

        exports.load(req.params.id, function (invite, err) {

            if (err === null) {

                res.api.result = invite;
                next();
            }
            else {

                res.api.error = err;
                next();
            }
        });
    }
};


// Claim a project invitation

exports.claim = function (req, res, next) {

    var inviteRegex = /^project:([^:]+):([^:]+):([^:]+)$/;
    var parts = inviteRegex.exec(req.params.id);

    if (parts &&
        parts.length === 4) {

        var projectId = parts[1];
        var pid = parts[2];
        var code = parts[3];

        // Load project (not using Project.load since active user is not a member)

        Db.get('project', projectId, function (project, err) {

            if (project) {

                // Lookup code

                var projectPid = null;

                for (var i = 0, il = project.participants.length; i < il; ++i) {

                    if (project.participants[i].pid &&
                        project.participants[i].pid === pid) {

                        if (project.participants[i].code &&
                            project.participants[i].code === code) {

                            projectPid = project.participants[i];
                            break;
                        }
                        else {

                            // Invalid code
                            break;
                        }
                    }
                }

                if (projectPid) {

                    Project.replacePid(project, projectPid.pid, req.api.userId, function (err) {

                        if (err === null) {

                            Stream.update({ object: 'project', project: projectId }, req);
                            res.api.result = { status: 'ok', project: projectId };
                            next();
                        }
                        else {

                            res.api.error = err;
                            next();
                        }
                    });
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
};


// Load invitation

exports.load = function (code, callback) {

    Db.queryUnique('invite', { code: code }, function (invite, err) {

        //    { "_id": "4d8629d32d0cba57313953b4",
        //      "code": "emu2011",
        //      "notes": "Eran's friends",
        //      "count": 0,
        //      "limit": 10,
        //      "expires" : 1332173847002 }

        if (err === null) {

            if (invite) {

                // Check expiration

                if ((invite.expires || Infinity) > Utils.getTimestamp()) {

                    // Check count

                    if (invite.limit === undefined ||
                        invite.count === undefined ||
                        invite.count <= invite.limit) {

                        callback(invite, null);
                    }
                    else {

                        callback(null, Err.badRequest('Invitation code reached limit'));
                    }
                }
                else {

                    callback(null, Err.badRequest('Invitation Code expired'));
                }
            }
            else {

                callback(null, Err.notFound('Invitation code not found'));
            }
        }
        else {

            callback(null, err);
        }
    });
};




