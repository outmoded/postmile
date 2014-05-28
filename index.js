// Load modules

var Hapi = require('hapi');
var Hoek = require('hoek');
var Config = require('./config');
var Vault = require('./vault');


// Declare internals

var internals = {};


Config.server.web.uri = (Config.server.web.tls ? 'https://' : 'http://') + Config.server.web.host + ':' + Config.server.web.port;
Config.server.api.uri = (Config.server.api.tls ? 'https://' : 'http://') + Config.server.api.host + ':' + Config.server.api.port;


// Start API Server

var api = new Hapi.Server(Config.server.api.host, Config.server.api.port, { cors: true });
api.pack.register({ plugin: require('postmile-api'), options: { config: Config, vault: Vault } }, function (err) {

    Hoek.assert(!err, 'Failed loading API:', err);
    api.start(function () {

        // Start Web Server

        var config = {
            state: {
                cookies: {
                    clearInvalid: true
                }
            }
        };

        if (Config.server.web.tls) {
            config.tls = {
                key: Fs.readFileSync(Config.server.web.tls.key),
                cert: Fs.readFileSync(Config.server.web.tls.cert)
            };
        }

        var web = new Hapi.Server(Config.server.web.port, Config.server.web.host, config);
        web.pack.register({ plugin: require('postmile-web'), options: { config: Config, vault: Vault }}, function (err) {

            Hoek.assert(!err, 'Failed loading API:', err);
            web.start();
        });
    });
});


