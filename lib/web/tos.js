// Load modules

var Api = require('./api');
var Session = require('./session');


// Globals

exports.minimumTOS = '20110623';
exports.currentTOS = '20110623';


// TOS page

exports.get = function (request) {

    if (request.auth.credentials.restriction === 'tos' ||
        !request.auth.credentials.ext.tos ||
        request.auth.credentials.ext.tos < exports.minimumTOS) {

        return request.reply.view('tos', { env: { next: request.query.next || '' } }).send();
    }

    return request.reply.redirect((request.query.next && request.query.next.charAt(0) === '/' ? request.query.next : request.auth.credentials.profile.view)).send();
};


// Accept TOS

exports.post = function (request) {

    Api.clientCall('POST', '/user/' + request.auth.credentials.profile.id + '/tos/' + exports.currentTOS, '', function (err, code, payload) {

        // Refresh token

        Session.refresh(request, request.auth.credentials, function (err, session) {

            return request.reply.redirect('/tos' + (request.payload.next ? '?next=' + encodeURIComponent(request.payload.next) : '')).send();
        });
    });
};


