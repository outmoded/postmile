/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
* runtime html / markup
*
*/

YUI.add('postmile-templates', function (Y) {


    /**
    * local data
    *
    */

    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var units = { minute: 60000, hour: 3600000, day: 86400000 };


    /**
    * html / markup strings
    *
    */

    var taskEditedByTemplate = ' '
		+ '<div class="edited-by {showEditedBy}">'
			+ 'Edited by <em>{editedBy}</em>, {editedTime}'
		+ '</div>'
	;

    var taskDetailsTemplate = ' '
		+ '<div class="message {odd}">'
			+ '<p class="details-meta">'
				+ '<em>{user}</em>'
				+ ', '
				+ '{dateAndTime}'
				+ ':'
			+ '</p>'
			+ '<p class="details-content">'
			+ '{content}'
			+ '</p>'
		+ '</div>'
	;

    var rawTaskTemplate = ' '

		+ '<span class="tab"></span>'
		+ '<span class="check-boxes check {boxChecked}">{boxChecked}</span>'
		+ '<span class="notes taskicon {noteClass}"></span>'

		+ '<span class="titlearea">'
    /* + '<span class="titletext tasktitle yui3-hastooltip">{escapedTitle}</span>' */
			+ '<textarea class="titletext tasktitle yui3-hastooltip" wrap=off rows=1>{escapedTitle}</textarea>'
			+ '<span class="ellipses">...</span>'
			+ '<span class="updatedAgo">{updatedAgo}</span>'
			+ '<textarea class="measureText" wrap=off rows=1>{escapedTitle}</textarea>'
    // + '<input class="measureSpan">{escapedTitle}</input>'
		+ '</span>'

		+ '<span class="iconsright">'
			+ '<span class="iamaparticipant"></span>'
			+ '<span class="participants"></span>'
			+ '<span class="deleteTask"></span>'
		+ '</span>'

		+ '<div class="taskdetails">'
			+ '<div>'
				+ taskEditedByTemplate
			+ '</div>'
			+ '<div class="messages">'
				+ '{detailsHtml}'	// could be multilpe details
			+ '</div>'
			+ '<textarea class="taskdetails" placeholder="Type in detail here"></textarea>'
			+ '<a class="addTaskDetail">Add</a>'
			+ '<div class="clear: both;"></div>'
		+ '</div>'

		+ '<div class="bottom-links">'
			+ '<a class="collapseDetails" >Close Details</a>'
			+ '<a class="deleteTask">Delete Item</a>'
		+ '</div>'

		+ '<div class="clearfix"></div>'
	;

    var listTaskTemplate = ' '
		+ '<li class="task {liChecked} {noteClass} {showDetails} {participantsExtent} {me} {extraClasses}" task={id} {extraAttrs}>'
		+ rawTaskTemplate
		+ '{extraContent}'
		+ '</li>'
	;

    var rawAddTaskTemplate = ' '
		+ '<textarea class="titletext tasktitle addnewitem">Click to add a new item</textarea>'
		+ '<div class="clearfix"></div>'
	;

    var listAddTaskTemplate = ' '
		+ '<li class="addnewtask">'
			+ rawAddTaskTemplate
		+ '</li>'
	;

    var suggestionTemplate = ' '
		+ '<li suggestion="{id}" class="suggestion">'
			+ '<a class="add">'
				+ '<span class="arrow"></span>'
				+ '<span class="clickableArrow"></span>'
				+ '{title}'
			+ '</a>'
			+ '<a class="removeSuggestion">x</a>'
		+ '</li>'
	;


    /**
    * local helper functinos
    *
    */

    // find a better way
    function htmlEncode(s) {
        s = s.replace(/</g, '&lt;');
        s = s.replace(/>/g, '&gt;');
        return s;
    }

    function modifiedString(timestamp) {
        var modified = new Date(timestamp);
        var now = new Date();
        var elapsedMSec = now - modified;

        if (elapsedMSec >= 3 * units.day || elapsedMSec < 0) {
            // 3 days or more, or bad clock sync
            return 'on ' + months[modified.getMonth()] + ' ' + modified.getDate();
        }
        else if (elapsedMSec >= units.day) {
            // 1-2 days
            var days = Math.round(elapsedMSec / units.day);
            return (days === 1 ? 'yesterday' : days.toString() + ' days ago');
        }
        else if (elapsedMSec >= units.hour) {
            // 1-23 hours
            var hours = Math.round(elapsedMSec / units.hour);
            return (hours === 1 ? 'an hour ago' : hours.toString() + ' hours ago');
        }
        else if (elapsedMSec >= units.minute) {
            // 1-59 minutes
            var minutes = Math.round(elapsedMSec / units.minute);
            return (minutes === 1 ? 'a minute ago' : minutes.toString() + ' minutes ago');
        }
        else {
            // Less than a minute
            return 'just now';
        }
    }

    function taskHtml(template, task, extraClasses, extraAttrs, extraContent) {

        task.escapedTitle = htmlEncode(task.title);

        task.extraClasses = extraClasses || "";
        task.extraAttrs = extraAttrs || "";
        task.extraContent = extraContent || "";

        switch (task.status) {
            case 'close':
                task.boxChecked = 'completed';
                task.liChecked = 'completed';
                break;
            case 'pending':
                task.boxChecked = 'in-progress';
                task.liChecked = '';
                break;
            case 'open':
                task.boxChecked = 'default';
                task.liChecked = '';
                break;
            default:
                task.boxChecked = 'default';
                task.liChecked = '';
                break;
        }

        task.noteClass = task.detailsModified ? (task.last >= task.detailsModified ? "noteContent" : "noteNew") : "noteEmpty";

        switch (task.participantsCount) {
            case 0:
                task.participantsExtent = 'none';
                break;
            case 1:
                task.participantsExtent = 'single';
                break;
            default:
                task.participantsExtent = 'multiple';
                break;
        }

        task.me = task.isMe ? "me" : "not-me";

        // task.updatedAgo = ( task.detailsModified && ( task.detailsModified > task.last ) ) ? modifiedString(task.detailsModified) : '';
        // task.updatedAgo = ( task.detailsModified && !( task.detailsModified <= task.last ) ) ? modifiedString(task.detailsModified) : '';
        task.updatedAgo = (task.detailsModified && (!task.last || task.detailsModified > task.last)) ? modifiedString(task.detailsModified) : '';

        task.editedByHtml = taskEditedByHtml(task);

        task.detailsHtml = taskDetailsHtml(task);

        var html = Y.substitute(template, task);

        return html;
    }


    /**
    * public functions for returning html / markup
    *
    */

    function projectTitle(title) {
        return htmlEncode(title);
    }

    function taskEditedByHtml(task) {
        task.showEditedBy = (task.detailsModifiedBy) ? '' : 'remove';
        task.editedBy = (task.detailsModifiedBy) ? task.detailsModifiedBy.display.split(" ")[0] : '';
        task.editedTime = (task.detailsModified) ? modifiedString(task.detailsModified) : '';
        task.editedByHtml = Y.substitute(taskEditedByTemplate, task);
        return task.editedByHtml;
    }

    function taskDetailsHtml(task) {

        var i, l;
        var detailsHtml = '';

        if (task.details && task.details.thread) {

            var details = [];

            for (i = 0, l = task.details.thread.length; i < l; ++i) {
                if (i > 0 &&
					task.details.thread[i].user.id === task.details.thread[i - 1].user.id &&
					(task.details.thread[i].created - task.details.thread[i - 1].created) <= (10 * units.minute)) {

                    details[details.length - 1].content += '<span class="break"></span>' + htmlEncode(task.details.thread[i].content);
                }
                else {
                    details.push({
                        user: (task.details.thread[i].user && task.details.thread[i].user.display) ? task.details.thread[i].user.display.split(" ")[0] : 'Someone',
                        created: modifiedString(task.details.thread[i].created),
                        content: htmlEncode(task.details.thread[i].content)
                    });
                }
            }

            for (i = 0, l = details.length; i < l; ++i) {
                task.user = details[i].user;
                task.dateAndTime = details[i].created;
                task.content = details[i].content;
                task.odd = (i % 2 === 0 ? 'even' : 'odd'); /* todo: use css's even/odd child psuedo-class */
                detailsHtml += Y.substitute(taskDetailsTemplate, task);
            }
        }

        return detailsHtml;
    }

    function inviteParticipants(participants) {
        var pplhtml = "<li>";
        var c, l;
        for (c = 0, l = participants.length; c < l; c++) {
            if (c % 3 === 0) {
                pplhtml += '<ul class="participants-row"><li>';
            }
            pplhtml += '<span class="participant" participant="'
					+ participants[c].id
					+ '"><span class="person"></span>'
					+ participants[c].display
					+ '</span>';
            if (c % 3 === 2 || c === l - 1) {
                pplhtml += '</li></ul>';
            }
        }
        pplhtml += "</li>";
        return pplhtml;
    }


    function manageParticipants(participants) {
        var pplhtml = "<li>";
        var c, i, l;
        if (participants && participants instanceof Array) {
            for (c = 0, i = 0, l = participants.length; i < l; i++) {
                var participant = participants[i];
                if (participant.id !== Y.postmile.gpostmile.profile.id) {	// can't disinvite self
                    if (c % 3 === 0) {
                        pplhtml += '<ul class="participants-row"><li>';
                    }
                    pplhtml += '<span class="participant" pid="'
							+ participant.id
							+ '"><span class="person"></span>'
							+ participant.display
							+ '</span>';
                    if (c % 3 === 2 || c === l - 1) {
                        pplhtml += '</li></ul>';
                    }
                    c++;
                }
            }
        }
        pplhtml += "</li>";
        return pplhtml;
    }

    function taskParticipants(participants) {
        var html = ""; // ul
        var c, l;
        if (participants && participants instanceof Array) {
            for (c = 0, l = participants.length; c < l; c++) {
                html += '<li>'
					+ '<input type="checkbox" participant="'
					+ participants[c].id
					+ '" id="tp'
					+ participants[c].id
					+ '"'
					+ (participants[c].selected ? 'checked' : '')
					+ '>'
					+ '<label for="tp'
					+ participants[c].id
					+ '">'
					+ participants[c].display
					+ '</label>'
					+ '</li>'
					;
            }
        }
        html += "";
        return html;
    }

    function participantMenuItem(participant) {

        var classes = participant.isPending ? ' diminishedtextitem ' : '';
        classes += participant.isPID ? ' disabledtextitem ' : '';
        var display = participant.display;

        display += participant.isPending ? ' (pending) ' : '';
        display += participant.isPid ? ' (dummy) ' : '';
        display = '<em>' + display + '</em>';
        // html += '<li class="menuitem"><a class="menuitem-content participant ' + classes + '" pid="' + participant.id + '">' + display + '</a></li>';
        var html = '<li><a class="menuitem-content participant ' + classes + '" pid="' + participant.id + '">' + display + '</a></li>';

        return html;

    }

    function projectMenuItem(project, mostRecentProject) {

        var selectedClass = ''; // done in renderProject ( project === mostRecentProject ) ? 'postmile-loading' : '' ;
        selectedClass += (project.isPending) ? 'diminishedtextitem' : '';

        var projectTitle = project.title;
        projectTitle += project.isPending ? ' (pending) ' : '';
        // projectTitle += project.isPid ? ' (dummy) ' : '' ;

        var html = '<li class="menuitem project" project="' + project.id + '"><a class="menuitem-content ' + selectedClass + '"> ' + projectTitle + '</a></li>';

        return html;
    }

    function settingsMenuItem(setting) {

        var selectedClass = (setting.value) ? 'enabled' : '';
        var html = '<li class="menuitem setting" setting="' + setting.id + '"><a class="menuitem-content ' + selectedClass + '">- ' + setting.title + '</a></li>';

        return html;
    }


    function taskInnerHtml(task) {

        // return taskNode( task ).get( 'innerHTML' ) ;
        return taskHtml(rawTaskTemplate, task);

    }

    function taskListHtml(task, oldTaskNode, extraClasses, extraAttrs, extraContent) {	// awkaward args - perhaps s/b two diff func
        var oldTaskDetailsNode;
        // if( oldTaskNode ) {
        // oldTaskDetailsNode = oldTaskNode.one( '.taskdetails' ) ;
        // }
        // var showDetails = oldTaskDetailsNode && oldTaskDetailsNode.hasClass( 'open' ) ;
        var showDetails = oldTaskNode && oldTaskNode.hasClass('open');
        task.showDetails = showDetails ? 'open' : '';
        // task.liClasses = showDetails ? 'open' : '' ;

        extraClasses = extraClasses || '';
        extraAttrs = extraAttrs || '';
        extraContent = extraContent || '';

        extraClasses += oldTaskNode && oldTaskNode.hasClass('active') ? 'active' : '';
        extraAttrs += '';
        extraContent += '';

        // var html = taskNode( task, extraClasses, extraAttrs, extraContent).get( 'outerHTML' ) ;
        var html = taskHtml(listTaskTemplate, task, extraClasses, extraAttrs, extraContent);

        return html;
    }

    function suggestionListHtml(suggestion) {
        return Y.substitute(suggestionTemplate, suggestion);
    }

    Y.namespace("project.templates");
    Y.postmile.templates = {	// export it
        listAddTaskTemplate: listAddTaskTemplate,
        taskListHtml: taskListHtml,
        suggestionListHtml: suggestionListHtml,
        taskInnerHtml: taskInnerHtml,
        taskDetailsHtml: taskDetailsHtml,
        taskEditedByHtml: taskEditedByHtml,
        inviteParticipants: inviteParticipants,
        manageParticipants: manageParticipants,
        taskParticipants: taskParticipants,
        participantMenuItem: participantMenuItem,
        projectMenuItem: projectMenuItem,
        settingsMenuItem: settingsMenuItem,
        projectTitle: projectTitle,
        last: null

    };

}, "1.0.0", { requires: ['node', 'substitute'] });
