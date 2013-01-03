/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Url = require('url');
var Os = require('os');
var OAuth = require('oauth');
var Https = require('https');
var QueryString = require('querystring');
var Utils = require('./utils');
var Api = require('./api');
var Err = require('./error');
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

    if (req.api.profile) {

        if (req.api.session.restriction === 'tos' ||
            !req.api.session.ext.tos ||
            req.api.session.ext.tos < Tos.minimumTOS) {

            res.api.redirect = '/tos' + (req.query.next && req.query.next.charAt(0) === '/' ? '?next=' + encodeURIComponent(req.query.next) : '');
            next();
        }
        else {

            res.api.redirect = req.query.next || req.api.profile.view;
            next();
        }
    }
    else {

        res.api.view = { template: 'login', hasMobile: true, locals: { logo: false, env: { next: (req.query.next ? encodeURIComponent(req.query.next) : '')}} };
        next();
    }
};


// Logout

exports.logout = function (req, res, next) {

    Session.logout(res, next);
};


// Third party authentication (OAuth 1.0/2.0 callback URI)

exports.auth = function (req, res, next) {

    function entry() {

        // Preserve parameters for OAuth authorization callback

        if (req.query.x_next &&
            req.query.x_next.charAt(0) === '/') {        // Prevent being used an open redirector

            res.api.jar.auth = { next: req.query.x_next };
        }

        switch (req.params.network) {

            case 'twitter': twitter(); break;
            case 'facebook': facebook(); break;
            case 'yahoo': yahoo(); break;

            default:

                res.api.error = Err.internal('Unknown third party network authentication', req.params.network);
                next();
                break;
        }
    }

    function twitter() {

        if (req.query.oauth_token === undefined) {

            // Sign-in Initialization

            twitterClient.getOAuthRequestToken(function (err, token, secret, authorizeUri, params) {

                if (err === null) {

                    res.api.jar.twitter = { token: token, secret: secret };
                    res.api.redirect = 'https://api.twitter.com/oauth/authenticate?oauth_token=' + token;
                    res.api.result = 'You are being redirected to Twitter to sign-in...';
                    next();
                }
                else {

                    res.api.error = Err.internal('Failed to obtain a Twitter request token', err);
                    next();
                }
            });
        }
        else {

            // Authorization callback

            if (req.query.oauth_verifier) {

                if (req.api.jar.twitter) {

                    var credentials = req.api.jar.twitter;
                    if (req.query.oauth_token === credentials.token) {

                        twitterClient.getOAuthAccessToken(credentials.token, credentials.secret, req.query.oauth_verifier, function (err, token, secret, params) {

                            if (err === null) {

                                if (params.user_id) {

                                    var account = {

                                        network: 'twitter',
                                        id: params.user_id,
                                        username: params.screen_name || ''
                                    };

                                    if (req.api.profile) {

                                        finalizedLogin(account);
                                    }
                                    else {

                                        twitterClient.getProtectedResource('http://api.twitter.com/1/account/verify_credentials.json', 'GET', token, secret, function (err, response) {

                                            if (err === null) {

                                                var data = null;
                                                try {

                                                    data = JSON.parse(response);
                                                }
                                                catch (e) {
                                                }

                                                if (data &&
                                                    data.name) {

                                                    account.name = data.name;
                                                }

                                                finalizedLogin(account);
                                            }
                                        });
                                    }
                                }
                                else {

                                    res.api.error = Err.internal('Invalid Twitter access token response', err);
                                    next();
                                }
                            }
                            else {

                                res.api.error = Err.internal('Failed to obtain a Twitter access token', err);
                                next();
                            }
                        });
                    }
                    else {

                        res.api.error = Err.internal('Twitter authorized request token mismatch');
                        next();
                    }
                }
                else {

                    res.api.error = Err.internal('Missing Twitter request token cookie');
                    next();
                }
            }
            else {

                res.api.error = Err.internal('Missing verifier parameter in Twitter authorization response');
                next();
            }
        }
    }

    function facebook() {

        if (req.query.code === undefined) {

            // Sign-in Initialization

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
            next();
        }
        else {

            // Authorization callback

            if (req.api.jar.facebook &&
                req.api.jar.facebook.state) {

                if (req.api.jar.facebook.state === req.query.state) {

                    var query = {

                        client_id: Vault.facebook.clientId,
                        client_secret: Vault.facebook.clientSecret,
                        grant_type: 'authorization_code',
                        code: req.query.code,
                        redirect_uri: Config.host.uri('web') + '/auth/facebook'
                    };

                    var body = QueryString.stringify(query);

                    facebookRequest('POST', '/oauth/access_token', body, function (data, err) {

                        if (data) {

                            facebookRequest('GET', '/me?' + QueryString.stringify({ oauth_token: data.access_token }), null, function (data, err) {

                                if (err === null) {

                                    if (data &&
                                data.id) {

                                        var account = {

                                            network: 'facebook',
                                            id: data.id,
                                            name: data.name || '',
                                            username: data.username || '',
                                            email: (data.email && data.email.match(/proxymail\.facebook\.com$/) === null ? data.email : '')
                                        };

                                        finalizedLogin(account);
                                    }
                                    else {

                                        res.api.error = Err.internal('Invalid Facebook profile response', err);
                                        next();
                                    }
                                }
                                else {

                                    res.api.error = err;
                                    next();
                                }
                            });
                        }
                        else {

                            res.api.error = err;
                            next();
                        }
                    });
                }
                else {

                    res.api.error = Err.internal('Facebook incorrect state parameter');
                    next();
                }
            }
            else {

                res.api.error = Err.internal('Missing Facebook state cookie');
                next();
            }
        }
    }

    function facebookRequest(method, path, body, callback) {

        var options = {
            host: 'graph.facebook.com',
            port: 443,
            path: path,
            method: method
        };

        var hreq = Https.request(options, function (hres) {

            if (hres) {

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

                    if (error === null) {

                        if (hres.statusCode === 200) {

                            callback(data, null);
                        }
                        else {

                            callback(null, Err.internal('Facebook returned OAuth error on token request', data));
                        }
                    }
                    else {

                        callback(null, Err.internal(error));
                    }
                });
            }
            else {

                callback(null, Err.internal('Failed sending Facebook token request'));
            }
        });

        hreq.on('error', function (err) {

            callback(null, Err.internal('HTTP socket error', err));
        });

        if (body !== null) {

            hreq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
            hreq.write(body);
        }

        hreq.end();
    }

    function yahoo() {

        if (req.query.oauth_token === undefined) {

            // Sign-in Initialization

            yahooClient.getOAuthRequestToken(function (err, token, secret, authorizeUri, params) {

                if (err === null) {

                    res.api.jar.yahoo = { token: token, secret: secret };
                    res.api.redirect = 'https://api.login.yahoo.com/oauth/v2/request_auth?oauth_token=' + token;
                    res.api.result = 'You are being redirected to Yahoo! to sign-in...';
                    next();
                }
                else {

                    res.api.error = Err.internal('Failed to obtain a Yahoo! request token', err);
                    next();
                }
            });
        }
        else {

            // Authorization callback

            if (req.query.oauth_verifier) {

                if (req.api.jar.yahoo) {

                    credentials = req.api.jar.yahoo;

                    if (req.query.oauth_token === credentials.token) {

                        yahooClient.getOAuthAccessToken(credentials.token, credentials.secret, req.query.oauth_verifier, function (err, token, secret, params) {

                            if (err === null) {

                                if (params &&
                                    params.xoauth_yahoo_guid) {

                                    var account = {

                                        network: 'yahoo',
                                        id: params.xoauth_yahoo_guid
                                    };

                                    if (req.api.profile) {

                                        finalizedLogin(account);
                                    }
                                    else {

                                        yahooClient.getProtectedResource('http://social.yahooapis.com/v1/user/' + params.xoauth_yahoo_guid + '/profile?format=json', 'GET', token, secret, function (err, response) {

                                            if (err === null) {

                                                var data = null;
                                                try {

                                                    data = JSON.parse(response);
                                                }
                                                catch (e) {
                                                }

                                                if (data && data.profile && data.profile.nickname) {

                                                    account.name = data.profile.nickname;
                                                }

                                                finalizedLogin(account);
                                            }
                                        });
                                    }
                                }
                                else {

                                    res.api.error = Err.internal('Invalid Yahoo access token response', params);
                                    next();
                                }
                            }
                            else {

                                res.api.error = Err.internal('Failed to obtain a Yahoo access token', err);
                                next();
                            }
                        });
                    }
                    else {

                        res.api.error = Err.internal('Yahoo authorized request token mismatch');
                        next();
                    }
                }
                else {

                    res.api.error = Err.internal('Missing Yahoo request token cookie');
                    next();
                }
            }
            else {

                res.api.error = Err.internal('Missing verifier parameter in Yahoo authorization response');
                next();
            }
        }
    }

    function finalizedLogin(account) {

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
    }

    entry();
};


// Unlink account

exports.unlink = function (req, res, next) {

    if (req.body.network === 'twitter' ||
        req.body.network === 'facebook' ||
        req.body.network === 'yahoo') {

        Api.clientCall('DELETE', '/user/' + req.api.profile.id + '/link/' + req.body.network, '', function (err, code, payload) {

            res.api.redirect = '/account/linked';
            next();
        });
    }
    else {
        res.api.redirect = '/account/linked';
        next();
    }
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
            res.api.error = Err.internal('Unexpected API response', err);
            return next();
        }

        if (code !== 200) {
            Session.clear(res);

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
                res.api.error = Err.internal('Unexpected API response', err);
                return next();
            }

            if (code !== 200) {

                // Failed to login or register

                res.api.redirect = '/';
                return next();
            }

            Session.set(res, ticket, function (isValid, restriction) {

                if (!isValid) {
                    res.api.error = Err.internal('Invalid response parameters from API server');
                    return next();
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
                    (destination === null || destination.indexOf('/account') !== 0)) {

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


