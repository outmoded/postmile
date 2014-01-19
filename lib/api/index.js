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

internals.onPreResponse = function (request, reply) {

    var response = request.response;
    if (!response.isBoom &&
        response.variety === 'plain' &&
        response.source instanceof Array === false) {

        // Sanitize database fields

        var payload = response.source;

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
    }

    return reply();
};


// Create server

var server = new Hapi.Server(Config.server.api.host, Config.server.api.port, { cors: true });

//        tos: 20110623

var plugins = {
    tv: null,
    good: null,
    scarecrow: null
};

server.pack.require(plugins, function (err) {

    Hapi.utils.assert(!err, 'Failed loading plugin: ' + err);

    server.auth.strategy('oz', 'oz', true, {
        oz: {
            encryptionPassword: Vault.ozTicket.password,
            loadAppFunc: Session.loadApp,
            loadGrantFunc: Session.loadGrant
        }
    });

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

