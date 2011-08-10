/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Server = require('./server');
var Batch = require('./batch');
var Details = require('./details');
var Invite = require('./invite');
var Last = require('./last');
var Session = require('./session');
var Sled = require('./sled');
var Storage = require('./storage');
var Stream = require('./stream');
var Suggestions = require('./suggestions');
var Task = require('./task');
var Tips = require('./tips');
var User = require('./user');


// Create Server

Server.create([

    { method: 'POST',   path: '/oauth/token',               handler: Session.token,         data: Session.type.endpoint, authentication: 'optional', user: 'any', tos: 'none' },
    { method: 'GET',    path: '/oauth/client/:id',          handler: Session.client,        scope: 'login', user: 'none' },

    { method: 'GET',    path: '/profile',                   handler: User.get,              tos: 'none' },
    { method: 'POST',   path: '/profile',                   handler: User.post,             data: User.type.user, tos: 'none' },
    { method: 'POST',   path: '/profile/email',             handler: User.email,            data: User.type.email, tos: 'none' },
    { method: 'GET',    path: '/contacts',                  handler: User.contacts,         query: ['exclude'], tos: 'none' },
    { method: 'GET',    path: '/who',                       handler: User.who,              tos: 'none' },

    { method: 'PUT',    path: '/user',                      handler: User.put,              query: ['invite'], data: User.type.put, scope: 'signup', user: 'none' },
    { method: 'POST',   path: '/user/:id/tos/:version',     handler: User.tos,              scope: 'tos', user: 'none' },
    { method: 'POST',   path: '/user/:id/link/:network',    handler: User.link,             data: User.type.link, scope: 'login', user: 'none' },
    { method: 'DELETE', path: '/user/:id/link/:network',    handler: User.unlink,           scope: 'login', user: 'none' },
    { method: 'POST',   path: '/user/:id/view/:path',       handler: User.view,             scope: 'view', user: 'none' },
    { method: 'GET',    path: '/user/lookup/:type/:id',     handler: User.lookup,           authentication: 'none' },
    { method: 'POST',   path: '/user/reminder',             handler: User.reminder,         data: User.type.reminder, scope: 'reminder', user: 'none' },
    { method: 'DELETE', path: '/user',                      handler: User.del,              scope: 'quit', tos: 'none' },

    { method: 'GET',    path: '/sleds',                     handler: Sled.list },
    { method: 'GET',    path: '/sled/:id',                  handler: Sled.get },
    { method: 'POST',   path: '/sled/:id',                  handler: Sled.post,             query: ['position'], data: Sled.type.post },
    { method: 'PUT',    path: '/sled',                      handler: Sled.put,              data: Sled.type.put },
    { method: 'DELETE', path: '/sled/:id',                  handler: Sled.del },
    { method: 'GET',    path: '/sled/:id/tips',             handler: Sled.tips },
    { method: 'GET',    path: '/sled/:id/suggestions',      handler: Sled.suggestions },
    { method: 'POST',   path: '/sled/:id/participants',     handler: Sled.participants,     query: ['message'], data: Sled.type.participants },
    { method: 'DELETE', path: '/sled/:id/participants',     handler: Sled.uninvite,         data: Sled.type.uninvite },
    { method: 'DELETE', path: '/sled/:id/participant/:user',handler: Sled.uninvite },
    { method: 'POST',   path: '/sled/:id/join',             handler: Sled.join },

    { method: 'GET',    path: '/sled/:id/tasks',            handler: Task.list },
    { method: 'GET',    path: '/task/:id',                  handler: Task.get },
    { method: 'POST',   path: '/task/:id',                  handler: Task.post,             query: ['position'], data: Task.type.post },
    { method: 'PUT',    path: '/sled/:id/task',             handler: Task.put,              query: ['suggestion', 'position'],  data: Task.type.put },
    { method: 'DELETE', path: '/task/:id',                  handler: Task.del },

    { method: 'GET',    path: '/task/:id/details',          handler: Details.get,           query: ['since'] },
    { method: 'POST',   path: '/task/:id/detail',           handler: Details.post,          query: ['last'], data: Details.type },

    { method: 'DELETE', path: '/sled/:id/suggestion/:drop', handler: Suggestions.exclude },

    { method: 'GET',    path: '/sled/:id/last',             handler: Last.getSled },
    { method: 'POST',   path: '/sled/:id/last',             handler: Last.postSled },
    { method: 'GET',    path: '/task/:id/last',             handler: Last.getTask },
    { method: 'POST',   path: '/task/:id/last',             handler: Last.postTask },

    { method: 'GET',    path: '/storage/:id?',              handler: Storage.get },
    { method: 'POST',   path: '/storage/:id',               handler: Storage.post,          data: Storage.type },
    { method: 'DELETE', path: '/storage/:id',               handler: Storage.del },

    { method: 'GET',    path: '/invite/:id',                handler: Invite.get,            authentication: 'none'},
    { method: 'POST',   path: '/invite/:id/claim',          handler: Invite.claim },
    
    { method: 'POST',   path: '/stream/:id/sled/:sled',     handler: Stream.subscribe },
    { method: 'DELETE', path: '/stream/:id/sled/:sled',     handler: Stream.unsubscribe },
    
    { method: 'POST',   path: '/batch',                     handler: Batch.post,            data: Batch.type }

], function (server) {

    // Load in-memory cache

    Suggestions.initialize();
    Tips.initialize();
});

