// Load modules

var Hapi = require('hapi');
var Details = require('./details');
var Invite = require('./invite');
var Last = require('./last');
var Session = require('./session');
var Project = require('./project');
var Storage = require('./storage');
var Stream = require('./stream');
var Suggestions = require('./suggestions');
var Task = require('./task');
var Tips = require('./tips');
var User = require('./user');


// API Server Endpoints

exports.endpoints = [

    { method: 'GET', path: '/oz/app/{id}', config: Session.app },
    { method: 'POST', path: '/oz/login', config: Session.login },

    { method: 'GET', path: '/profile', config: User.get },
    { method: 'POST', path: '/profile', config: User.post },
    { method: 'POST', path: '/profile/email', config: User.email },
    { method: 'GET', path: '/contacts', config: User.contacts },
    { method: 'GET', path: '/who', config: User.who },

    { method: 'PUT', path: '/user', config: User.put },
    { method: 'POST', path: '/user/{id}/tos/{version}', config: User.tos },
    { method: 'POST', path: '/user/{id}/link/{network}', config: User.link },
    { method: 'DELETE', path: '/user/{id}/link/{network}', config: User.unlink },
    { method: 'POST', path: '/user/{id}/view/{path}', config: User.view },
    { method: 'GET', path: '/user/lookup/{type}/{id}', config: User.lookup },
    { method: 'POST', path: '/user/reminder', config: User.reminder },
    { method: 'DELETE', path: '/user', config: User.del },

    { method: 'GET', path: '/projects', config: Project.list },
    { method: 'GET', path: '/project/{id}', config: Project.get },
    { method: 'POST', path: '/project/{id}', config: Project.post },
    { method: 'PUT', path: '/project', config: Project.put },
    { method: 'DELETE', path: '/project/{id}', config: Project.del },
    { method: 'GET', path: '/project/{id}/tips', config: Project.tips },
    { method: 'GET', path: '/project/{id}/suggestions', config: Project.suggestions },
    { method: 'POST', path: '/project/{id}/participants', config: Project.participants },
    { method: 'DELETE', path: '/project/{id}/participants', config: Project.uninvite },
    { method: 'DELETE', path: '/project/{id}/participant/{user}', config: Project.uninvite },
    { method: 'POST', path: '/project/{id}/join', config: Project.join },

    { method: 'GET', path: '/project/{id}/tasks', config: Task.list },
    { method: 'GET', path: '/task/{id}', config: Task.get },
    { method: 'POST', path: '/task/{id}', config: Task.post },
    { method: 'PUT', path: '/project/{id}/task', config: Task.put },
    { method: 'DELETE', path: '/task/{id}', config: Task.del },

    { method: 'GET', path: '/task/{id}/details', config: Details.get },
    { method: 'POST', path: '/task/{id}/detail', config: Details.post },

    { method: 'DELETE', path: '/project/{id}/suggestion/{drop}', config: Suggestions.exclude },

    { method: 'GET', path: '/project/{id}/last', config: Last.getProject },
    { method: 'POST', path: '/project/{id}/last', config: Last.postProject },
    { method: 'GET', path: '/task/{id}/last', config: Last.getTask },
    { method: 'POST', path: '/task/{id}/last', config: Last.postTask },

    { method: 'GET', path: '/storage/{id?}', config: Storage.get },
    { method: 'POST', path: '/storage/{id}', config: Storage.post },
    { method: 'DELETE', path: '/storage/{id}', config: Storage.del },

    { method: 'GET', path: '/invite/{id}', config: Invite.get },
    { method: 'POST', path: '/invite/{id}/claim', config: Invite.claim },

    { method: 'POST', path: '/stream/{id}/project/{project}', config: Stream.subscribe },
    { method: 'DELETE', path: '/stream/{id}/project/{project}', config: Stream.unsubscribe }
];

