// Load modules

var Url = require('url');
var OAuth = require('oauth');
var Https = require('https');
var QueryString = require('querystring');
var Hapi = require('hapi');
var Cryptiles = require('cryptiles');
var Api = require('./api');
var Session = require('./session');
var Vault = require('./vault');
var Tos = require('./tos');
var Config = require('./config');


// Declare internals

var internals = {};


// OAuth 1.0 clients

internals.twitterClient = new OAuth.OAuth('https://api.twitter.com/oauth/request_token',
                                          'https://api.twitter.com/oauth/access_token',
                                           Vault.twitter.clientId,
                                           Vault.twitter.clientSecret,
                                           '1.0',
                                           Config.server.web.uri + '/auth/twitter',
                                           'HMAC-SHA1');

internals.yahooClient = new OAuth.OAuth('https://oauth03.member.mud.yahoo.com/oauth/v2/get_request_token',
                                        'https://oauth03.member.mud.yahoo.com/oauth/v2/get_token',
                                        Vault.yahoo.clientId,
                                        Vault.yahoo.clientSecret,
                                        '1.0',
                                        Config.server.web.uri + '/auth/yahoo',
                                        'HMAC-SHA1');


// Login page

exports.login = function (request) {

    if (!request.auth.credentials ||
        !request.auth.credentials.profile) {

        return request.reply.view('login', { logo: false, env: { next: (request.query.next ? encodeURIComponent(request.query.next) : '') } });
    }

    if (request.auth.credentials.restriction === 'tos' ||
        !request.auth.credentials.ext.tos ||
        request.auth.credentials.ext.tos < Tos.minimumTOS) {

        return request.reply.redirect('/tos' + (request.query.next && request.query.next.charAt(0) === '/' ? '?next=' + encodeURIComponent(request.query.next) : ''));
    }

    return request.reply.redirect(request.query.next || request.auth.credentials.profile.view);
};


// Logout

exports.logout = function (request) {

    request.auth.session.clear();
    return request.reply.redirect('/');
};


// Third party authentication (OAuth 1.0/2.0 callback URI)

exports.auth = function (request) {

    var entry = function () {

        // Preserve parameters for OAuth authorization callback

        if (request.query.x_next &&
            request.query.x_next.charAt(0) === '/') {        // Prevent being used an open redirector

            request.session.set('auth', { next: request.query.x_next });
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
            return internals.twitterClient.getOAuthRequestToken(function (err, token, secret, authorizeUri, params) {

                if (err) {
                    return request.reply(Hapi.error.internal('Failed to obtain a Twitter request token', err));
                }

                request.session.set('twitter', { token: token, secret: secret });
                return request.reply.redirect('https://api.twitter.com/oauth/authenticate?oauth_token=' + token);
            });
        }

        // Authorization callback

        if (!request.query.oauth_verifier) {
            return request.reply(Hapi.error.internal('Missing verifier parameter in Twitter authorization response'));
        }

        var credentials = request.session.get('twitter', true);
        if (!credentials) {
            return request.reply(Hapi.error.internal('Missing Twitter request token cookie'));
        }

        if (request.query.oauth_token !== credentials.token) {
            return request.reply(Hapi.error.internal('Twitter authorized request token mismatch'));
        }

        internals.twitterClient.getOAuthAccessToken(credentials.token, credentials.secret, request.query.oauth_verifier, function (err, token, secret, params) {

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

            if (request.auth.credentials &&
                request.auth.credentials.profile) {

                return finalizedLogin(account);
            }

            internals.twitterClient.getProtectedResource('http://api.twitter.com/1/account/verify_credentials.json', 'GET', token, secret, function (err, response) {

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
                    redirect_uri: Config.server.web.uri + '/auth/facebook',
                    state: Cryptiles.randomString(22),
                    display: request.plugins.scooter.os.family === 'iOS' ? 'touch' : 'page'
                }
            };

            request.session.set('facebook', { state: request.query.state });
            return request.reply.redirect(Url.format(request));
        }


        // Authorization callback

        var facebookSession = request.session.get('facebook', true);
        if (!facebookSession ||
            !facebookSession.state) {

            return request.reply(Hapi.error.internal('Missing Facebook state cookie'));
        }

        if (facebookSession.state !== request.query.state) {
            return request.reply(Hapi.error.internal('Facebook incorrect state parameter'));
        }

        var query = {
            client_id: Vault.facebook.clientId,
            client_secret: Vault.facebook.clientSecret,
            grant_type: 'authorization_code',
            code: request.query.code,
            redirect_uri: Config.server.web.uri + '/auth/facebook'
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
            internals.yahooClient.getOAuthRequestToken(function (err, token, secret, authorizeUri, params) {

                if (err) {
                    return request.reply(Hapi.error.internal('Failed to obtain a Yahoo! request token', err));
                }

                request.session.set('yahoo', { token: token, secret: secret });
                return request.reply.redirect('https://api.login.yahoo.com/oauth/v2/request_auth?oauth_token=' + token);
            });
        }

        // Authorization callback

        if (!request.query.oauth_verifier) {
            return request.reply(Hapi.error.internal('Missing verifier parameter in Yahoo authorization response'));
        }

        credentials = request.session.get('yahoo', true);
        if (!credentials) {
            return request.reply(Hapi.error.internal('Missing Yahoo request token cookie'));
        }

        if (request.query.oauth_token !== credentials.token) {
            return request.reply(Hapi.error.internal('Yahoo authorized request token mismatch'));
        }

        internals.yahooClient.getOAuthAccessToken(credentials.token, credentials.secret, request.query.oauth_verifier, function (err, token, secret, params) {

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

            if (request.auth.credentials &&
                request.auth.credentials.profile) {

                return finalizedLogin(account);
            }

            internals.yahooClient.getProtectedResource('http://social.yahooapis.com/v1/user/' + params.xoauth_yahoo_guid + '/profile?format=json', 'GET', token, secret, function (err, response) {

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

        if (request.auth.isAuthenticated &&
            request.auth.credentials &&
            request.auth.credentials.profile) {

            // Link

            Api.clientCall('POST', '/user/' + request.auth.credentials.profile.id + '/link/' + account.network, { id: account.id }, function (err, code, payload) {

                return request.reply.redirect('/account/linked');
            });
        }
        else {

            // Login

            var authSession = request.session.get('auth', true);
            var destination = (authSession && authSession.next);
            exports.loginCall(account.network, account.id, request, destination, account);
        }
    };

    entry();
};


// Unlink account

exports.unlink = function (request) {

    if (['twitter', 'facebook', 'yahoo'].indexOf(request.payload.network) === -1) {
        return request.reply.redirect('/account/linked');
    }

    Api.clientCall('DELETE', '/user/' + request.auth.credentials.profile.id + '/link/' + request.payload.network, '', function (err, code, payload) {

        return request.reply.redirect('/account/linked');
    });
};


// Email token login

exports.emailToken = function (request) {

    exports.loginCall('email', request.params.token, request, null, null);
};


// Login common function

exports.loginCall = function (type, id, request, destination, account) {

    var payload = {
        type: type,
        id: id
    };

    Api.clientCall('POST', '/oz/login', payload, function (err, code, payload) {

        if (err) {
            return request.reply(Hapi.error.internal('Unexpected API response', err));
        }

        if (code !== 200) {
            request.auth.session.clear();

            // Bad email invite

            if (type === 'email') {
                request.session.set('message', payload.message);
                return request.reply.redirect('/');
            }

            // Sign-up

            if (account) {
                request.session.set('signup', account);
                return request.reply.redirect('/signup/register');
            }

            // Failed to login or register

            return request.reply.redirect('/');
        }

        // Registered user

        Api.clientCall('POST', '/oz/rsvp', { rsvp: payload.rsvp }, function (err, code, ticket) {

            if (err) {
                return request.reply(Hapi.error.internal('Unexpected API response', err));
            }

            if (code !== 200) {

                // Failed to login or register

                return request.reply.redirect('/');
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
                            request.session.set('message', 'You made it in! Now link your account to Facebook, Twitter, or Yahoo! to make sign-in easier next time.');
                            destination = '/account/linked';
                            break;
                        case 'verify':
                            request.session.set('message', 'Email address verified');
                            destination = '/account/emails';
                            break;
                    }
                }

                if (restriction === 'tos' &&
                    (!destination || destination.indexOf('/account') !== 0)) {

                    return request.reply.redirect('/tos' + (destination ? '?next=' + encodeURIComponent(destination) : ''));
                }

                return request.reply.redirect(destination || '/');
            });
        });
    });
};


