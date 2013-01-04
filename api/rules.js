// Load modules

var Hapi = require('hapi');


// Validate and process rule

exports.normalize = function (rule) {

    // Make sure rule has no side-effect, no function call, assignment, etc.

    // {object}.{key}[.{attribute}] {operator} {value} {logical} ...

    // objects: project
    // operators: ===, !==, <, >, <=, >=, contains
    // value: 'string', empty, number
    // logical: &&, ||

    //               1                         2                3                                4
    var ruleRegex = /(^|(?:\|\|)|(?:&&))(?:\s*)(\w[\w.]*)(?:\s*)(==|!=|<|>|<=|>=|contains)(?:\s*)(\w+|'[^']*')(?:\s*)/g;

    var statement = '';
    var replaced = rule.replace(ruleRegex, function ($0, $1, $2, $3, $4) {

        var rule = { logical: ($1 === '' ? '' : ' ' + $1 + ' '), variable: $2, operator: $3, value: $4 };
        if (rule.value === 'empty') {

            switch (rule.operator) {
                case '==': statement += rule.logical + '(' + rule.variable + ' == null || ' + rule.variable + ' === "")'; break;
                case '!=': statement += rule.logical + '(' + rule.variable + ' && ' + rule.variable + ' !== "")'; break;
                default: return '';
            }
        }
        else {
            switch (rule.operator) {
                case 'contains': statement += rule.logical + rule.variable + '.search(/' + rule.value.replace(/^'|'$/g, '') + '/i) >= 0'; break;
                default: statement += rule.logical + rule.variable + ' ' + rule.operator + ' ' + rule.value; break;
            }
        }

        return '';              // Clear matching section
    });

    if (replaced === '') {       // Make sure all sections have been matched and cleared
        return statement;
    }
    else {
        return null;
    }
};

