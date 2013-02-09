// Load modules

var Crypto = require('crypto');


// Remove hidden keys

exports.removeKeys = function (object, keys) {

    for (var i = 0, il = keys.length; i < il; i++) {
        delete object[keys[i]];
    }
};


exports.dateRegex = /^([12]\d\d\d)-([01]\d)-([0123]\d)$/;
exports.timeRegex = /^([012]\d):([012345]\d):([012345]\d)$/;


// Random string

exports.getRandomString = function (size) {

    var randomSource = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var len = randomSource.length;
    size = size || 10;

    if (typeof size === 'number' &&
        !isNaN(size) && size >= 0 &&
        (parseFloat(size) === parseInt(size))) {

        var result = [];

        for (var i = 0; i < size; ++i) {
            result[i] = randomSource[Math.floor(Math.random() * len)];
        }

        return result.join('');
    }
    else {
        return null;
    }
};


// AES256 Symmetric encryption

exports.encrypt = function (key, value) {

    var envelope = JSON.stringify({ v: value, a: exports.getRandomString(2) });

    var cipher = Crypto.createCipher('aes256', key);
    var enc = cipher.update(envelope, 'utf8', 'binary');
    enc += cipher.final('binary');

    var result = (new Buffer(enc, 'binary')).toString('base64').replace(/\+/g, '-').replace(/\//g, ':').replace(/\=/g, '');
    return result;
};


exports.decrypt = function (key, value) {

    var input = (new Buffer(value.replace(/-/g, '+').replace(/:/g, '/'), 'base64')).toString('binary');

    var decipher = Crypto.createDecipher('aes256', key);
    var dec = decipher.update(input, 'binary', 'utf8');
    dec += decipher.final('utf8');

    var envelope = null;

    try {
        envelope = JSON.parse(dec);
    }
    catch (e) {
    }

    return envelope ? envelope.v : null;
};

