// Server Configuration

exports.host = {

    web: {

        domain: 'postmile.net',
        port: 80,
        scheme: 'https'
    },

    api: {

        domain: 'postmile.net',
        port: 8000,
        scheme: 'http'
    },

    uri: function (type) {

        var set = (type == 'web' ? web : api);
        return set.scheme + '://' + set.domain + (set.port ? ':' + set.port : '');
    },

    authority: function (type) {

        var set = (type == 'web' ? web : api);
        return set.domain + (set.port ? ':' + set.port : '');
    }
};


// Product Configuration

exports.product = {

    name: 'Postmile'
};


// Email Configuration

exports.email = {

    fromName: 'Postmile.net',
    replyTo: 'no-reply@postmile.net',
    admin: 'admin@postmile.net',
    feedback: 'admin@postmile.net'

    server: {

/*      port: 25,
        user: '',
        password: '',
        host: 'localhost',
        ssl: false              */
    }
};




