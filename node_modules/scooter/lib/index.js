// Load modules

var Hoek = require('hoek');
var Useragent = require('useragent');


// Declare internals

var internals = {};

internals.config = {
};


exports.register = function (pack, options, next) {

    Hoek.merge(internals.config, options);

    pack.ext('onRequest', internals.onRequest);

    next();
};


internals.onRequest = function (request, next) {

    var agent = Useragent.lookup(request.raw.req.headers['user-agent']);
    request.plugins.scooter = agent;
    next();
};
