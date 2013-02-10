// Load modules

var Hapi = require('hapi');
var Email = require('./email');
var Config = require('./config');


// Welcome page

exports.welcome = function (request) {

    return request.reply.redirect(request.session.profile.view).send();
};


// About page

exports.about = function (request) {

    return request.reply.view('about').send();
};


// Developer page

exports.developer = function (request) {

    return request.reply.view('developer', { theme: 'developer' }).send();
};


// Developer Console

exports.console = function (request) {

    return request.reply.view('console').send();
};


// Set I'm with stupid cookie

exports.stupid = function (request) {

    request.state('imwithstupid', 'true', { path: '/' });
    return request.reply.redirect('/').send();
};


// Feedback page

exports.feedback = function (request) {

    if (request.method === 'get') {
        return request.reply.view('feedback').send();
    }
    else {
        var feedback = 'From: ' + (request.payload.username ? request.payload.username : request.payload.name + ' <' + request.payload.email + '>') + '\n\n' + request.payload.message;
        Email.send(Config.email.feedback, 'Posmile site feedback', feedback);

        return request.reply.view('feedback', { env: { message: 'Your feedback has been received!' } }).send();
    }
};


// Client configuration script

exports.config = function (request) {

    var config = Hapi.utils.clone(Config.host);
    config.web.uri = Config.host.uri('web');
    config.api.uri = Config.host.uri('api');

    request.reply('var postmile = ' + JSON.stringify(config) + ';');
};


// Socket.IO Script Proxy

exports.socketio = function (request) {

    return request.reply.redirect(Config.host.uri('api') + '/socket.io/socket.io.js').send();
};
