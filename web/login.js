// Load modules

var Url = require('url');
var Os = require('os');
var OAuth = require('oauth');
var Https = require('https');
var QueryString = require('querystring');
var Hapi = require('hapi');
var Utils = require('./utils');
var Api = require('./api');
var Session = require('./session');
var Vault = require('./vault');
var Tos = require('./tos');
var Config = require('./config');


// OAuth 1.0 clients

var twitterClient = new OAuth.OAuth('https://api.twitter.com/oauth/request_token',
                                    'https://api.twitter.com/oauth/access_token',
                                     Vault.twitter.clientId,
                                     Vault.twitter.clientSecret,
                                     '1.0',
                                     Config.host.uri('web') + '/auth/twitter',
                                     'HMAC-SHA1');

var yahooClient = new OAuth.OAuth('https://oauth03.member.mud.yahoo.com/oauth/v2/get_request_token',
                                  'https://oauth03.member.mud.yahoo.com/oauth/v2/get_token',
                                  Vault.yahoo.clientId,
                                  Vault.yahoo.clientSecret,
                                  '1.0',
                                  Config.host.uri('web') + '/auth/yahoo',
                                  'HMAC-SHA1');


// Login page

exports.login = function (req, res, next) {

    if (!req.api.profile) {
        res.api.view = { template: 'login', hasMobile: true, locals: { logo: false, env: { next: (request.query.next ? encodeURIComponent(request.query.next) : '') } } };
        return next();
    }

    if (req.api.session.restriction === 'tos' ||
        !req.api.session.ext.tos ||
        req.api.session.ext.tos < Tos.minimumTOS) {

        res.api.redirect = '/tos' + (request.query.next && request.query.next.charAt(0) === '/' ? '?next=' + encodeURIComponent(request.query.next) : '');
        return next();
    }

    res.api.redirect = request.query.next || req.api.profile.view;
    return next();
};


// Logout

exports.logout = function (req, res, next) {

    request.clearSession();
    res.api.redirect = '/';
    res.api.result = 'You are being redirected...';
    next();
};


// Third party authentication (OAuth 1.0/2.0 callback URI)

exports.auth = function (req, res, next) {

    var entry = function () {

        // Preserve parameters for OAuth authorization callback

        if (request.query.x_next &&
            request.query.x_next.charAt(0) === '/') {        // Prevent being used an open redirector

            res.api.jar.auth = { next: request.query.x_next };
        }

        if (['twitter', 'facebook', 'yahoo'].indexOf(req.params.network) === -1) {
            return request.reply(Hapi.error.internal('Unknown third party network authentication', req.params.network));
        }

        switch (req.params.network) {

            case 'twitter': twitter(); break;
            case 'facebook': facebook(); break;
            case 'yahoo': yahoo(); break;
        }
    };

    var twitter = function () {

        // Sign-in Initialization

        if (!request.query.oauth_token) {
            return twitterClient.getOAuthRequestToken(function (err, token, secret, authorizeUri, params) {

                if (err) {
                    return request.reply(Hapi.error.internal('Failed to obtain a Twitter request token', err));
                }

                res.api.jar.twitter = { token: token, secret: secret };
                res.api.redirect = 'https://api.twitter.com/oauth/authenticate?oauth_token=' + token;
                res.api.result = 'You are being redirected to Twitter to sign-in...';
                return next();
            });
        }

        // Authorization callback

        if (!request.query.oauth_verifier) {
            return request.reply(Hapi.error.internal('Missing verifier parameter in Twitter authorization response'));
        }

        if (!req.api.jar.twitter) {
            return request.reply(Hapi.error.internal('Missing Twitter request token cookie'));
        }

        var credentials = req.api.jar.twitter;
        if (request.query.oauth_token !== credentials.token) {
            return request.reply(Hapi.error.internal('Twitter authorized request token mismatch'));
        }

        twitterClient.getOAuthAccessToken(credentials.token, credentials.secret, request.query.oauth_verifier, function (err, token, secret, params) {

            if (err) {
                return request.reply(Hapi.error.internal('Failed to obtain a Twitter access token', err));
            }

            if (!params.user_id) {
                return request.reply(Hapi.error.internal('Invalid Twitter access token response', err));
            }

            var account = {
                network: 'twitter',
                id: params.user_id,
                username: params.screen_name || ''
            };

            if (req.api.profile) {
                return finalizedLogin(account);
            }

            twitterClient.getProtectedResource('http://api.twitter.com/1/account/verify_credentials.json', 'GET', token, secret, function (err, response) {

                if (!err) {
                    var data = null;
                    try {
                        data = JSON.parse(response);
                    }
                    catch (e) { }

                    if (data &&
                        data.name) {

                        account.name = data.name;
                    }
                }

                return finalizedLogin(account);
            });
        });
    };

    var facebook = function () {

        // Sign-in Initialization

        if (!request.query.code) {
            var request = {
                protocol: 'https:',
                host: 'graph.facebook.com',
                pathname: '/oauth/authorize',
                query: {
                    client_id: Vault.facebook.clientId,
                    response_type: 'code',
                    scope: 'email',
                    redirect_uri: Config.host.uri('web') + '/auth/facebook',
                    state: Utils.getRandomString(22),
                    display: req.api.agent.os === 'iPhone' ? 'touch' : 'page'
                }
            };

            res.api.jar.facebook = { state: request.query.state };
            res.api.redirect = Url.format(request);
            res.api.result = 'You are being redirected to Facebook to sign-in...';
            return next();
        }


        // Authorization callback

        if (!req.api.jar.facebook ||
            !req.api.jar.facebook.state) {

            return request.reply(Hapi.error.internal('Missing Facebook state cookie'));
        }

        if (req.api.jar.facebook.state !== request.query.state) {
            return request.reply(Hapi.error.internal('Facebook incorrect state parameter'));
        }

        var query = {
            client_id: Vault.facebook.clientId,
            client_secret: Vault.facebook.clientSecret,
            grant_type: 'authorization_code',
            code: request.query.code,
            redirect_uri: Config.host.uri('web') + '/auth/facebook'
        };

        var body = QueryString.stringify(query);
        facebookRequest('POST', '/oauth/access_token', body, function (err, data) {

            if (!data) {
                return request.reply(err);
            }

            facebookRequest('GET', '/me?' + QueryString.stringify({ oauth_token: data.access_token }), null, function (err, data) {

                if (err) {
                    return request.reply(err);
                }

                if (!data ||
                    !data.id) {

                    return request.reply(Hapi.error.internal('Invalid Facebook profile response', err));
                }

                var account = {
                    network: 'facebook',
                    id: data.id,
                    name: data.name || '',
                    username: data.username || '',
                    email: (data.email && !data.email.match(/proxymail\.facebook\.com$/) ? data.email : '')
                };

                finalizedLogin(account);
            });
        });
    };

    var facebookRequest = function (method, path, body, callback) {

        var options = {
            host: 'graph.facebook.com',
            port: 443,
            path: path,
            method: method
        };

        var hreq = Https.request(options, function (hres) {

            if (!hres) {
                return callback(Hapi.error.internal('Failed sending Facebook token request'));
            }

            var response = '';

            hres.setEncoding('utf8');
            hres.on('data', function (chunk) {

                response += chunk;
            });

            hres.on('end', function () {

                var data = null;
                var error = null;

                try {
                    data = JSON.parse(response);
                }
                catch (err) {
                    data = QueryString.parse(response);     // Hack until Facebook fixes their OAuth implementation
                    // error = 'Invalid response body from Facebook token endpoint: ' + response + '(' + err + ')';
                }

                if (error) {
                    return callback(Hapi.error.internal(error));
                }

                if (hres.statusCode !== 200) {
                    return callback(Hapi.error.internal('Facebook returned OAuth error on token request', data));
                }

                return callback(null, data);
            });
        });

        hreq.on('error', function (err) {

            callback(Hapi.error.internal('HTTP socket error', err));
        });

        if (body !== null) {
            hreq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
            hreq.write(body);
        }

        hreq.end();
    };

    var yahoo = function () {

        // Sign-in Initialization

        if (!request.query.oauth_token) {
            yahooClient.getOAuthRequestToken(function (err, token, secret, authorizeUri, params) {

                if (err) {
                    return request.reply(Hapi.error.internal('Failed to obtain a Yahoo! request token', err));
                }

                res.api.jar.yahoo = { token: token, secret: secret };
                res.api.redirect = 'https://api.login.yahoo.com/oauth/v2/request_auth?oauth_token=' + token;
                res.api.result = 'You are being redirected to Yahoo! to sign-in...';
                return next();
            });
        }

        // Authorization callback

        if (!request.query.oauth_verifier) {
            return request.reply(Hapi.error.internal('Missing verifier parameter in Yahoo authorization response'));
        }

        if (!req.api.jar.yahoo) {
            return request.reply(Hapi.error.internal('Missing Yahoo request token cookie'));
        }

        credentials = req.api.jar.yahoo;

        if (request.query.oauth_token !== credentials.token) {
            return request.reply(Hapi.error.internal('Yahoo authorized request token mismatch'));
        }

        yahooClient.getOAuthAccessToken(credentials.token, credentials.secret, request.query.oauth_verifier, function (err, token, secret, params) {

            if (err) {
                return request.reply(Hapi.error.internal('Failed to obtain a Yahoo access token', err));
            }

            if (!params ||
                !params.xoauth_yahoo_guid) {

                return request.reply(Hapi.error.internal('Invalid Yahoo access token response', params));
            }

            var account = {
                network: 'yahoo',
                id: params.xoauth_yahoo_guid
            };

            if (req.api.profile) {
                return finalizedLogin(account);
            }

            yahooClient.getProtectedResource('http://social.yahooapis.com/v1/user/' + params.xoauth_yahoo_guid + '/profile?format=json', 'GET', token, secret, function (err, response) {

                if (!err) {
                    var data = null;
                    try {
                        data = JSON.parse(response);
                    }
                    catch (e) { }

                    if (data && data.profile && data.profile.nickname) {
                        account.name = data.profile.nickname;
                    }
                }

                return finalizedLogin(account);
            });
        });
    };

    var finalizedLogin = function (account) {

        if (req.api.profile) {

            // Link

            Api.clientCall('POST', '/user/' + req.api.profile.id + '/link/' + account.network, { id: account.id }, function (err, code, payload) {

                res.api.redirect = '/account/linked';
                next();
            });
        }
        else {

            // Login

            var destination = req.api.jar.auth ? req.api.jar.auth.next : null;
            exports.loginCall(account.network, account.id, res, next, destination, account);
        }
    };

    entry();
};


// Unlink account

exports.unlink = function (req, res, next) {

    if (['twitter', 'facebook', 'yahoo'].indexOf(req.body.network) === -1) {
        res.api.redirect = '/account/linked';
        return next();
    }

    Api.clientCall('DELETE', '/user/' + req.api.profile.id + '/link/' + req.body.network, '', function (err, code, payload) {

        res.api.redirect = '/account/linked';
        return next();
    });
};


// Email token login

exports.emailToken = function (req, res, next) {

    exports.loginCall('email', req.params.token, res, next, null, null);
};


// Login common function

exports.loginCall = function (type, id, res, next, destination, account) {

    var payload = {
        type: type,
        id: id
    };

    Api.clientCall('POST', '/oz/login', payload, function (err, code, payload) {

        if (err) {
            return request.reply(Hapi.error.internal('Unexpected API response', err));
        }

        if (code !== 200) {
            request.clearSession();

            // Bad email invite

            if (type === 'email') {
                res.api.jar.message = payload.message;
                res.api.redirect = '/';
                return next();
            }

            // Sign-up

            if (account) {
                res.api.jar.signup = account;
                res.api.redirect = '/signup/register';
                return next();
            }

            // Failed to login or register

            res.api.redirect = '/';
            return next();
        }

        // Registered user

        Api.clientCall('POST', '/oz/rsvp', { rsvp: payload.rsvp }, function (err, code, ticket) {

            if (err) {
                return request.reply(Hapi.error.internal('Unexpected API response', err));
            }

            if (code !== 200) {

                // Failed to login or register

                res.api.redirect = '/';
                return next();
            }

            Session.set(request, ticket, function (isValid, restriction) {

                if (!isValid) {
                    return request.reply(Hapi.error.internal('Invalid response parameters from API server'));
                }

                if (payload.ext &&
                    payload.ext.action &&
                    payload.ext.action.type) {

                    switch (payload.ext.action.type) {
                        case 'reminder':
                            res.api.jar.message = 'You made it in! Now link your account to Facebook, Twitter, or Yahoo! to make sign-in easier next time.';
                            destination = '/account/linked';
                            break;
                        case 'verify':
                            res.api.jar.message = 'Email address verified';
                            destination = '/account/emails';
                            break;
                    }
                }

                if (restriction === 'tos' &&
                    (!destination || destination.indexOf('/account') !== 0)) {

                    res.api.redirect = '/tos' + (destination ? '?next=' + encodeURIComponent(destination) : '');
                }
                else {
                    res.api.redirect = destination || '/';
                }

                return next();
            });
        });
    });
};


