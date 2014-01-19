// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var Project = require('./project');
var User = require('./user');
var Stream = require('./stream');


// Check invitation code

exports.get = {
    auth: false,
    handler: function (request, reply) {

        // Check invitation code type

        var inviteRegex = /^project:([^:]+):([^:]+):([^:]+)$/;
        var parts = inviteRegex.exec(request.params.id);

        if (parts &&
            parts.length === 4) {

            // Project invitation code

            var projectId = parts[1];
            var pid = parts[2];
            var code = parts[3];

            // Load project (not using Project.load since active user is not a member)

            Db.get('project', projectId, function (err, project) {

                if (err || !project) {
                    return reply(err);
                }

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

                if (!projectPid) {
                    return reply(Hapi.Error.badRequest('Invalid invitation code'));
                }

                User.quick(projectPid.inviter, function (inviter) {

                    var about = { title: project.title, project: project._id };
                    if (inviter &&
                        inviter.display) {

                        about.inviter = inviter.display;
                    }

                    return reply(about);
                });
            });
        }
        else {

            // Registration invitation code

            exports.load(request.params.id, function (err, invite) {

                if (err) {
                    return reply(err);
                }

                return reply(invite);
            });
        }
    }
};


// Claim a project invitation

exports.claim = {
    handler: function (request, reply) {

        var inviteRegex = /^project:([^:]+):([^:]+):([^:]+)$/;
        var parts = inviteRegex.exec(request.params.id);

        if (!parts ||
            parts.length !== 4) {

            return reply(Hapi.Error.badRequest('Invalid invitation format'));
        }

        var projectId = parts[1];
        var pid = parts[2];
        var code = parts[3];

        // Load project (not using Project.load since active user is not a member)

        Db.get('project', projectId, function (err, project) {

            if (err || !project) {
                return reply(err);
            }

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

            if (!projectPid) {
                return reply(Hapi.Error.badRequest('Invalid invitation code'));
            }

            Project.replacePid(project, projectPid.pid, request.auth.credentials.user, function (err) {

                if (err) {
                    return reply(err);
                }

                Stream.update({ object: 'project', project: projectId }, request);
                return reply({ status: 'ok', project: projectId });
            });
        });
    }
};


// Load invitation

exports.load = function (code, callback) {

    Db.queryUnique('invite', { code: code }, function (err, invite) {

        //    { "_id": "4d8629d32d0cba57313953b4",
        //      "code": "emu2011",
        //      "notes": "Eran's friends",
        //      "count": 0,
        //      "limit": 10,
        //      "expires" : 1332173847002 }

        if (err) {
            return callback(err);
        }

        if (!invite) {
            return callback(Hapi.Error.notFound('Invitation code not found'));
        }

        // Check expiration

        if ((invite.expires || Infinity) <= Date.now()) {
            return callback(Hapi.Error.badRequest('Invitation Code expired'));
        }

        // Check count

        if (invite.limit &&
            invite.count &&
            invite.count > invite.limit) {

            return callback(Hapi.Error.badRequest('Invitation code reached limit'));
        }

        return callback(null, invite);
    });
};




