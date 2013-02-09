// Load modules

var Hapi = require('hapi');
var Boom = require('boom');
var Semver = require('semver');
var Fs = require('fs');
var UserAgent = require('user-agent')
var Login = require('./login');
var Session = require('./session');
var Vault = require('./vault');
var Config = require('./config');
var Routes = require('./routes');


// Declare internals

var internals = {};


// Listen to uncaught exceptions

process.on('uncaughtException', function (err) {

    Hapi.utils.abort('Uncaught exception: ' + err.stack);
});


// Create and configure server instance

exports.create = function () {

    // Create server

    var config = {
        views: {
            path: __dirname + '/views',
            engine: {
                module: 'jade',
                extension: 'jade'
            },
            compileOptions: {
                colons: true
            }
        },
        auth: {
            scheme: 'cookie',
            cookie: 'session',
            password: Vault.session.password,
            validateFunc: Session.validate,
            allowInsecure: Config.host.web.scheme !== 'https',
            clearInvalid: true,
            redirectTo: Config.host.uri('web') + '/login',
            appendNext: true,
            ttl: 365 * 24 * 60 * 60 * 1000                          // 1 Year
        },
        router: {
            routeDefaults: {
                auth: {
                    mode: 'none'
                }
            }
        }
    };

    if (Config.process.web.tls) {
        config.tls = {
            key: Fs.readFileSync(Config.process.web.tls.key),
            cert: Fs.readFileSync(Config.process.web.tls.cert)
        };
    }

    var server = new Hapi.Server(Config.host.web.port, Config.host.web.domain, config);

    // Load paths

    server.route(Routes.endpoints);
    server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './static' } } });

    // Plugins

    server.plugin().require('hapi-jar', { permissions: { ext: true }, plugin: { options: { password: Vault.password.jar }, isSingleUse: true } }, function (err) {

        server.plugin().require('crumb', { permissions: { ext: true } }, function (err) {

            server.plugin().require('scooter', { permissions: { ext: true } }, function (err) {

                server.ext('onPostHandler', internals.onPostHandler);

                // Start Server

                server.start();
            });
        });
    });
};


internals.onPostHandler = function (request, next) {

    // Leave API responses alone (unformatted)

    if (request.route.app.isAPI) {
        return next();
    }

    // Return not found page

    if (request.route.method === 'notfound') {
        internals.errorPage(Hapi.error.notFound().code, req, res, 'No such path or method');
    }

    // Return error page

    if (request.response instanceof Boom) {
        var error = request.response;
        var context = {
            profile: request.session.profile,
            error: error.message,
            code: error.response.code === 404 ? 404 : 500,
            message: (error.response.code === 404 ? 'the page you were looking for was not found' : 'something went wrong...'),
            env: {},
            host: Config.host,
            product: Config.product
        };

        request.response = new Hapi.response.View(request.server.views, 'error', context);
        return next();
    }

    // Set default view context

    if (request.response.variety === 'view') {

        // Setup view variables

        var context = request.response.view.context;
        context.env = context.env || {};
        context.host = Config.host;
        context.profile = request.session.profile;
        context.product = Config.product;
        context.auth = {
            facebook: !!Vault.facebook.clientId,
            twitter: !!Vault.twitter.clientId,
            yahoo: !!Vault.yahoo.clientId
        };
        context.isMobile = false;

        // Set mobile environment

        if (request.plugin.scooter.os.family === 'iOS' &&
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
