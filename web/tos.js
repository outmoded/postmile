/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Api = require('./api');
var Session = require('./session');


// Globals

exports.minimumTOS = '20110623';
exports.currentTOS = '20110623';


// TOS page

exports.get = function (req, res, next) {

    if (req.api.session.restriction === 'tos' ||
        !req.api.session.tos ||
        req.api.session.tos < exports.minimumTOS) {

        res.api.view = { template: 'tos', locals: { env: { next: req.query.next || ''}} };
        next();
    }
    else {

        res.api.redirect = (req.query.next && req.query.next.charAt(0) === '/' ? req.query.next : req.api.profile.view);
        next();
    }
};


// Accept TOS

exports.post = function (req, res, next) {

    Api.clientCall('POST', '/user/' + req.api.profile.id + '/tos/' + exports.currentTOS, '', function (result, err, code) {

        // Refresh token

        Session.refresh(req, res, req.api.session, function (session, err) {

            res.api.redirect = '/tos' + (req.body.next ? '?next=' + encodeURIComponent(req.body.next) : '');
            next();
        });
    });
};


