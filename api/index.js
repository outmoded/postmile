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

internals.formatPayload = function (payload) {

    if (typeof payload !== 'object' ||
        payload instanceof Array) {

        return payload;
    }

    // Sanitize database fields

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

    return payload;
};


// Create server

var configuration = {
    format: {
        payload: internals.formatPayload
    },
    auth: {
        scheme: 'oz',
        encryptionPassword: Vault.ozTicket.password,

        loadAppFunc: Session.loadApp,
        loadGrantFunc: Session.loadGrant,
        tos: 20110623
    },
    debug: true,
    monitor: true
};

var server = new Hapi.Server(Config.host.api.domain, Config.host.api.port, configuration);
server.addRoutes(Routes.endpoints);

Db.initialize(function (err) {

    if (err) {
        Hapi.Log.event('err', err);
        process.exit(1);
    }

    Suggestions.initialize();
    Tips.initialize();
    server.start();
    Stream.initialize(server.listener);
});

