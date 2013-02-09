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

exports.login = function (request) {

    if (!request.session.profile) {
        return request.reply.view('login', { logo: false, env: { next: (request.query.next ? encodeURIComponent(request.query.next) : '') } });
    }

    if (request.session.restriction === 'tos' ||
        !request.session.ext.tos ||
        request.session.ext.tos < Tos.minimumTOS) {

        return request.reply.redirect('/tos' + (request.query.next && request.query.next.charAt(0) === '/' ? '?next=' + encodeURIComponent(request.query.next) : '')).send();
    }

    return request.reply.redirect(request.query.next || request.session.profile.view).send();
};


// Logout

exports.logout = function (request) {

    request.clearSession();
    return request.reply.redirect('/').send();
};


// Third party authentication (OAuth 1.0/2.0 callback URI)

exports.auth = function (request) {

    var entry = function () {

        // Preserve parameters for OAuth authorization callback

        if (request.query.x_next &&
            request.query.x_next.charAt(0) === '/') {        // Prevent being used an open redirector

            request.api.jar.auth = { next: request.query.x_next };
        }

        if (['twitter', 'facebook', 'yahoo'].indexOf(request.params.network) === -1) {
            return request.reply(Hapi.error.internal('Unknown third party network authentication', request.params.network));
        }

        switch (request.params.network) {

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

                request.api.jar.twitter = { token: token, secret: secret };
                return request.reply.redirect('https://api.twitter.com/oauth/authenticate?oauth_token=' + token).send();
            });
        }

        // Authorization callback

        if (!request.query.oauth_verifier) {
            return request.reply(Hapi.error.internal('Missing verifier parameter in Twitter authorization response'));
        }

        if (!request.state.jar.twitter) {
            return request.reply(Hapi.error.internal('Missing Twitter request token cookie'));
        }

        var credentials = request.state.jar.twitter;
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

            if (request.session.profile) {
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
                    display: request.plugins.scooter.os.family === 'iOS' ? 'touch' : 'page'
                }
            };

            request.api.jar.facebook = { state: request.query.state };
            return request.reply.redirect(Url.format(request)).send();
        }


        // Authorization callback

        if (!request.state.jar.facebook ||
            !request.state.jar.facebook.state) {

            return request.reply(Hapi.error.internal('Missing Facebook state cookie'));
        }

        if (request.state.jar.facebook.state !== request.query.state) {
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

                request.api.jar.yahoo = { token: token, secret: secret };
                return request.reply.redirect('https://api.login.yahoo.com/oauth/v2/request_auth?oauth_token=' + token).send();
            });
        }

        // Authorization callback

        if (!request.query.oauth_verifier) {
            return request.reply(Hapi.error.internal('Missing verifier parameter in Yahoo authorization response'));
        }

        if (!request.state.jar.yahoo) {
            return request.reply(Hapi.error.internal('Missing Yahoo request token cookie'));
        }

        credentials = request.state.jar.yahoo;

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

            if (request.session.profile) {
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

        if (request.session.profile) {

            // Link

            Api.clientCall('POST', '/user/' + request.session.profile.id + '/link/' + account.network, { id: account.id }, function (err, code, payload) {

                return request.reply.redirect('/account/linked').send();
            });
        }
        else {

            // Login

            var destination = request.state.jar.auth ? request.state.jar.auth.next : null;
            exports.loginCall(account.network, account.id, res, next, destination, account);
        }
    };

    entry();
};


// Unlink account

exports.unlink = function (request) {

    if (['twitter', 'facebook', 'yahoo'].indexOf(request.payload.network) === -1) {
        return request.reply.redirect('/account/linked').send();
    }

    Api.clientCall('DELETE', '/user/' + request.session.profile.id + '/link/' + request.payload.network, '', function (err, code, payload) {

        return request.reply.redirect('/account/linked').send();
    });
};


// Email token login

exports.emailToken = function (request) {

    exports.loginCall('email', request.params.token, res, next, null, null);
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
                request.api.jar.message = payload.message;
                return request.reply.redirect('/').send();
            }

            // Sign-up

            if (account) {
                request.api.jar.signup = account;
                return request.reply.redirect('/signup/register').send();
            }

            // Failed to login or register

            return request.reply.redirect('/').send();
        }

        // Registered user

        Api.clientCall('POST', '/oz/rsvp', { rsvp: payload.rsvp }, function (err, code, ticket) {

            if (err) {
                return request.reply(Hapi.error.internal('Unexpected API response', err));
            }

            if (code !== 200) {

                // Failed to login or register

                return request.reply.redirect('/').send();
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
                            request.api.jar.message = 'You made it in! Now link your account to Facebook, Twitter, or Yahoo! to make sign-in easier next time.';
                            destination = '/account/linked';
                            break;
                        case 'verify':
                            request.api.jar.message = 'Email address verified';
                            destination = '/account/emails';
                            break;
                    }
                }

                if (restriction === 'tos' &&
                    (!destination || destination.indexOf('/account') !== 0)) {

                    return request.reply.redirect('/tos' + (destination ? '?next=' + encodeURIComponent(destination) : '')).send();
                }

                return request.reply.redirect(destination || '/').send();
            });
        });
    });
};


