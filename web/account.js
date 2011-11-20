/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Api = require('./api');
var Err = require('./error');
var Config = require('./config');


// Account page

exports.get = function (req, res, next) {

    if (req.params.panel &&
        (req.params.panel === 'profile' ||
         req.params.panel === 'linked' ||
         req.params.panel === 'emails')) {

        var locals = {

            env: {

                username: req.api.profile.username,
                currentUsername: req.api.profile.username,
                name: req.api.profile.name,
                message: req.api.jar.message || ''
            }
        };

        res.api.view = { template: 'account-' + req.params.panel, locals: locals };
        next();
    }
    else {

        if (req.api.jar.message) {

            res.api.jar.message = req.api.jar.message;
        }

        res.api.redirect = '/account/profile';
        next();
    }
};


// Account reminder using email or username

exports.reminder = function (req, res, next) {

    Api.clientCall('POST', '/user/reminder', { account: req.body.account }, function (result, err, code) {

        if (result && result.result === 'ok') {

            res.api.result = result;
            next();
        }
        else if (err &&
                 err.code) {

            if (err.code === 404) {

                res.api.error = Err.notFound();
                res.api.isAPI = true;
                next();
            }
            else if (err.code === 400) {

                res.api.error = Err.badRequest();
                res.api.isAPI = true;
                next();
            }
            else {

                res.api.error = Err.internal('Unexpected API response', err);
                res.api.isAPI = true;
                next();
            }
        }
        else {

            res.api.error = Err.internal('Unexpected API response', err);
            res.api.isAPI = true;
            next();
        }
    });

};


// Update account profile

exports.profile = function (req, res, next) {

    var body = {};

    if (req.body.username !== req.api.profile.username) {

        body.username = req.body.username;
    }

    if (req.body.name &&
        req.body.name !== req.api.profile.name) {

        body.name = req.body.name;
    }

    if (Object.keys(body).length > 0) {

        Api.call('POST', '/profile', body, req.api.session, function (result, err, code) {

            if (err) {

                res.api.jar.message = 'Failed saving changes. ' + (err.code === 400 ? err.message : 'Service unavailable');
            }

            res.api.redirect = '/account/profile';
            next();
        });
    }
    else {

        res.api.redirect = '/account/profile';
        next();
    }
};


// Update account profile

exports.emails = function (req, res, next) {

    switch (req.body.action) {

        case 'add':
        case 'remove':
        case 'primary':
        case 'verify':

            Api.call('POST', '/profile/email', req.body, req.api.session, function (result, err, code) {

                if (err) {

                    res.api.jar.message = 'Failed saving changes. ' + (err.code === 400 ? err.message : 'Service unavailable');
                }
                else if (req.body.action === 'verify') {

                    res.api.jar.message = 'Verification email sent. Please check your inbox (or spam folder) for an email from ' + Config.product.name + ' and follow the instructions.';
                }

                res.api.redirect = '/account/emails';
                next();
            });

            break;

        default:

            res.api.jar.message = 'Failed saving changes. Bad request';
            res.api.redirect = '/account/emails';
            next();

            break;
    }
};





