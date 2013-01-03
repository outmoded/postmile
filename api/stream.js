// Load modules

var Hapi = require('hapi');
var SocketIO = require('socket.io');
var Project = require('./project');
var Session = require('./session');


// Declare internals

var internals = {

    // Updates queue

    updatesQueue: [],

    // Sockets list

    socketsById: {},     // { _id_: { socket: _socket_, userId: _userId_ }, ... }
    idsByProject: {},    // { _projectId_: { _id_: true, ... }, ... }
    idsByUserId: {},     // { _userId_: { _id_: true, ... }, ... }
    projectsById: {}     // { _id_: { _projectId_: true, ... }, ... }
};



// Initialize

exports.initialize = function (server) {

    internals.io = SocketIO.listen(server, { 'log level': 0 });
    internals.io.sockets.on('connection', internals.connection);

    setInterval(internals.processUpdates, 1000);
};


// Add update to queue

exports.update = function (update, request) {

    update.type = 'update';

    if (request) {

        if (request.session.user) {

            update.by = request.session.user;
        }

        if (request.session &&
            request.session.id) {

            update.macId = request.session.id.slice(0, 8);
        }
    }

    internals.updatesQueue.push(update);
};


// Subscribe

exports.subscribe = {
    
    handler: function (request) {

        // Lookup socket

        if (internals.socketsById[request.params.id] &&
            internals.socketsById[request.params.id].socket) {

            if (internals.socketsById[request.params.id].userId) {

                if (internals.socketsById[request.params.id].userId === request.session.user) {

                    var socket = internals.socketsById[request.params.id].socket;

                    // Lookup project

                    Project.load(request.params.project, request.session.user, false, function (err, project, member) {

                        if (!err) {

                            // Add to subscriber list

                            internals.idsByProject[project._id] = internals.idsByProject[project._id] || {};
                            internals.idsByProject[project._id][request.params.id] = true;

                            // Add to cleanup list

                            internals.projectsById[request.params.id] = internals.projectsById[request.params.id] || {};
                            internals.projectsById[request.params.id][project._id] = true;

                            // Send ack via the stream

                            socket.json.send({ type: 'subscribe', project: project._id });

                            // Send ack via the request

                            request.reply({ status: 'ok' });
                        }
                        else {

                            request.reply(err);
                        }
                    });
                }
                else {

                    request.reply(Hapi.Error.forbidden());
                }
            }
            else {

                request.reply(Hapi.Error.badRequest('Stream not initialized'));
            }
        }
        else {

            request.reply(Hapi.Error.notFound('Stream not found'));
        }
    }
};


// Unsubscribe

exports.unsubscribe = {
    
    handler: function (request) {

        // Lookup socket

        if (internals.socketsById[request.params.id] &&
            internals.socketsById[request.params.id].socket) {

            if (internals.socketsById[request.params.id].userId) {

                if (internals.socketsById[request.params.id].userId === request.session.user) {

                    var socket = internals.socketsById[request.params.id].socket;

                    // Remove from subscriber list

                    if (internals.idsByProject[request.params.project] &&
                        internals.idsByProject[request.params.project][request.params.id]) {

                        delete internals.idsByProject[request.params.project][request.params.id];

                        // Remove from cleanup list

                        if (internals.projectsById[request.params.id]) {

                            delete internals.projectsById[request.params.id][request.params.project];
                        }

                        // Send ack via the stream

                        socket.json.send({ type: 'unsubscribe', project: request.params.project });

                        // Send ack via the request

                        request.reply({ status: 'ok' });
                    }
                    else {

                        request.reply(Hapi.Error.notFound('Project subscription not found'));
                    }
                }
                else {

                    request.reply(Hapi.Error.forbidden());
                }
            }
            else {

                request.reply(Hapi.Error.badRequest('Stream not initialized'));
            }
        }
        else {

            request.reply(Hapi.Error.notFound('Stream not found'));
        }
    }
};


// Force unsubscribe

exports.drop = function (userId, projectId) {

    var userIds = internals.idsByUserId[userId];
    if (userIds) {

        var projectIds = internals.idsByProject[projectId];
        if (projectIds) {

            for (var i in userIds) {

                if (userIds.hasOwnProperty(i)) {

                    if (projectIds[i]) {

                        delete internals.idsByProject[projectId][i];

                        // Send ack via the stream

                        if (internals.socketsById[i] &&
                            internals.socketsById[i].socket) {

                            internals.socketsById[i].socket.json.send({ type: 'unsubscribe', project: projectId });
                        }
                    }
                }
            }
        }
    }
};


// New Socket

internals.connection = function (socket) {

    // Add to sockets map

    internals.socketsById[socket.id] = { socket: socket };

    // Setup handlers

    socket.on('message', internals.messageHandler(socket));
    socket.on('disconnect', internals.disconnectHandler(socket));

    // Send session id

    socket.json.send({ type: 'connect', session: socket.id });
};


// Stream message handler

internals.messageHandler = function (socket) {

    return function (message) {

        var connection = internals.socketsById[socket.id];
        if (connection) {
            if (message) {
                switch (message.type) {
                    case 'initialize':
                        Session.validate(socket.id, message.id, message.mac, function (err, userId) {

                            if (userId) {
                                connection.userId = userId;

                                internals.idsByUserId[userId] = internals.idsByUserId[userId] || {};
                                internals.idsByUserId[userId][socket.id] = true;

                                socket.json.send({ type: 'initialize', status: 'ok', user: userId });
                            }
                            else {
                                socket.json.send({ type: 'initialize', status: 'error', error: err });
                            }
                        });
                        break;

                    default:
                        socket.json.send({ type: 'error', error: 'Unknown message type: ' + message.type });
                        break;
                }
            }
        }
        else {
            // Message received after disconnect from socket
        }
    };
}


// Stream disconnection handler

internals.disconnectHandler = function (socket) {

    return function () {

        if (internals.socketsById[socket.id]) {

            var userId = internals.socketsById[socket.id].userId;

            // Remove from users list

            if (userId) {

                delete internals.idsByUserId[userId];
            }

            // Remove from sockets list

            delete internals.socketsById[socket.id];
        }

        // Remove from subscribers list

        var projects = internals.projectsById[socket.id];
        if (projects) {

            for (var i in projects) {

                if (projects.hasOwnProperty(i)) {

                    if (internals.idsByProject[i]) {

                        delete internals.idsByProject[i][socket.id];
                    }
                }
            }
        }

        // Remove from cleanup list

        delete internals.projectsById[socket.id];
    };
}


// Updates interval

internals.processUpdates = function () {

    for (var i = 0, il = internals.updatesQueue.length; i < il; ++i) {

        var update = internals.updatesQueue[i];
        var updatedIds = '';

        switch (update.object) {

            case 'project':
            case 'tasks':
            case 'task':
            case 'details':

                // Lookup project list

                var ids = internals.idsByProject[update.project];
                if (ids) {

                    for (var s in ids) {

                        if (ids.hasOwnProperty(s)) {

                            if (internals.socketsById[s] &&
                                internals.socketsById[s].socket) {

                                internals.socketsById[s].socket.json.send(update);
                                updatedIds += ' ' + s;
                            }
                        }
                    }
                }

                break;

            case 'profile':
            case 'contacts':
            case 'projects':

                var ids = internals.idsByUserId[update.user];
                if (ids) {

                    for (var s in ids) {

                        if (ids.hasOwnProperty(s)) {

                            if (internals.socketsById[s] &&
                                internals.socketsById[s].socket) {

                                internals.socketsById[s].socket.json.send(update);
                                updatedIds += ' ' + s;
                            }
                        }
                    }
                }

                break;
        }
    }

    internals.updatesQueue = [];
};




