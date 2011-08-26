/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var SocketIO = require('socket.io');
var Utils = require('./utils');
var Project = require('./project');
var Session = require('./session');
var Log = require('./log');
var Err = require('./error');


// Declare internals

var internals = {

    // Updates queue

    updatesQueue: [],

    // Clients list

    clientsBySessionId: {},     // { _sessionId_: { client: _client_, userId: _userId_ }, ... }
    sessionIdsByProject: {},    // { _projectId_: { _sessionId_: true, ... }, ... }
    sessionIdsByUserId: {},     // { _userId_: { _sessionId_: true, ... }, ... }
    projectsBySessionId: {}     // { _sessionId_: { _projectId_: true, ... }, ... }
};



// Initialize

exports.initialize = function (server) {

    var socket = SocketIO.listen(server, { log: Log.info });

    socket.on('connection', internals.connection);

    setInterval(internals.processUpdates, 1000);
};


// Add update to queue

exports.update = function (update, req) {

    update.type = 'update';

    if (req &&
        req.api) {

        if (req.api.userId) {

            update.by = req.api.userId;
        }

        if (req.api.session &&
            req.api.session.id) {

            update.macId = req.api.session.id.slice(0, 8);
        }
    }

    internals.updatesQueue.push(update);
};


// Subscribe

exports.subscribe = function (req, res, next) {

    // Lookup client

    if (internals.clientsBySessionId[req.params.id] &&
        internals.clientsBySessionId[req.params.id].client) {

        if (internals.clientsBySessionId[req.params.id].userId) {

            if (internals.clientsBySessionId[req.params.id].userId === req.api.userId) {

                var client = internals.clientsBySessionId[req.params.id].client;

                // Lookup project

                Project.load(req.params.project, req.api.userId, false, function (project, member, err) {

                    if (err === null) {

                        // Add to subscriber list

                        internals.sessionIdsByProject[project._id] = internals.sessionIdsByProject[project._id] || {};
                        internals.sessionIdsByProject[project._id][req.params.id] = true;

                        // Add to cleanup list

                        internals.projectsBySessionId[req.params.id] = internals.projectsBySessionId[req.params.id] || {};
                        internals.projectsBySessionId[req.params.id][project._id] = true;

                        // Send ack via the stream

                        client.send({ type: 'subscribe', project: project._id });

                        // Send ack via the request

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

                res.api.error = Err.forbidden();
                next();
            }
        }
        else {

            res.api.error = Err.badRequest('Stream not initialized');
            next();
        }
    }
    else {

        res.api.error = Err.notFound('Stream not found');
        next();
    }
};


// Unsubscribe

exports.unsubscribe = function (req, res, next) {

    // Lookup client

    if (internals.clientsBySessionId[req.params.id] &&
        internals.clientsBySessionId[req.params.id].client) {

        if (internals.clientsBySessionId[req.params.id].userId) {

            if (internals.clientsBySessionId[req.params.id].userId === req.api.userId) {

                var client = internals.clientsBySessionId[req.params.id].client;

                // Remove from subscriber list

                if (internals.sessionIdsByProject[req.params.project] &&
                    internals.sessionIdsByProject[req.params.project][req.params.id]) {

                    delete internals.sessionIdsByProject[req.params.project][req.params.id];

                    // Remove from cleanup list

                    if (internals.projectsBySessionId[req.params.id]) {

                        delete internals.projectsBySessionId[req.params.id][req.params.project];
                    }

                    // Send ack via the stream

                    client.send({ type: 'unsubscribe', project: req.params.project });

                    // Send ack via the request

                    res.api.result = { status: 'ok' };
                    next();
                }
                else {

                    res.api.error = Err.notFound('Project subscription not found');
                    next();
                }
            }
            else {

                res.api.error = Err.forbidden();
                next();
            }
        }
        else {

            res.api.error = Err.badRequest('Stream not initialized');
            next();
        }
    }
    else {

        res.api.error = Err.notFound('Stream not found');
        next();
    }
};


// Force unsubscribe

exports.drop = function (userId, projectId) {

    var userSessionIds = internals.sessionIdsByUserId[userId];
    if (userSessionIds) {

        var projectSessionIds = internals.sessionIdsByProject[projectId];
        if (projectSessionIds) {

            for (var i in userSessionIds) {

                if (userSessionIds.hasOwnProperty(i)) {

                    if (projectSessionIds[i]) {

                        delete internals.sessionIdsByProject[projectId][i];

                        // Send ack via the stream

                        if (internals.clientsBySessionId[i] &&
                            internals.clientsBySessionId[i].client) {

                            internals.clientsBySessionId[i].client.send({ type: 'unsubscribe', project: projectId });
                        }
                    }
                }
            }
        }
    }
};


// New Client

internals.connection = function (client) {

    // Add to sessions map

    internals.clientsBySessionId[client.sessionId] = { client: client };

    // Setup handlers

    client.on('message', internals.messageHandler(client));
    client.on('disconnect', internals.disconnectHandler(client));

    // Send session id

    client.send({ type: 'connect', session: client.sessionId });
};


// Stream message handler

internals.messageHandler = function (client) {

    return function (message) {

        if (internals.clientsBySessionId[client.sessionId]) {

            if (message) {

                switch (message.type) {

                    case 'initialize':

                        Session.validate(client.sessionId, message.id, message.mac, function (userId, err) {

                            if (userId) {

                                internals.clientsBySessionId[client.sessionId].userId = userId;

                                internals.sessionIdsByUserId[userId] = internals.sessionIdsByUserId[userId] || {};
                                internals.sessionIdsByUserId[userId][client.sessionId] = true;

                                client.send({ type: 'initialize', status: 'ok', user: userId });
                                Log.info('Stream ' + client.sessionId + ' initialized with userId ' + userId);
                            }
                            else {

                                client.send({ type: 'initialize', status: 'error', error: err });
                                Log.err(err);
                            }
                        });

                        break;

                    default:

                        client.send({ type: 'error', error: 'Unknown message type' });
                        break;
                }
            }
        }
        else {

            Log.err('Message received after disconnect from client: ' + client.sessionId + ', message: ' + JSON.stringify(message));
        }
    };
}


// Stream disconnection handler

internals.disconnectHandler = function (client) {

    return function () {

        if (internals.clientsBySessionId[client.sessionId]) {

            var userId = internals.clientsBySessionId[client.sessionId].userId;

            // Remove from users list

            if (userId) {

                delete internals.sessionIdsByUserId[userId];
            }

            // Remove from clients list

            delete internals.clientsBySessionId[client.sessionId];
        }

        // Remove from subscribers list

        var projects = internals.projectsBySessionId[client.sessionId];
        if (projects) {

            for (var i in projects) {

                if (projects.hasOwnProperty(i)) {

                    if (internals.sessionIdsByProject[i]) {

                        delete internals.sessionIdsByProject[i][client.sessionId];
                    }
                }
            }
        }

        // Remove from cleanup list

        delete internals.projectsBySessionId[client.sessionId];
    };
}


// Updates interval

internals.processUpdates = function () {

    for (var i = 0, il = internals.updatesQueue.length; i < il; ++i) {

        var update = internals.updatesQueue[i];
        var updatedSessionIds = '';

        switch (update.object) {

            case 'project':
            case 'tasks':
            case 'task':
            case 'details':

                // Lookup project list

                var sessionIds = internals.sessionIdsByProject[update.project];
                if (sessionIds) {

                    for (var s in sessionIds) {

                        if (sessionIds.hasOwnProperty(s)) {

                            if (internals.clientsBySessionId[s] &&
                                internals.clientsBySessionId[s].client) {

                                internals.clientsBySessionId[s].client.send(update);
                                updatedSessionIds += ' ' + s;
                            }
                        }
                    }
                }

                break;

            case 'profile':
            case 'contacts':
            case 'projects':

                var sessionIds = internals.sessionIdsByUserId[update.user];
                if (sessionIds) {

                    for (var s in sessionIds) {

                        if (sessionIds.hasOwnProperty(s)) {

                            if (internals.clientsBySessionId[s] &&
                                internals.clientsBySessionId[s].client) {

                                internals.clientsBySessionId[s].client.send(update);
                                updatedSessionIds += ' ' + s;
                            }
                        }
                    }
                }

                break;
        }

        if (updatedSessionIds) {

            Log.info('Stream update: ' + update.object + ':' + (update.user || update.project) + ' sent to' + updatedSessionIds);
        }
    }

    internals.updatesQueue = [];
};




