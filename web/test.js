/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Test page

exports.get = function (req, res, next) {

    res.api.view = { template: 'test' };
    next();
};


