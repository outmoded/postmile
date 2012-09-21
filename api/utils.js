/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/


// Remove hidden keys

exports.removeKeys = function (object, keys) {

    for (var i = 0, il = keys.length; i < il; i++) {
        delete object[keys[i]];
    }
};


exports.dateRegex = /^([12]\d\d\d)-([01]\d)-([0123]\d)$/;
exports.timeRegex = /^([012]\d):([012345]\d):([012345]\d)$/;

