/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Validator = require('validator');
var Crypto = require('crypto');
var Base64 = require('./base64');
var Log = require('./log');


// Get current date/time array

exports.getTimestamp = function () {

    return (new Date()).getTime();
};


// Clone object or array

exports.clone = function (obj) {

    if (obj === null ||
        obj === undefined) {

        return null;
    }

    var newObj = (obj instanceof Array) ? [] : {};

    for (var i in obj) {

        if (obj.hasOwnProperty(i)) {

            if (obj[i] && typeof obj[i] === 'object') {

                newObj[i] = exports.clone(obj[i]);
            }
            else {

                newObj[i] = obj[i];
            }
        }
    }

    return newObj;
};


// Validate email address

exports.checkEmail = function (email) {

    try {

        Validator.check(email).len(6, 64).isEmail();
    }
    catch (e) {

        return false;
    }

    return true;
};


// Random string

exports.getRandomString = function (size) {

    var randomSource = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var len = randomSource.length;

    var result = [];

    for (var i = 0; i < size; ++i) {

        result[i] = randomSource[Math.floor(Math.random() * len)];
    }

    return result.join('');
};


// AES256 Symmetric encryption

exports.encrypt = function (key, value) {

    var envelope = JSON.stringify({ v: value, a: exports.getRandomString(2) });

    var cipher = Crypto.createCipher('aes256', key);
    var enc = cipher.update(envelope, input_encoding = 'utf8', output_encoding = 'binary');
    enc += cipher.final(output_encoding = 'binary');

    var result = Base64.encode(enc).replace(/\+/g, '-').replace(/\//g, ':').replace(/\=/g, '');
    return result;
};


exports.decrypt = function (key, value) {

    var input = Base64.decode(value.replace(/-/g, '+').replace(/:/g, '/'));

    var decipher = Crypto.createDecipher('aes256', key);
    var dec = decipher.update(input, input_encoding = 'binary', output_encoding = 'utf8');
    dec += decipher.final(output_encoding = 'utf8');

    var envelope = null;

    try {

        envelope = JSON.parse(dec);
    }
    catch (e) {

        Log.err('Invalid encrypted envelope: ' + JSON.stringify(e));
    }

    return envelope ? envelope.v : null;
};






