// Load modules

var Hapi = require('hapi');
var Email = require('./email');
var Config = require('./config');


// Declare internals

var internals = {};


// Home page

exports.home = function (request) {

    if (request.auth.credentials &&
        request.auth.credentials.profile) {

        return request.reply.redirect(request.auth.credentials.profile.view);
    }
    else {
        var locals = {
            logo: false,
            env: {
                message: request.session.get('message', true) || ''
            }
        };

        return request.reply.view('home', locals);
    }
};


// Welcome page

exports.welcome = function (request) {

    return request.reply.redirect(request.auth.credentials.profile.view);
};


// About page

exports.about = function (request) {

    return request.reply.view('about');
};


// Developer page

exports.developer = function (request) {

    return request.reply.view('developer', { theme: 'developer' });
};


// Developer Console

exports.console = function (request) {

    return request.reply.view('console');
};


// Set I'm with stupid cookie

exports.stupid = function (request) {

    request.state('imwithstupid', 'true', { path: '/' });
    return request.reply.redirect('/');
};


// Feedback page

exports.feedback = function (request) {

    if (request.method === 'get') {
        return request.reply.view('feedback');
    }
    else {
        var feedback = 'From: ' + (request.payload.username ? request.payload.username : request.payload.name + ' <' + request.payload.email + '>') + '\n\n' + request.payload.message;
        Email.send(Config.email.feedback, 'Posmile site feedback', feedback);

        return request.reply.view('feedback', { env: { message: 'Your feedback has been received!' } });
    }
};


// Client configuration script

exports.config = function (request) {

    request.reply('var postmile = ' + JSON.stringify(Config.server) + ';');
};


// Socket.IO Script Proxy

exports.socketio = function (request) {

    return request.reply.redirect(Config.server.api.uri + '/socket.io/socket.io.js');
};
