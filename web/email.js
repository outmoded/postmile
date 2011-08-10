/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Email = require('emailjs');
var Err = require('./error');
var Log = require('./log');


// Send message

exports.send = function (to, subject, text, html, callback) {

    var headers = {

        from: 'Sled.com <no-reply@sled.com>',
        to: to,
        subject: subject,
        text: text
    };

    var message = Email.message.create(headers);

    if (html) {

        message.attach_alternative(html);
    }

    var mailer = Email.server.connect({ host: 'localhost' });
    mailer.send(message, function (err, message) {

        if (err === null ||
            err === undefined) {

            if (callback) {

                callback(null);
            }
        }
        else {

            if (callback) {

                callback(Err.internal('Failed sending email: ' + JSON.stringify(err)));
            }
            else {

                Log.err('Email error: ' + err);
            }
        }
    });
};


