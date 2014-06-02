// Load modules

var Path = require('path');
var Hapi = require('hapi');
var Config = require('./config');
var Vault = require('./vault');


// Declare internals

var internals = {};


Config.server.web.uri = (Config.server.web.tls ? 'https://' : 'http://') + Config.server.web.host + ':' + Config.server.web.port;
Config.server.api.uri = (Config.server.api.tls ? 'https://' : 'http://') + Config.server.api.host + ':' + Config.server.api.port;


var manifest = {
    pack: {
        app: {
            config: Config,
            vault: Vault
        }
    },
    servers: [
        {
            host: Config.server.api.host,
            port: Config.server.api.port,
            options: {
                labels: 'api',
                cors: true
            }
        },
        {
            host: Config.server.web.host,
            port: Config.server.web.port,
            options: {
                labels: 'web',
                state: {
                    cookies: {
                        clearInvalid: true
                    }
                }
            }
        }
    ],
    plugins: {
        './postmile-api': [{ select: 'api' }],
        './postmile-web': [{ select: 'web' }]
    }
};


Hapi.Pack.compose(manifest, { relativeTo: Path.join(__dirname, 'node_modules') }, function (err, pack) {

    pack.start();
});

