/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* tips module - take care of everything to do with a project that isn't tasks or suggestions
*
*
*/

YUI.add('postmile-tips', function (Y) {

    var gpostmile = Y.postmile.gpostmile;


    // renderTips

    function renderTips(tips, projectId) {

        if (!tips || (tips._networkRequestStatusCode && tips._networkRequestStatusCode !== 200)) {
            return;
        }

        var project = gpostmile.projects[projectId];

        if (!tips || tips.length <= 0 || !project) {
            return;
        }

        project.tips = tips;
        project.tip = project.tip || 0;

        var target = Y.all('#tiptext');
        var html = tips[project.tip].text;
        target.setContent(html);

    }


    // increment the tip counter and render the next tip

    function nextTip() {

        var project = gpostmile.project;

        project.tip = project.tip + 1 < project.tips.length ? project.tip + 1 : 0;

        renderTips(gpostmile.project.tips, gpostmile.project.id);

    }


    // show the user a context for the tip

    function showTip() {

        var project = gpostmile.project;
        var tip = project.tips[project.tip];

        // until the API returns context - todo: look up tip.context locally to get node and pos
        if (!tip.context || tip.context === 'project.title') {
            tip.context = project.tip === -1 ? '.taskicon' : '.project-title-box';
            tip.pos = project.tip === -1 ? 10 : [-10, -10, 50, 20];
        }

        // if there's a node, point it out, toggle
        if (tip.context) {
            Y.fire('postmile:pointToNode', '#showtip', tip.context, tip.pos, true);
        }

    }


    //

    function bind() {

        // tips panel - next, close, show, etc

        var showTips = Y.one("#showtips");
        var tips = Y.all('#tips');
        var closeTip = Y.one("#closetip");

        var showTipNode = Y.one("#showtip");
        if (showTipNode) {
            showTipNode.on('click', function (e) {
                showTip();
            });
        }

        var nextTipNode = Y.one("#nexttip");
        if (nextTipNode) {
            nextTipNode.on('click', function (e) {
                nextTip();
            });
        }

        if (showTips) {
            showTips.on('click', function (e) {
                tips.setStyle("display", "inline");
                showTips.setStyle("display", "none");
            });
        }

        if (tips && closeTip) {
            closeTip.on('click', function (e) {
                tips.setStyle("display", "none");
                // closeTip.setStyle("display", "inline") ;
                showTips.setStyle("display", "inline");
            });
        }

        // event handlers

        Y.on("postmile:renderTips", function (tips, projectId) {
            renderTips(tips, projectId);
        });

    }


    bind();


    // export it

    Y.namespace('postmile').tips = {
        last: null
    };


}, "1.0.0", { requires: ['node'] });
