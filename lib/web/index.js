// Load modules

var Hapi = require('hapi');
var Fs = require('fs');
var Login = require('./login');
var Session = require('./session');
var Vault = require('./vault');
var Config = require('./config');
var Routes = require('./routes');


// Declare internals

var internals = {};


// Create and configure server instance

exports.create = function () {

    // Create server

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

    var server = new Hapi.Server(Config.server.web.port, Config.server.web.host, config);

    server.auth('session', {
        scheme: 'cookie',
        defaultMode: 'try',
        password: Vault.session.password,
        validateFunc: Session.validate,
        isSecure: !!Config.server.web.tls,
        clearInvalid: true,
        redirectTo: Config.server.web.uri + '/login',
        appendNext: true,
        ttl: 365 * 24 * 60 * 60 * 1000                          // 1 Year
    });

    server.views({
        path: __dirname + '/views',
        engines: {
            jade: 'jade'
        },
        compileOptions: {
            colons: true,
            pretty: true
        }
    });

    // Load paths

    server.route(Routes.endpoints);
    server.route({
        method: 'GET',
        path: '/{path*}',
        config: {
            handler: {
                directory: {
                    path: __dirname + '/static'
                }
            },
            auth: false
        }
    });

    // Plugins

    server.pack.allow({ ext: true }).require({
        yar: { name: 'yar', cookieOptions: { isSecure: !!Config.server.web.tls, password: Vault.yar.password } },
        crumb: null,
        good: { extendedLogs: true },
        scooter: null
    }, function (err) {

        Hapi.utils.assert(!err, 'Failed loading plugin: ' + err);
        server.ext('onPreResponse', internals.onPreResponse);

        // Start Server

        server.start();
    });

    server.on('internalError', function (request, err) {

        console.log(err);
    });
};


internals.onPreResponse = function (request, next) {

    // Leave API responses alone (unformatted)

    if (request.route.app.isAPI) {
        return next();
    }

    // Return error page

    var response = request.response();
    if (response.isBoom) {
        var error = response;
        var context = {
            profile: request.auth.credentials && request.auth.credentials.profile,
            error: error.message,
            code: error.response.code === 404 ? 404 : 500,
            message: (error.response.code === 404 ? 'the page you were looking for was not found' : 'something went wrong...'),
            env: {},
            server: Config.server,
            product: Config.product
        };

        return next(request.generateView('error', context));
    }

    // Set default view context

    if (response.variety === 'view') {

        // Setup view variables

        var context = response.view.context;
        context.env = context.env || {};
        context.server = Config.server;
        context.profile = request.auth.credentials && request.auth.credentials.profile;
        context.product = Config.product;
        context.auth = {
            facebook: !!Vault.facebook.clientId,
            twitter: !!Vault.twitter.clientId,
            yahoo: !!Vault.yahoo.clientId
        };
        context.isMobile = false;

        // Set mobile environment

        if (request.plugins.scooter.os.family === 'iOS' &&
            request.route.app.hasMobile) {

            context.layout = 'mobile';
            context.isMobile = true;
        }

        // Render view

        return next();
    }

    return next();
};


exports.create();



/*

internals.onRequest = function (request, next) {

    var req = request.raw.req;

    var isNotWithStupid = true;
    if (req.headers['user-agent']) {
        req.api.agent = UserAgent.parse(req.headers['user-agent']);

        if (req.url !== '/imwithstupid' &&
            req.cookies.imwithstupid === undefined) {

            // Check user-agent version

            if (req.api.agent &&
                req.api.agent.name &&
                req.api.agent.version) {

                // Normalize version

                var version = (req.api.agent.name === 'chrome' ? req.api.agent.version.replace(/\.\d+$/, '') : req.api.agent.version);

                if (version.split(/\./g).length - 1 < 2) {
                    version += '.0';
                }

                // Check version

                isNotWithStupid = ((req.api.agent.name === 'chrome' && Semver.satisfies(version, '>= 11.x.x')) ||
                                   (req.api.agent.name === 'safari' && Semver.satisfies(version, '>= 5.x.x')) ||
                                   (req.api.agent.name === 'firefox' && Semver.satisfies(version, '>= 4.x.x')));
            }
        }
    }

    if (!isNotWithStupid) {
        return next(new Response.View(self.server.views, 'stupid', context, options));
    }

    return next();
};
*/