// Get home page

exports.get = function (request) {

    if (request.auth.credentials &&
        request.auth.credentials.profile) {

        return request.reply.redirect(request.auth.credentials.profile.view).send();
    }
    else {
        var locals = {
            logo: false,
            env: {
                message: request.session.get('message', true) || ''
            }
        };

        return request.reply.view('home', locals).send();
    }
};


