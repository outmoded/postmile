/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var SocketIO = require('socket.io');
var Utils = require('./utils');
var Sled = require('./sled');
var Session = require('./session');
var Log = require('./log');
var Err = require('./error');


// Declare internals

var internals = {

    // Updates queue

    updatesQueue: [],

    // Clients list

    clientsBySessionId: {},     // { _sessionId_: { client: _client_, userId: _userId_ }, ... }
    sessionIdsBySled: {},       // { _sledId_: { _sessionId_: true, ... }, ... }
    sessionIdsByUserId: {},     // { _userId_: { _sessionId_: true, ... }, ... }
    sledsBySessionId: {}        // { _sessionId_: { _sledId_: true, ... }, ... }
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

                // Lookup sled

                Sled.load(req.params.sled, req.api.userId, false, function (sled, member, err) {

                    if (err === null) {

                        // Add to subscriber list

                        internals.sessionIdsBySled[sled._id] = internals.sessionIdsBySled[sled._id] || {};
                        internals.sessionIdsBySled[sled._id][req.params.id] = true;

                        // Add to cleanup list

                        internals.sledsBySessionId[req.params.id] = internals.sledsBySessionId[req.params.id] || {};
                        internals.sledsBySessionId[req.params.id][sled._id] = true;

                        // Send ack via the stream

                        client.send({ type: 'subscribe', sled: sled._id });

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

                if (internals.sessionIdsBySled[req.params.sled] &&
                    internals.sessionIdsBySled[req.params.sled][req.params.id]) {

                    delete internals.sessionIdsBySled[req.params.sled][req.params.id];

                    // Remove from cleanup list

                    if (internals.sledsBySessionId[req.params.id]) {

                        delete internals.sledsBySessionId[req.params.id][req.params.sled];
                    }

                    // Send ack via the stream

                    client.send({ type: 'unsubscribe', sled: req.params.sled });

                    // Send ack via the request

                    res.api.result = { status: 'ok' };
                    next();
                }
                else {

                    res.api.error = Err.notFound('Sled subscription not found');
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

exports.drop = function (userId, sledId) {

    var userSessionIds = internals.sessionIdsByUserId[userId];
    if (userSessionIds) {

        var sledSessionIds = internals.sessionIdsBySled[sledId];
        if (sledSessionIds) {

            for (var i in userSessionIds) {

                if (userSessionIds.hasOwnProperty(i)) {

                    if (sledSessionIds[i]) {

                        delete internals.sessionIdsBySled[sledId][i];

                        // Send ack via the stream

                        if (internals.clientsBySessionId[i] &&
                            internals.clientsBySessionId[i].client) {

                            internals.clientsBySessionId[i].client.send({ type: 'unsubscribe', sled: sledId });
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

        var sleds = internals.sledsBySessionId[client.sessionId];
        if (sleds) {

            for (var i in sleds) {

                if (sleds.hasOwnProperty(i)) {

                    if (internals.sessionIdsBySled[i]) {

                        delete internals.sessionIdsBySled[i][client.sessionId];
                    }
                }
            }
        }

        // Remove from cleanup list

        delete internals.sledsBySessionId[client.sessionId];
    };
}


// Updates interval

internals.processUpdates = function () {

    for (var i = 0, il = internals.updatesQueue.length; i < il; ++i) {

        var update = internals.updatesQueue[i];
        var updatedSessionIds = '';

        switch (update.object) {

            case 'sled':
            case 'tasks':
            case 'task':
            case 'details':

                // Lookup sled list

                var sessionIds = internals.sessionIdsBySled[update.sled];
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
            case 'sleds':

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

            Log.info('Stream update: ' + update.object + ':' + (update.user || update.sled) + ' sent to' + updatedSessionIds);
        }
    }

    internals.updatesQueue = [];
};




