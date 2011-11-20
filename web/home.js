/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Get home page

exports.get = function (req, res, next) {

    if (req.api.profile) {

        res.api.redirect = req.api.profile.view;
        next();
    }
    else {

        var locals = {

            logo: false,
            env: {

                message: req.api.jar.message || ''
            }
        };

        res.api.view = { template: 'home', locals: locals };
        next();
    }
};


