// Load modules

var Server = require('./server');
var Routes = require('./routes');


// Create Server

Server.create(Routes.endpoints);



