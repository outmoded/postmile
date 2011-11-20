/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* postmile-global module
*
*	the root data structure for profile, contacts, all projects, tasks, suggestions, tips, etc.
*
*
*/

YUI.add('postmile-global', function (Y) {

    Y.namespace('postmile');
    Y.namespace('postmile.global');
    Y.postmile.global = {

        profile: {},
        contacts: [],
        projects: [],
        project: null, // no active/selected project
        users: {},
        tips: {},
        tip: -1,
        last: null
    };
    Y.namespace('postmile.gpostmile');
    Y.postmile.gpostmile = Y.postmile.global;

}, "1.0.0", { requires: ['node'] });
