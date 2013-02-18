// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var Stream = require('./stream');
var Config = require('./config');
var Session = require('./session');
var Routes = require('./routes');
var Suggestions = require('./suggestions');
var Tips = require('./tips');
var Vault = require('./vault');


// Declare internals

var internals = {};


// Catch uncaught exceptions

process.on('uncaughtException', function (err) {

    Hapi.Utils.abort('Uncaught exception: ' + err.stack);
});


// Post handler extension middleware

internals.onPostHandler = function (request, next) {

    if (request.response instanceof Hapi.Boom ||
        !request.response.varieties.obj ||
        request.response.raw instanceof Array) {

        return next();
    }

    // Sanitize database fields

    var payload = request.response.raw;

    if (payload._id) {
        payload.id = payload._id;
        delete payload._id;
    }

    for (var i in payload) {
        if (payload.hasOwnProperty(i)) {
            if (i[0] === '_') {
                delete payload[i];
            }
        }
    }

    request.response.update();
    return next();
};


// Create server

var configuration = {
    auth: {
        scheme: 'oz',
        encryptionPassword: Vault.ozTicket.password,

        loadAppFunc: Session.loadApp,
        loadGrantFunc: Session.loadGrant,
        tos: 20110623
    },
    monitor: true,
    cors: true
};

var server = new Hapi.Server(Config.host.api.domain, Config.host.api.port, configuration);
server.ext('onPostHandler', internals.onPostHandler);
server.route(Routes.endpoints);

Db.initialize(function (err) {

    if (err) {
        Hapi.log.event('err', err);
        process.exit(1);
    }

    Suggestions.initialize();
    Tips.initialize();
    server.start();
    Stream.initialize(server.listener);
});

