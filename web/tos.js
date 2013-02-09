// Load modules

var Api = require('./api');
var Session = require('./session');


// Globals

exports.minimumTOS = '20110623';
exports.currentTOS = '20110623';


// TOS page

exports.get = function (request) {

    if (request.session.restriction === 'tos' ||
        !request.session.ext.tos ||
        request.session.ext.tos < exports.minimumTOS) {

        return request.reply.view('tos', { env: { next: request.query.next || '' } });
    }

    return request.reply.redirect((request.query.next && request.query.next.charAt(0) === '/' ? request.query.next : request.session.profile.view)).send();
};


// Accept TOS

exports.post = function (request) {

    Api.clientCall('POST', '/user/' + request.session.profile.id + '/tos/' + exports.currentTOS, '', function (err, code, payload) {

        // Refresh token

        Session.refresh(req, res, request.session, function (err, session) {

            return request.reply.redirect('/tos' + (request.payload.next ? '?next=' + encodeURIComponent(request.payload.next) : '')).send();
        });
    });
};


