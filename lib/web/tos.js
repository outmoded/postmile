// Load modules

var Api = require('./api');
var Session = require('./session');


// Declare internals

var internals = {};


// Globals

exports.minimumTOS = '20110623';
exports.currentTOS = '20110623';


// TOS page

exports.get = function (request, reply) {

    if (request.auth.credentials.restriction === 'tos' ||
        !request.auth.credentials.ext.tos ||
        request.auth.credentials.ext.tos < exports.minimumTOS) {

        return reply.view('tos', { env: { next: request.query.next || '' } });
    }

    return reply().redirect((request.query.next && request.query.next.charAt(0) === '/' ? request.query.next : request.auth.credentials.profile.view));
};


// Accept TOS

exports.post = function (request, reply) {

    Api.clientCall('POST', '/user/' + request.auth.credentials.profile.id + '/tos/' + exports.currentTOS, '', function (err, code, payload) {

        // Refresh token

        Session.refresh(request, request.auth.credentials, function (err, session) {

            return reply().redirect('/tos' + (request.payload.next ? '?next=' + encodeURIComponent(request.payload.next) : ''));
        });
    });
};


