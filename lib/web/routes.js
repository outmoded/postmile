// Load modules

var Account = require('./account');
var Login = require('./login');
var Misc = require('./misc');
var Session = require('./session');
var Signup = require('./signup');
var Tos = require('./tos');


// Declare internals

var internals = {};


// API Server Endpoints

exports.endpoints = [
    { method: 'GET',    path: '/',                          handler: Misc.home },
    { method: 'POST',   path: '/',                          handler: Misc.home,              config: { plugins: { crumb: false } } },

    { method: 'GET',    path: '/login',                     handler: Login.login,           config: { app: { hasMobile: true } } },
    { method: 'GET',    path: '/logout',                    handler: Login.logout },
    { method: 'GET',    path: '/auth/{network}',            handler: Login.auth },
    { method: 'POST',   path: '/auth/{network}',            handler: Login.auth,            config: { plugins: { crumb: false } } },
    { method: 'POST',   path: '/account/unlink',            handler: Login.unlink,          config: { auth: { mode: 'required' } } },
    { method: 'GET',    path: '/t/{token}',                 handler: Login.emailToken },

    { method: 'GET',    path: '/account',                   handler: Account.get,           config: { auth: { mode: 'required' } } },
    { method: 'GET',    path: '/account/{panel}',           handler: Account.get,           config: { auth: { mode: 'required' } } },
    { method: 'POST',   path: '/account/reminder',          handler: Account.reminder,      config: { plugins: { crumb: false }, app: { isApi: true } } }, // body: { account: {} }
    { method: 'POST',   path: '/account/profile',           handler: Account.profile,       config: { auth: { mode: 'required' } } },
    { method: 'POST',   path: '/account/emails',            handler: Account.emails,        config: { auth: { mode: 'required' } } }, //, body: { address: {}, action: {} } },

    { method: 'GET',    path: '/tos',                       handler: Tos.get,               config: { auth: { mode: 'required' } } },
    { method: 'POST',   path: '/tos',                       handler: Tos.post,              config: { auth: { mode: 'required' } } },

    { method: 'GET',    path: '/signup/register',           handler: Signup.form },
    { method: 'POST',   path: '/signup/register',           handler: Signup.register,       config: { plugins: { crumb: false } } },
    { method: 'GET',    path: '/i/{id}',                    handler: Signup.i },
    { method: 'GET',    path: '/signup/invite',             handler: Signup.invite },
    { method: 'POST',   path: '/signup/invite/claim',       handler: Signup.claim,          config: { auth: { mode: 'required' } } },
    { method: 'GET',    path: '/signup/invite/other',       handler: Signup.other },
    { method: 'POST',   path: '/signup/invite/register',    handler: Signup.inviteRegister, config: { plugins: { crumb: false } } },

    { method: 'GET',    path: '/welcome',                   handler: Misc.welcome,          config: { auth: { mode: 'required' } } },
    { method: 'GET',    path: '/about',                     handler: Misc.about },
    { method: 'GET',    path: '/developer',                 handler: Misc.developer },
    { method: 'GET',    path: '/developer/console',         handler: Misc.console,          config: { auth: { mode: 'required' } } },
    { method: 'GET',    path: '/imwithstupid',              handler: Misc.stupid },
    { method: 'GET',    path: '/feedback',                  handler: Misc.feedback },
    { method: 'POST',   path: '/feedback',                  handler: Misc.feedback,         config: { plugins: { crumb: false } } },

    { method: 'GET',    path: '/oz/authorize',              handler: Session.ask,           config: { auth: { mode: 'required' } } },
    { method: 'POST',   path: '/oz/authorize',              handler: Session.answer,        config: { auth: { mode: 'required' } } },
    { method: 'GET',    path: '/oz/session',                handler: Session.session,       config: { auth: { mode: 'required' }, app: { isApi: true } } },

    { method: 'GET',    path: '/socket.io.js',              handler: Misc.socketio },
    { method: 'GET',    path: '/config.js',                 handler: Misc.config,           config: { app: { isApi: true } } }
];



