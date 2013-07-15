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


// Post handler extension middleware

internals.onPreResponse = function (request, next) {

    var response = request.response();
    if (response instanceof Hapi.Boom ||
        !response.varieties.obj ||
        response.raw instanceof Array) {

        return next();
    }

    // Sanitize database fields

    var payload = response.raw;

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

    response.update();
    return next();
};


// Create server

var server = new Hapi.Server(Config.server.api.host, Config.server.api.port, { cors: true });

//        tos: 20110623

var plugins = {
    tv: null,
    good: null,
    scarecrow: {
        defaultMode: true,
        oz: {
            encryptionPassword: Vault.ozTicket.password,
            loadAppFunc: Session.loadApp,
            loadGrantFunc: Session.loadGrant
        }
    }
};

server.pack.allow({ ext: true }).require(plugins, function (err) {

    Hapi.utils.assert(!err, 'Failed loading plugin: ' + err);

    server.ext('onPreResponse', internals.onPreResponse);
    server.route(Routes.endpoints);

    Db.initialize(function (err) {

        if (err) {
            console.log(err);
            process.exit(1);
        }

        Suggestions.initialize();
        Tips.initialize();
        server.start(function () {

            Stream.initialize(server.listener);
        });
    });
});


server.on('internalError', function (request, err) {

    console.log(err);
});

