// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var Rules = require('./rules');
var Project = require('./project');


// Declare internals

var internals = {};


// Suggestions cache

internals.suggestions = {};


// Pre-load all suggestions into cache

exports.initialize = function () {

    Db.all('suggestion', function (err, results) {

        for (var i = 0, il = results.length; i < il; ++i) {

            var suggestion = results[i];
            if (suggestion.rule &&
                suggestion.title) {

                var statement = Rules.normalize(suggestion.rule);
                if (statement) {

                    suggestion.statement = statement;
                    internals.suggestions[suggestion._id] = suggestion;
                }
                else {

                    Hapi.Log.event('err', 'Failed to load suggestions: ' + suggestion._id);
                }
            }
            else {

                Hapi.Log.event('err', 'Bad suggestion: missing rule or title');
            }
        }
    });
};


// Remove suggestion from project

exports.exclude = {
    
    handler: function (request) {

        Project.load(request.params.id, request.session.user, false, function (err, project, member) {

            if (project) {

                var suggestion = internals.suggestions[request.params.drop];
                if (suggestion) {

                    Db.get('user.exclude', request.session.user, function (err, excludes) {

                        if (!err) {

                            if (excludes) {

                                // Existing excludes

                                var changes = { $set: {} };
                                var now = Date.now();

                                if (excludes.projects) {

                                    if (excludes.projects[project._id]) {

                                        if (excludes.projects[project._id].suggestions) {

                                            changes.$set['projects.' + project._id + '.suggestions.' + request.params.drop] = now;
                                        }
                                        else {

                                            changes.$set['projects.' + project._id + '.suggestions'] = {};
                                            changes.$set['projects.' + project._id + '.suggestions'][request.params.drop] = now;
                                        }
                                    }
                                    else {

                                        changes.$set['projects.' + project._id] = { suggestions: {} };
                                        changes.$set['projects.' + project._id].suggestions[request.params.drop] = now;
                                    }
                                }
                                else {

                                    changes.$set.projects = {};
                                    changes.$set.projects[project._id] = { suggestions: {} };
                                    changes.$set.projects[project._id].suggestions[request.params.drop] = now;
                                }

                                Db.update('user.exclude', excludes._id, changes, function (err) {

                                    if (!err) {

                                        request.reply({ status: 'ok' });
                                    }
                                    else {

                                        request.reply(err);
                                    }
                                });
                            }
                            else {

                                // First exclude

                                excludes = { _id: request.session.user, projects: {} };
                                excludes.projects[project._id] = { suggestions: {} };
                                excludes.projects[project._id].suggestions[request.params.drop] = Date.now();

                                Db.insert('user.exclude', excludes, function (err, items) {

                                    if (!err) {

                                        request.reply({ status: 'ok' });
                                    }
                                    else {

                                        request.reply(err);
                                    }
                                });
                            }
                        }
                        else {

                            request.reply(err);
                        }
                    });
                }
                else {

                    request.reply(Hapi.Error.notFound());
                }
            }
            else {

                request.reply(err);
            }
        });
    }
};


// Analyze project and return suggestions list

exports.list = function (project, userId, callback) {

    Db.get('user.exclude', userId, function (err, item) {

        if (err) {
            return callback(err, null);
        }

        var results = [];
        var excludes = item;
        for (var i in internals.suggestions) {

            if (internals.suggestions.hasOwnProperty(i)) {

                var suggestion = internals.suggestions[i];

                var isExcluded = false;
                if (excludes &&
                    excludes.projects &&
                    excludes.projects[project._id] &&
                    excludes.projects[project._id].suggestions &&
                    excludes.projects[project._id].suggestions[suggestion._id]) {

                    isExcluded = true;
                }

                if (isExcluded === false) {

                    try {

                        if (eval(suggestion.statement)) {

                            results.push({

                                id: suggestion._id,
                                title: suggestion.title,
                                isSponsored: suggestion.isSponsored
                            });
                        }
                    }
                    catch (e) {

                        // Bad rule
                        Hapi.Log.event('err', 'Bad suggestion rule:' + suggestion._id);
                    }
                }
            }
        }

        return callback(null, results);
    });
};


// Get suggestion

exports.get = function (suggestionId, callback) {

    callback(internals.suggestions[suggestionId]);
};


// Remove entire exclude record

exports.delUser = function (userId, callback) {

    Db.remove('user.exclude', userId, callback);
};
