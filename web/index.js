// Load modules

var Hapi = require('hapi');
var Express = require('express');
var Semver = require('semver');
var Os = require('os');
var Fs = require('fs');
var Crypto = require('crypto');
var UserAgent = require('user-agent')
var Utils = require('./utils');
var Login = require('./login');
var Log = require('./log');
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
            password: Vault.session,
            validateFunc: Session.validate,
            allowInsecure: Config.host.web.scheme !== 'https',
            clearInvalid: true,
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

    server.use(internals.notFound);
    server.use(internals.errorHandler);

    server.ext('onRequest', internals.onRequest);

    // Load paths

    server.route(Routes.endpoints);
    server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './static' } } });

    // Start Server

    server.start();
};


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

    if (isNotWithStupid) {
        return next();
    }

    return next(new Response.View(self.server.views, 'stupid', context, options));
};


// Route pre-processor

internals.preprocessRequest = function (req, res, next) {

    req.api = {};
    req.api.jar = {};
    res.api = {};
    res.api.jar = {};

    // Load cookie jar

    if (req.cookies.jar) {
        req.api.jar = Utils.decrypt(Vault.jar.aes256Key, req.cookies.jar) || {};
        delete req.cookies.jar;
        res.api.clearJar = true;
    }

    // Load session information

    Session.load(req, res, function (session, profile) {

        req.api.session = session;
        req.api.profile = profile;

        // Set default view

        if (req.api.profile) {
            req.api.profile.view = req.api.profile.view || '/view/';
        }

        next();
    });
};


// Session authentication

internals.authenticate = function (req, res, next) {

    if (req.api.profile &&
        req.api.session) {

        // Check crumb for any non GET action

        if (req.method === 'GET') {
            next();
        }
        else if (req.body &&
                 req.body.crumb &&
                 req.body.crumb === Crypto.createHash('sha1').update(req.api.session.id).digest('base64')) {

            // Clean up if present

            delete req.body.crumb;
            next();
        }
        else {

            // Invalid crumb

            return request.reply(Hapi.error.badRequest('Invalid crumb'));
            internals.finalizeResponse(req, res, next);
        }
    }
    else {

        // Missing session cookie

        res.api.redirect = '/login?next=' + encodeURIComponent(req.url);
        res.api.result = 'This page requires sign-in. You are being redirected...';
        internals.finalizeResponse(req, res);
    }
};


// Set default response headers and send response

internals.finalizeResponse = function (req, res) {

    res.api.isReplied = false;
    res.setHeader('Cache-Control', 'none');

    // Cookies

    if (res.api.cookie ||
        res.api.jar) {

        var cookies = [];

        if (res.api.cookie) {
            for (var i in res.api.cookie.values) {
                if (res.api.cookie.values.hasOwnProperty(i)) {
                    var cookie = res.api.cookie.values[i];
                    if (res.api.cookie.attributes) {
                        for (var a in res.api.cookie.attributes) {
                            if (res.api.cookie.attributes.hasOwnProperty(a)) {
                                cookie += '; ' + res.api.cookie.attributes[a];
                            }
                        }
                    }

                    cookies.push(cookie);
                }
            }
        }

        if (Object.keys(res.api.jar).length > 0) {

            // Encrypt and Cookiefy

            cookies.push('jar=' + Utils.encrypt(Vault.jar.aes256Key, res.api.jar) + '; Path=/' + (Config.host.web.scheme === 'https' ? '; Secure' : ''));
        }
        else if (res.api.clearJar) {
            cookies.push('jar=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        }

        res.setHeader('Set-Cookie', cookies);
    }

    // Response

    if (res.api.view) {

        // Setup view variables

        var locals = res.api.view.locals || {};
        locals.env = locals.env || {};
        locals.host = Config.host;
        locals.profile = req.api.profile;
        locals.auth = { facebook: Vault.facebook.clientId ? true : false, twitter: Vault.twitter.clientId ? true : false, yahoo: Vault.yahoo.clientId ? true : false };
        locals.product = Config.product;

        // Add crumb

        if (req.api.session) {
            locals.crumb = Crypto.createHash('sha1').update(req.api.session.id).digest('base64');
        }

        // Set mobile environment

        if (req.api.agent.os === 'iPhone' &&
            res.api.view.hasMobile) {

            locals.layout = 'mobile';
            locals.isMobile = true;
        }
        else {
            locals.isMobile = false;
        }

        // Render view

        res.render(res.api.view.template, locals);
        Hapi.log.info('Replied', req);
    }
    else if (res.api.result ||
             res.api.redirect) {

        if (res.api.redirect) {
            var location = ((res.api.redirect.indexOf('http') !== 0 && res.api.redirect.indexOf('postmile://') !== 0) ? Config.host.uri('web') + res.api.redirect : res.api.redirect);
            res.send(res.api.result || 'You are being redirected...', { 'Location': location }, (req.method === 'GET' || location.indexOf('http') !== 0 ? 307 : 303));
        }
        else {
            res.send(res.api.result);
        }

        res.api.isReplied = true;
        Hapi.log.info('Replied', req);
    }
    else if (res.api.error) {
        internals.errorPage(res.api.error.code, req, res, res.api.error.text + (res.api.error.message ? ': ' + res.api.error.message : ''), res.api.isAPI);
        Hapi.log.err(res.api.error, req);
    }
};


internals.notFound = function (req, res, next) {

    if (res.api === undefined ||
        res.api.isReplied !== true) {

        internals.preprocessRequest(req, res, function () {

            internals.errorPage(Hapi.error.notFound().code, req, res, 'No such path or method');
            Hapi.log.info('Not found', req);
        });
    }
};


internals.errorHandler = function (err, req, res, next) {

    internals.errorPage((err && err.code === 'ENOTDIR') ? Hapi.error.notFound().code : Hapi.error.internal().code, req, res, 'Exception');
    Hapi.log.err(err, req);
};


// Get home page

internals.errorPage = function (code, req, res, message, isAPI) {

    if (res.api) {
        res.api.isReplied = true;
    }

    if (isAPI !== true) {
        var locals = {
            profile: (req && req.api && req.api.profile ? req.api.profile : null),
            error: message,
            code: code === 404 ? 404 : 500,
            message: (code === 404 ? 'the page you were looking for was not found' : 'something went wrong...'),
            env: {},
            host: Config.host,
            product: Config.product
        };

        res.render('error', locals);
    }
    else {
        res.send({ error: message }, code);
    }
};


exports.create();
