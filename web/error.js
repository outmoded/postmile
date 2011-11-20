/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Define error codes

exports.badRequest = function (message) {

    return { code: 400, text: 'Bad request', message: message };
};

exports.forbidden = function (message) {

    return { code: 403, text: 'Not allowed', message: message };
};

exports.notFound = function (message) {

    return { code: 404, text: 'Not Found', message: message };
};

exports.internal = function (message, err) {

    return { code: 500, text: 'Internal error', message: message, log: err };
};

exports.database = function (err) {

    return { code: 500, text: 'Internal error', log: err };
};
