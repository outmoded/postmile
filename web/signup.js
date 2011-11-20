/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Api = require('./api');
var Login = require('./login');
var Err = require('./error');
var Session = require('./session');


// Registration

exports.register = function (req, res, next) {

    if (req.method === 'GET') {

        if (req.api.jar.signup) {

            res.api.jar.signup = req.api.jar.signup;

            // Check if invitation required

            Api.call('GET', '/invite/public', '', function (data, err, code) {

                if (code === 200) {

                    res.api.jar.signup.invite = 'public';
                }
                else {

                    res.api.jar.signup.invite = (res.api.jar.signup.invite == 'public' ? '' : res.api.jar.signup.invite);
                }

                var locals = {

                    logo: false,
                    network: req.api.jar.signup.network,

                    env: {

                        invite: (res.api.jar.signup.invite || ''),
                        name: (res.api.jar.signup.name || ''),
                        email: (res.api.jar.signup.email || ''),
                        username: (res.api.jar.signup.username || ''),
                        message: (res.api.jar.message || '')
                    }
                };

                res.api.view = { template: 'register', locals: locals };
                next();
            });
        }
        else {

            res.api.redirect = '/';
            next();
        }
    }
    else {

        // POST

        var signup = req.api.jar.signup;
        if (signup &&
            signup.network &&
            signup.id) {

            var registration = { network: [signup.network, signup.id] };

            if (req.body.username) {

                registration.username = req.body.username;
            }

            if (req.body.email) {

                registration.email = req.body.email;
            }

            if (req.body.name) {

                registration.name = req.body.name;
            }

            Api.clientCall('PUT', '/user' + (req.body.invite ? '?invite=' + encodeURIComponent(req.body.invite) : ''), registration, function (result, err, code) {

                if (err === null) {

                    // Login new user

                    var tokenRequest = {

                        grant_type: 'http://ns.postmile.net/' + signup.network,
                        x_user_id: signup.id
                    };

                    Login.loginCall(tokenRequest, res, next, '/welcome');
                }
                else {

                    // Try again

                    res.api.jar.signup = req.api.jar.signup;
                    res.api.jar.signup.invite = req.body.invite;
                    res.api.jar.signup.name = req.body.name;
                    res.api.jar.signup.username = req.body.username;
                    res.api.jar.signup.email = req.body.email;
                    res.api.jar.message = (err.message ? err.message : 'Service unavailable');

                    res.api.redirect = '/signup/register';
                    next();
                }
            });
        }
        else {

            res.api.redirect = '/';
            next();
        }
    }
};


// Project invitation entry point

exports.i = function (req, res, next) {

    // Fetch invitation details

    Api.call('GET', '/invite/' + req.params.id, '', function (data, err, code) {

        if (err === null &&
            data &&
            data.title &&
            data.inviter) {

            // Save information

            res.api.jar.invite = { code: req.params.id, about: data };
            res.api.redirect = '/signup/invite';
            next();
        }
        else {

            res.api.view = { template: 'invite-invalid' };
            next();
        }
    });
};


// Project invitation

exports.invite = function (req, res, next) {

    if (req.api.jar.invite &&
        req.api.jar.invite.code &&
        req.api.jar.invite.about) {

        res.api.jar.invite = req.api.jar.invite;

        var locals = {

            title: req.api.jar.invite.about.title,
            inviter: req.api.jar.invite.about.inviter,
            code: req.api.jar.invite.code
        };

        if (req.api.profile) {

            res.api.view = { template: 'invite-in', locals: locals };
            next();
        }
        else {

            res.api.view = { template: 'invite-out', locals: locals };
            next();
        }
    }
    else {

        res.api.view = { template: 'invite-invalid' };
        next();
    }
};


// Claim project invitation by current user

exports.claim = function (req, res, next) {

    if (req.api.jar.invite &&
        req.api.jar.invite.code) {

        Api.call('POST', '/invite/' + req.api.jar.invite.code + '/claim', '', req.api.session, function (data, err, code) {

            if (err === null &&
                data &&
                data.project) {

                res.api.redirect = req.api.profile.view + '#project=' + data.project;
                next();
            }
            else {

                res.api.view = { template: 'invite-invalid' };
                next();
            }
        });
    }
    else {

        res.api.view = { template: 'invite-invalid' };
        next();
    }
};


// Log out and use invite with another account

exports.other = function (req, res, next) {

    // Maintain state

    res.api.jar.invite = req.api.jar.invite;

    // Log out

    Session.clear(res);

    // Try again

    res.api.redirect = '/signup/invite';
    next();
};


// Create account from project invite

exports.inviteRegister = function (req, res, next) {

    if (req.api.jar.invite &&
        req.api.jar.invite.code &&
        req.api.jar.invite.about) {

        var registration = {};

        Api.clientCall('PUT', '/user?invite=' + encodeURIComponent(req.api.jar.invite.code), registration, function (result, err, code) {

            if (err === null) {

                // Login new user

                var tokenRequest = {

                    grant_type: 'http://ns.postmile.net/id',
                    x_user_id: result.id
                };

                Login.loginCall(tokenRequest, res, next, '/view/' + (req.api.jar.invite.about.project ? '#project=' + req.api.jar.invite.about.project : ''));
            }
            else {

                res.api.view = { template: 'invite-invalid' };
                next();
            }
        });
    }
    else {

        res.api.view = { template: 'invite-invalid' };
        next();
    }
};


