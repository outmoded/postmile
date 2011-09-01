/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Server = require('./server');
var Routes = require('./routes');
var Suggestions = require('./suggestions');
var Tips = require('./tips');


// Create Server

Server.create(Routes.endpoints, function (server) {

    // Load in-memory cache

    Suggestions.initialize();
    Tips.initialize();
});

