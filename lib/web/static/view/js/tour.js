/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* guided tour module
*
*
*/

YUI.add('postmile-tour', function (Y) {

    // module data

    var guideCurrentStop = 0;
    var isGuideMoving = false;

    var guideContent = [

	    { title: 'Welcome!', text: 'This tool helps you make lists and collaborate with your friends and family. You can use it for planning an event, a project, a shopping list, or any other list you want. This quick tour will introduce you to the tool\'s main features. Let\'s get started!<div class="mini">You can stop the tour at any point and launch it again from the Account menu</div>', style: { top: 32, left: 10, height: 0, width: 0} },
	    { title: 'Current list', text: 'The title of the current list. You can edit the title by clicking on the text. We recommend using descriptive names that will help you and the other participants quickly recognize what this list is about.', style: { top: 32, left: 10, height: 46, width: 410} },
	    { title: 'Projects menu', text: 'The projects menu allows you to switch between your projects, create a new list, or delete the current list.', style: { top: 32, left: 420, height: 46, width: 50} },
	    { title: 'Project details', text: 'If your list is about an event or if it has a location, you can use the date, time, and place options to keep that information. Use these fields as you wish. They are just for keeping track and sharing information with the other participants. These detail are about the entire list, not any individual item.', style: { top: 84, left: 10, height: 22, width: 560} },
	    { title: 'Projects participants', text: 'Lists are more fun with friends. The participants menu allows you to see who is part of this list, invite new participants, or remove participants (if you are the list owner). When you invite new participants, the menu will show you who accepted your invitation.', style: { top: 80, left: 583, height: 30, width: 150} },
	    { title: 'Items list', text: 'This is the heart of your list - the items. Each item has a title, status, details, and participants assignment. To organize the items, simply drag and drop them to the desired position.', style: { top: 106, left: 3, height: -14, width: -270} },
	    { title: 'Status and comments', text: 'On the left side of each item you\'ll find a checkbox indicating the item\'s status and a comments icon. Click on the status checkbox to toggle its state. Click the comments icon to expand the item, read the comments, or add a new comment.', style: { top: 120, left: 30, height: -26, width: 65} },
	    { title: 'Status checkbox', text: 'The checkbox has three states: open, in-progress, and completed. <div class="image checkbox"></div>', style: { top: 120, left: 30, height: -26, width: 65} },
	    { title: 'Comments icon', text: 'Comments have three states: none, old comments you\'ve read, and new comments. <div class="image comments"></div>', style: { top: 120, left: 30, height: -26, width: 65} },
	    { title: 'Assignment and delete', text: 'When the cursor hovers above the right side of each item, an assignment icon and a delete icon appear. Click the assignment icon to open the menu.', style: { top: 120, right: -325, height: -26, width: 85} },
	    { title: 'Item assignment menu', text: 'Use the menu to assign the item to one or more participants. <div class="image assign"></div>', style: { top: 120, right: -325, height: -26, width: 85} },
	    { title: 'Item assignment icon', text: 'Assigned items have a persistent icon, and a \'me\' label if assigned to you. <div class="image assigned"></div>', style: { top: 120, right: -325, height: -26, width: 85} },
	    { title: 'Tips and suggestion', text: 'As you add details and items, the tool will be offering you tips and suggestions. Tips are ways to get more out of the tool, like using the three-state checkboxs. Suggestions are ideas you might want to add to your items, like "Buy cake" if you are planning a party.', style: { top: 106, right: -18, height: -14, width: 245} },
	    { title: 'Account menu', text: 'The account menu let\'s you manage your preferences, change your account information, manage email addresses, link to social networks, and log out.', style: { top: -10, right: -10, height: 40, width: 190} },
	    { title: 'Got feedback?', text: 'You\'ve reached the end of the tour. We hope you\'ll find it useful and fun. If you have questions or suggestions, please use the feedback link to let us know. You can launch this tour again from the Account menu.', style: { top: -35, right: -10, height: 16, width: 110} }
    ];

    // module functions

    function guidedTourStop(increment) {

        if (isGuideMoving) {

            return;
        }

        isGuideMoving = true;
        var tourAlignment = Y.one('#tour-guide-alignment');
        var tourNarative = Y.one('#tour-narative');
        var tourGuide = Y.one('#tour-guide');
        var tourPrev = tourNarative.one('#tour-prev');
        var tourNext = tourNarative.one('#tour-next');
        var tourClose = tourNarative.one('#tour-close');
        var tourEnd = tourNarative.one('#tour-end');

        tourAlignment.removeClass('hide');

        var prevStop = guideCurrentStop;
        if (increment) {
            guideCurrentStop += increment;
        }
        else {
            guideCurrentStop = 0;
        }

        if (guideCurrentStop < 0) {
            guideCurrentStop = 0;
        }
        if (guideCurrentStop >= guideContent.length) {
            guideCurrentStop = guideContent.length - 1;
        }

        if (guideCurrentStop === 0) {
            tourPrev.addClass('hide');
            tourNext.removeClass('hide');
            tourEnd.addClass('hide');
        }
        else if (guideCurrentStop === guideContent.length - 1) {
            tourPrev.removeClass('hide');
            tourNext.addClass('hide');
            tourEnd.removeClass('hide');
        }
        else {
            tourPrev.removeClass('hide');
            tourNext.removeClass('hide');
            tourEnd.addClass('hide');
        }

        var style = JSON.parse(JSON.stringify(guideContent[guideCurrentStop].style)); // Clone hack
        if (style.width < 0) {
            // Calculate width using value as offset from right
            style.width = parseInt(tourAlignment.getStyle('width'), 10) + style.width - style.left;
            tourGuide.addClass('stickyW');
        }
        else {
            tourGuide.removeClass('stickyW');
        }

        if (style.height < 0) {
            // Calculate height using value as offset from bottom
            style.height = parseInt(tourAlignment.getStyle('height'), 10) + style.height - style.top;
            tourGuide.addClass('stickyH');
        }
        else {
            tourGuide.removeClass('stickyH');
        }

        if (prevStop && guideContent[prevStop].style.hasOwnProperty('right')) {
            tourGuide.setStyles({ left: parseInt(tourAlignment.getStyle('width'), 10) + guideContent[prevStop].style.right - guideContent[prevStop].style.width, 'float': null, 'margin-right': null });
        }

        var anim = new Y.Anim({
            node: tourGuide,
            duration: 0.5
        });

        var rightStyle;
        if (style.hasOwnProperty('right')) {
            rightStyle = { left: null, 'float': 'right', 'margin-right': -(style.right) + 'px' };
            style.left = parseInt(tourAlignment.getStyle('width'), 10) + style.right - style.width;
        }

        anim.set('to', style);
        anim.run();
        anim.on('end', function () {

            if (rightStyle) {
                tourGuide.setStyles(rightStyle);
            }

            isGuideMoving = false;
        });

        if (guideCurrentStop) {
            tourGuide.removeClass('hide');
        }
        else {
            tourGuide.addClass('hide');
        }

        tourNarative.one('.title').setContent(guideContent[guideCurrentStop].title);
        tourNarative.one('.text').setContent(guideContent[guideCurrentStop].text);
        tourNarative.one('.counter').setContent((guideCurrentStop + 1) + '/' + guideContent.length);
    }


    // bind to UI

    function bind() {

        var tour = Y.one('#tour-guide-alignment');
        var tourNarative = Y.one('#tour-narative');
        var tourPrev = tourNarative.one('#tour-prev');
        var tourNext = tourNarative.one('#tour-next');
        var tourClose = tourNarative.one('#tour-close');
        var tourEnd = tourNarative.one('#tour-end');

        function guideClose() {
            tour.addClass('hide');
        }

        function guidePrev(e2) {
            guidedTourStop(-1);
        }

        function guideNext(e2) {
            guidedTourStop(1);
        }

        tourPrev.on('click', guidePrev);
        tourNext.on('click', guideNext);
        tourClose.on('click', guideClose);
        tourEnd.on('click', guideClose);

        Y.on("postmile:launchTour", function () {
            guidedTourStop(0);
        });

    }


    // initialize module

    bind();

    // export module interface

    Y.namespace('postmile').tour = {	// export it
};


// dependencies

}, "1.0.0", { requires: ['anim', 'node'] });
