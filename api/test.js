/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

var Utils = require('./utils');

var s = '';
var e = '';

while (e.length < 4096) {

    s += Utils.getRandomString(1);
    e = Utils.encrypt(Utils.getRandomString(220), s);
}

console.log(s.length);
