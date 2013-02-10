// Load modules

var Hapi = require('hapi');
var Email = require('emailjs');
var Config = require('./config');


// Send message

exports.send = function (to, subject, text, html, callback) {

    var headers = {
        from: Config.email.fromName + ' <' + Config.email.replyTo + '>',
        to: to,
        subject: subject,
        text: text
    };

    var message = Email.message.create(headers);

    if (html) {
        message.attach_alternative(html);
    }

    var mailer = Email.server.connect(Config.email.server);
    mailer.send(message, function (err, message) {

        if (err) {
            if (!callback) {
                return Hapi.log.err('Email error: ' + JSON.stringify(err));
            }

            return callback(Hapi.error.internal('Failed sending email: ' + JSON.stringify(err)));
        }

        if (callback) {
            return callback(null);
        }
    });
};

