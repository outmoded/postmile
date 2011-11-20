/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/


// Declare internals

var internals = {};


// Info

exports.info = function (error, req) {

    internals.log('info', error, req);
};


// Err

exports.err = function (error, req) {

    internals.log('err', error, req);
};


// Log output

internals.log = function (level, error, req) {

    if (typeof error === 'string') {

        internals.print(level, error, req);
    }
    else if (req) {

        if (error.type === 'oauth') {

            internals.print(level, 'OAuth: ' + error.error + ' (' + error.text + ')', req);
        }
        else {

            internals.print(level, 'HTTP: ' + error.code + ' ' + (error.message || error.text), req);
        }

        if (error.log) {

            internals.print(level, 'Log: ' + JSON.stringify(error.log), req);
        }
    }
    else {

        internals.print(level, JSON.stringify(error));
    }
};


// Format output

internals.print = function (level, message, req) {

    function pad(value) {

        return (value < 10 ? '0' : '') + value;
    }

    var now = new Date();
    var timestamp = (now.getYear() - 100).toString() +
                    pad(now.getMonth() + 1) +
                    pad(now.getDate()) +
                    '/' +
                    pad(now.getHours()) +
                    pad(now.getMinutes()) +
                    pad(now.getSeconds()) +
                    '.' +
                    now.getMilliseconds();

    console.log(timestamp + ', ' + level + ', ' + message + (req ? (req.api && req.api.agent ? ', ' + req.api.agent.fullName : '') + ', ' + req.method + ', ' + req.url : ''));
};

