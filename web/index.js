/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Server = require('./server');
var Routes = require('./routes');


// Create Server

Server.create(Routes.endpoints);



