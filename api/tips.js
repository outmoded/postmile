// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var Rules = require('./rules');

// Declare internals

var internals = {};


// Tips cache

internals.tips = {};


// Pre-load all tips into cache

exports.initialize = function () {

    Db.all('tip', function (err, results) {

        for (var i = 0, il = results.length; i < il; ++i) {
            var tip = results[i];
            if (tip.rule &&
                tip.text) {

                var statement = Rules.normalize(tip.rule);
                if (statement) {
                    tip.statement = statement;
                    internals.tips[tip._id] = tip;
                }
                else {
                    Hapi.Log.event('err', 'Failed to load tips: ' + tip._id);
                }
            }
            else {
                Hapi.Log.event('err', 'Bad tip: missing rule or text');
            }
        }
    });
};


// Analyze project and return tips list

exports.list = function (project, callback) {

    var results = [];

    for (var i in internals.tips) {
        if (internals.tips.hasOwnProperty(i)) {
            var tip = internals.tips[i];

            try {
                if (eval(tip.statement)) {
                    results.push({ id: tip._id, text: tip.text, context: tip.context });
                }
            }
            catch (e) {
                Hapi.Log.event('err', 'Bad tip rule:' + tip._id);
            }
        }
    }

    return callback(results);
};

