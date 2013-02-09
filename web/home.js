// Get home page

exports.get = function (request) {

    if (request.session &&
        request.session.profile) {

        return request.reply.redirect(request.session.profile.view).send();
    }
    else {
        var locals = {
            logo: false,
            env: {
                message: request.state.jar.message || ''
            }
        };

        return request.reply.view('home', locals).send();
    }
};


