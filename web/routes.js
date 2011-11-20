/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Account = require('./account');
var Home = require('./home');
var Login = require('./login');
var Misc = require('./misc');
var Session = require('./session');
var Signup = require('./signup');
var Tos = require('./tos');


// API Server Endpoints

exports.endpoints = [

    { method: 'GET',    path: '/',                          handler: Home.get },
    { method: 'POST',   path: '/',                          handler: Home.get },

    { method: 'GET',    path: '/login',                     handler: Login.login },
    { method: 'GET',    path: '/logout',                    handler: Login.logout },
    { method: 'GET',    path: '/auth/:network',             handler: Login.auth },
    { method: 'POST',   path: '/auth/:network',             handler: Login.auth },
    { method: 'POST',   path: '/account/unlink',            handler: Login.unlink,          authentication: 'session' },
    { method: 'GET',    path: '/t/:token',                  handler: Login.emailToken },

    { method: 'GET',    path: '/account',                   handler: Account.get,           authentication: 'session' },
    { method: 'GET',    path: '/account/:panel',            handler: Account.get,           authentication: 'session' },
    { method: 'POST',   path: '/account/reminder',          handler: Account.reminder,      body: { account: {} } },
    { method: 'POST',   path: '/account/profile',           handler: Account.profile,       authentication: 'session' },
    { method: 'POST',   path: '/account/emails',            handler: Account.emails,        authentication: 'session', body: { address: {}, action: {} } },

    { method: 'GET',    path: '/tos',                       handler: Tos.get,               authentication: 'session' },
    { method: 'POST',   path: '/tos',                       handler: Tos.post,              authentication: 'session' },

    { method: 'GET',    path: '/signup/register',           handler: Signup.register },
    { method: 'POST',   path: '/signup/register',           handler: Signup.register },
    { method: 'GET',    path: '/i/:id',                     handler: Signup.i },
    { method: 'GET',    path: '/signup/invite',             handler: Signup.invite },
    { method: 'POST',   path: '/signup/invite/claim',       handler: Signup.claim,          authentication: 'session' },
    { method: 'GET',    path: '/signup/invite/other',       handler: Signup.other },
    { method: 'POST',   path: '/signup/invite/register',    handler: Signup.inviteRegister },

    { method: 'GET',    path: '/welcome',                   handler: Misc.welcome,          authentication: 'session' },
    { method: 'GET',    path: '/about',                     handler: Misc.about },
    { method: 'GET',    path: '/developer',                 handler: Misc.developer },
    { method: 'GET',    path: '/developer/console',         handler: Misc.console,          authentication: 'session' },
    { method: 'GET',    path: '/imwithstupid',              handler: Misc.stupid },
    { method: 'GET',    path: '/feedback',                  handler: Misc.feedback },
    { method: 'POST',   path: '/feedback',                  handler: Misc.feedback },

    { method: 'GET',    path: '/oauth/authorize',           handler: Session.oauth,         authentication: 'session' },
    { method: 'POST',   path: '/oauth/authorize',           handler: Session.oauth,         authentication: 'session' },
    { method: 'GET',    path: '/oauth/issue',               handler: Session.issue },

    { method: 'GET',    path: '/socket.io.js',              handler: Misc.socketio },
    { method: 'GET',    path: '/config.js',                 handler: Misc.config }
];



