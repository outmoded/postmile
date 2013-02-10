// Load modules

var Boom = require('boom');
var Hoek = require('hoek');
var Cryptiles = require('cryptiles');


// Declare internals

var internals = {};

internals.config = {
    name: 'crumb',
    size: 43,                       // Equal to 256 bits
    autoGenerate: true,             // If false, must call request.plugins.crumb.generate() manually before usage
    addToViewContext: true,         // If response is a view, add crumb to context
    options: {                      // Cookie options (i.e. hapi server.state)
        path: '/'
    }
};


internals.routeDefaults = {
    key: 'crumb',                   // query or payload key
    source: 'payload'               // Crunm key source: 'payload', 'query'
};


exports.register = function (pack, options, next) {

    Hoek.merge(internals.config, options);

    pack.state(internals.config.name, internals.config.options);
    pack.ext('onPreHandler', internals.onPreHandler);
    pack.ext('onPostHandler', internals.onPostHandler);
    pack.api({ generate: internals.generate });

    return next();
};


internals.generate = function (request) {

    var crumb = request.state[internals.config.name];
    if (!crumb) {
        crumb = Cryptiles.randomString(internals.config.size);
        request.setState(internals.config.name, crumb, internals.config.options);
    }

    request.plugins.crumb = crumb;
    return request.plugins.crumb;
};


internals.onPreHandler = function (request, next) {

    // Validate incoming crumb

    if (!request.route.plugins._crumb) {
        request.route.plugins._crumb = Hoek.applyToDefaults(internals.routeDefaults, request.route.plugins.crumb);
    }

    // Set crumb cookie and calculate crumb

    if (internals.config.autoGenerate ||
        request.route.plugins._crumb) {

        internals.generate(request);
    }

    // Validate crumb

    if (request.route.plugins._crumb) {
        var crumb = request[request.route.plugins._crumb.source][request.route.plugins._crumb.key];
        if (crumb !== request.plugins.crumb) {
            return next(Boom.forbidden());
        }

        // Remove crumb

        delete request[request.route.plugins._crumb.source][request.route.plugins._crumb.key];
    }

    return next();
};


internals.onPostHandler = function (request, next) {

    // Add to view context

    if (internals.config.addToViewContext &&
        request.plugins.crumb &&
        request.response &&
        request.response instanceof Boom === false &&
        request.response.varieties.view) {

        request.response.view.context = request.response.view.context || {};
        request.response.view.context.crumb = request.plugins.crumb;
    }

    return next();
};

