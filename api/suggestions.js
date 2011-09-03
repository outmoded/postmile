/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Db = require('./db');
var Utils = require('./utils');
var Err = require('./error');
var Log = require('./log');
var Rules = require('./rules');
var Project = require('./project');


// Declare internals

var internals = {};


// Suggestions cache

internals.suggestions = {};


// Pre-load all suggestions into cache

exports.initialize = function () {

    Db.all('suggestion', function (results, err) {

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

                    Log.err('Failed to load suggestions: ' + suggestion._id);
                }
            }
            else {

                Log.err('Bad suggestion: missing rule or title');
            }
        }
    });
};


// Remove suggestion from project

exports.exclude = function (req, res, next) {

    Project.load(req.params.id, req.api.userId, false, function (project, member, err) {

        if (project) {

            var suggestion = internals.suggestions[req.params.drop];
            if (suggestion) {

                Db.get('user.exclude', req.api.userId, function (excludes, err) {

                    if (err === null) {

                        if (excludes) {

                            // Existing excludes

                            var changes = { $set: {} };
                            var now = Utils.getTimestamp();

                            if (excludes.projects) {

                                if (excludes.projects[project._id]) {

                                    if (excludes.projects[project._id].suggestions) {

                                        changes.$set['projects.' + project._id + '.suggestions.' + req.params.drop] = now;
                                    }
                                    else {

                                        changes.$set['projects.' + project._id + '.suggestions'] = {};
                                        changes.$set['projects.' + project._id + '.suggestions'][req.params.drop] = now;
                                    }
                                }
                                else {

                                    changes.$set['projects.' + project._id] = { suggestions: {} };
                                    changes.$set['projects.' + project._id].suggestions[req.params.drop] = now;
                                }
                            }
                            else {

                                changes.$set.projects = {};
                                changes.$set.projects[project._id] = { suggestions: {} };
                                changes.$set.projects[project._id].suggestions[req.params.drop] = now;
                            }

                            Db.update('user.exclude', excludes._id, changes, function (err) {

                                if (err === null) {

                                    res.api.result = { status: 'ok' };
                                    next();
                                }
                                else {

                                    res.api.error = err;
                                    next();
                                }
                            });
                        }
                        else {

                            // First exclude

                            excludes = { _id: req.api.userId, projects: {} };
                            excludes.projects[project._id] = { suggestions: {} };
                            excludes.projects[project._id].suggestions[req.params.drop] = Utils.getTimestamp();

                            Db.insert('user.exclude', excludes, function (items, err) {

                                if (err === null) {

                                    res.api.result = { status: 'ok' };
                                    next();
                                }
                                else {

                                    res.api.error = err;
                                    next();
                                }
                            });
                        }
                    }
                    else {

                        res.api.error = err;
                        next();
                    }
                });
            }
            else {

                res.api.error = Err.notFound();
                next();
            }
        }
        else {

            res.api.error = err;
            next();
        }
    });
};


// Analyze project and return suggestions list

exports.list = function (project, userId, callback) {

    Db.get('user.exclude', userId, function (item, err) {

        var results = [];

        if (err === null) {

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

                                results.push({ id: suggestion._id, title: suggestion.title, isSponsored: suggestion.isSponsored });
                            }
                        }
                        catch (e) {

                            // Bad rule

                            Log.err('Bad suggestion rule:' + suggestion._id);
                        }
                    }
                }
            }
        }
        else {

            Log.err(err);
        }

        callback(results);
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
