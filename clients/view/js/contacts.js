/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
* 'postmile-contacts' module
*
* handles three overlays:
*
*	invite - for inviting new participants to project, launched from participants menu
*  manage, aka disinvite - to take action on existing project participants (like removing them)
*	taskParticipants - varying subsets of the project participants for each task
*
*
*/


YUI.add('postmile-contacts', function (Y) {

    // module data
    var gpostmile = Y.postmile.gpostmile;
    var inviteOverlay;
    var taskParticipantsOverlay;


    /**
    * render funcs for various overlays
    *
    */

    // 
    function renderContacts(contacts) {

        if (contacts && (contacts._networkRequestStatusCode && contacts._networkRequestStatusCode === 200)) {

            gpostmile.contacts = contacts;

            var i, l;
            for (/*var*/i = 0, l = gpostmile.contacts.length; i < l; ++i) {
                var contact = gpostmile.contacts[i];
                gpostmile.contacts[contact.id] = contact;
                gpostmile.contacts[contact.id].selected = false;
            }

            renderInvite();
            // renderTaskParticipants() ;

        } else {

            Y.log('renderContacts - no contacts: ' + JSON.stringify(contacts));

        }

    }

    //
    function renderInvite() {

        var pplhtml = Y.postmile.templates.inviteParticipants(gpostmile.contacts);

        // clear selected nodes and data
        var inviteOverlayNode = Y.one("#invite-overlay");
        inviteOverlayNode.all('.participant').removeClass('selected');
        var i, l;
        for (/*var*/i = 0, l = gpostmile.contacts.length; i < l; ++i) {
            var contact = gpostmile.contacts[i];
            gpostmile.contacts[contact.id].selected = false;
        }

        var inviteEmails = Y.one("#invite-emails");
        var inviteMessage = Y.one("#invite-message");
        var inviteLabel = Y.one("#invite-message-label");

        // clear text fields
        inviteEmails.set('value', '');
        inviteMessage.set('value', '');
        inviteLabel.setContent('Tell your friends what this list is about'); // from html markup

        if (gpostmile.contacts.length > 0) {
            Y.all('#invite-overlay .participants-pane').show();
        } else {
            Y.all('#invite-overlay .participants-pane').hide();
        }

        var ppl = Y.all('#invite-overlay .participants-list');
        ppl.setContent(pplhtml);
        inviteOverlay.set('centered', true);
        inviteOverlay.set("y", 45);
    }
    //
    function renderManage() {

        // project participants (not contacts)
        var pplhtml = Y.postmile.templates.manageParticipants(gpostmile.project.participants);

        var dpl = Y.all('#manage-overlay .participants-list');
        dpl.setContent(pplhtml);

        // clear selected nodes and data
        var manageOverlayNode = Y.one("#manage-overlay");
        manageOverlayNode.all('.participant').removeClass('selected');

        if (gpostmile.project && gpostmile.project.participants && gpostmile.project.participants instanceof Array) {
            var c, l;
            for (/*var*/c = 0, l = gpostmile.project.participants.length; c < l; c++) {
                var participant = gpostmile.project.participants[c];
                participant.selected = false;
            }
        }

        if (gpostmile.project && gpostmile.project.participants && gpostmile.project.participants instanceof Array && gpostmile.project.participants.length > 0) {
            Y.all('#manage-overlay .participants-pane').show();
        } else {
            Y.all('#manage-overlay .participants-pane').hide();
        }

        manageOverlay.set('centered', true);
        manageOverlay.set('y', 45);
        manageOverlay.show();
    }


    // 
    function renderTaskParticipants(task) {

        // clear/set project participants (not contacts) for task menu
        if (gpostmile.project && gpostmile.project.participants && gpostmile.project.participants instanceof Array) {
            var c, l;
            for (/*var*/c = 0, l = gpostmile.project.participants.length; c < l; c++) {
                var participant = gpostmile.project.participants[c];
                participant.selected = task.participants.indexOf(participant.id) !== -1;
                gpostmile.project.participants[participant.id] = participant;
            }
        }

        var html = Y.postmile.templates.taskParticipants(gpostmile.project.participants);

        var tpl = Y.one('#task-participant-list');
        tpl.setContent(html);
        taskParticipantsOverlay.set('centered', true);
    }


    /**
    * binds for various overlays
    * event listeners with simple inline/inner func handlers
    *
    */

    function bindInviteOverlay() {
        var inviteOverlayNode = Y.one("#invite-overlay");
        var inviteEmails = Y.one("#invite-emails");
        var inviteMessage = Y.one("#invite-message");
        var inviteButton = Y.one("#invite-invite");
        var cancelButton = Y.one("#invite-cancel");
        var xButton = Y.one("#invite-close");
        var launchInvite = Y.one(".launch-invite");

        inviteOverlayNode.removeClass('postmile-loading');

        function showOverlay() {
            // could clear here
            // overlay.set( 'centered', true ) ;
            renderInvite(); // clears data
            inviteOverlay.show();
        }

        inviteOverlay = new Y.Overlay({
            srcNode: inviteOverlayNode,
            // centered	: true,
            // constrain   : true,
            // render	  : true,
            visible: false,
            plugins: [
			Y.Plugin.OverlayModal,
			Y.Plugin.OverlayKeepaligned,
			{ fn: Y.Plugin.OverlayAutohide, cfg: {
			    focusedOutside: false  // disables the Overlay from auto-hiding on losing focus
			}
			}
		]
        });

        inviteOverlay.render();
        inviteOverlay.hide();

        /* inviteOverlay.on( 'blur', function( e ) { overlay.hide() } ) ;*/

        inviteOverlayNode.delegate('click', function (e) {
            var t = e.currentTarget;
            var id = t.getAttribute('participant');
            if (t.hasClass('selected')) {
                t.removeClass('selected');
            } else {
                t.addClass('selected');
            }
            gpostmile.contacts[id].selected = t.hasClass('selected');

        }, '.participant');

        inviteButton.on('click', function (e) {

            // needs to be URL encoded since it's a query param
            var message = encodeURIComponent(inviteMessage.get('value'));

            var uri = "/project/" + gpostmile.project.id + "/participants?message=" + message;

            var newParticipants = inviteEmails.get('value').replace(/^\s+|\s+$/g, "");
            newParticipants = newParticipants.split(',');
            newParticipants = newParticipants.map(function (s) { return s.replace(/^\s+|\s+$/g, ""); });
            newParticipants = newParticipants.filter(function (s) { return s.indexOf('@') >= 0; });

            var participants = newParticipants;
            var c, l;
            for (/*var*/c = 0, l = gpostmile.contacts.length; c < l; c++) {
                if (gpostmile.contacts[c].selected) {
                    participants.push(gpostmile.contacts[c].id);
                }
            }

            var jp = { "participants": participants };
            var json = JSON.stringify(jp);

            if (participants.length > 0) {

                var confirmInvite = function (response, myarg) { // response has id, rev, status

                    if (response.status === "ok") {

                        // getJson( "/project/" + gpostmile.project.id, Y.postmile.project.renderProjectParticipants ) ;
                        gpostmile.project.participants = response.participants;
                        Y.fire('postmile:renderProjectParticipants', gpostmile.project);

                        /* instead of locally turning participant into contact
                        rely on streaming contact update
                        for (var c=0, l=newParticipants.length; c < l; c++) {
                        var newContact = { }
                        gpostmile.contacts.push( newParticipants[c].id ) ;
                        gpostmile.contacts[ newParticipants[c].id ] = newParticipants[c] ;
                        }
                        */

                        // already s/b hidden: overlay.hide() ;

                        // clear selected nodes and data
                        // this clearing is now redundant as we clear upon launch
                        inviteOverlayNode.all('.participant').removeClass('selected');
                        var i, l;
                        for (/*var*/i = 0, l = gpostmile.contacts.length; i < l; ++i) {
                            var contact = gpostmile.contacts[i];
                            gpostmile.contacts[contact.id].selected = false;
                        }

                        // clear text fields
                        inviteEmails.set('value', '');
                        inviteMessage.set('value', '');

                        Y.fire('postmile:inform', 'Invitation sent', 'You have invited ' + participants.length + ' participants.');

                    } else {

                        Y.fire('postmile:inform', 'Invitation failed', 'Failed to invite new participants.');
                    }
                };
                postJson(uri, json, confirmInvite);
            }

            inviteOverlay.hide(); // don't wait for response 

        });

        cancelButton.on('click', function (e) {
            inviteOverlay.hide();
        });

        xButton.on('click', function (e) {
            inviteOverlay.hide();
        });

        launchInvite.on('click', function (e) {
            var pm = Y.one('#project-participants-menu');
            pm.addClass('menu-hidden');
            showOverlay();
        });

    }


    function bindParticipantsOverlay() {
        var taskParticipantsOverlayNode = Y.one("#task-participants");

        taskParticipantsOverlayNode.removeClass('postmile-loading');

        taskParticipantsOverlay = new Y.Overlay({
            srcNode: taskParticipantsOverlayNode,
            visible: false,
            plugins: [
			Y.Plugin.OverlayModal,
			Y.Plugin.OverlayKeepaligned,
			{ fn: Y.Plugin.OverlayAutohide, cfg: {
			    focusedOutside: false  // disables the Overlay from auto-hiding on losing focus
			}
			}
		]
        });

        taskParticipantsOverlay.render();
        // taskParticipantsOverlay.hide() ;

        taskParticipantsOverlayNode.delegate('click', function (e) {

            var task = gpostmile.task;
            var cb = e.currentTarget;
            var id = cb.getAttribute('participant');
            var checked = cb.get('checked'); // not getAttribute

            gpostmile.project.participants[id].selected = checked;

            var taskIsMe = false;
            var participants = [];
            if (gpostmile.project && gpostmile.project.participants && gpostmile.project.participants instanceof Array) {
                var c, l;
                for (/*var*/c = 0, l = gpostmile.project.participants.length; c < l; c++) {
                    if (gpostmile.project.participants[c].selected) {
                        participants.push(gpostmile.project.participants[c].id);
                    }
                    if (gpostmile.project.participants[c].id === Y.postmile.gpostmile.profile.id) {
                        taskIsMe = gpostmile.project.participants[c].selected;
                    }
                }
            }

            var jp = { "participants": participants };
            var json = JSON.stringify(jp);

            function confirmTaskParticiants(response, myarg) { // response has id, rev, status

                if (response.status === "ok") {

                    task.participants = participants;
                    task.participantsCount = task.participants.length;
                    task.isMe = taskIsMe;
                    var tasks = Y.one('#tasks');
                    var taskNode = tasks.one('.task[task="' + task.id + '"]');
                    var html = Y.postmile.templates.taskListHtml(task, taskNode);
                    taskNode.replace(html);
                    taskNode = tasks.one('.task[task="' + task.id + '"]'); // refresh
                    Y.postmile.tasklist.showUpdatedAgo(taskNode, true);

                } else {

                    cb.set('checked', !checked); // should prob retore old instead of toggle
                    Y.log('error seting task participants ' + JSON.stringify(response));

                }
            }

            postJson("/task/" + task.id, json, confirmTaskParticiants);

            // update the overlay node right away for responsiveness - 
            // if it fails, the underlying task participants node will reflect correct state
            if (participants.length > 1) {
                taskParticipantsOverlayNode.addClass('multiple');
            } else {
                taskParticipantsOverlayNode.removeClass('multiple');
            }

        }, 'input');

        // need this to help dismiss overlay/popup
        taskParticipantsOverlayNode.ancestor().on('blur', function (e) {

            hideTaskParticipants(true);

        });

        taskParticipantsOverlayNode.on('mouseleave', function (e) {
            hideTaskParticipants();
        });
        taskParticipantsOverlayNode.on('mouseenter', function (e) {
            cancelHideTaskParticipants();
        });
        var iconBox = taskParticipantsOverlayNode.one('icon-tab');
        taskParticipantsOverlayNode.on('mouseleave', function (e) {
            hideTaskParticipants();
        });
        taskParticipantsOverlayNode.on('mouseenter', function (e) {
            cancelHideTaskParticipants();
        });
    }


    function bindManageOverlay() {
        var manageOverlayNode = Y.one("#manage-overlay");
        var manageButton = Y.one("#manage-overlay #manage-remove");
        var xButton = Y.one("#manage-overlay #manage-close");
        var cancelButton = Y.one("#manage-overlay #manage-cancel");

        manageOverlayNode.removeClass('postmile-loading');

        manageOverlay = new Y.Overlay({
            srcNode: manageOverlayNode,
            visible: false,
            plugins: [
			Y.Plugin.OverlayModal,
			Y.Plugin.OverlayKeepaligned,
			{ fn: Y.Plugin.OverlayAutohide, cfg: {
			    focusedOutside: false  // disables the Overlay from auto-hiding on losing focus
			}
			}
		]
        });

        manageOverlay.render();
        manageOverlay.hide();


        manageOverlayNode.delegate('click', function (e) {
            var t = e.currentTarget;
            var id = t.getAttribute('pid');
            if (t.hasClass('selected')) {
                t.removeClass('selected');
            } else {
                t.addClass('selected');
            }
            if (id) {
                var participant = gpostmile.project.participants[id];
                if (participant) {
                    gpostmile.project.participants[id].selected = t.hasClass('selected');
                }
            }

        }, '.participant');


        manageButton.on('click', function (e) {

            var participants = [];
            if (gpostmile.project && gpostmile.project.participants && gpostmile.project.participants instanceof Array) {
                var c, l;
                for (/*var*/c = 0, l = gpostmile.project.participants.length; c < l; c++) {
                    var participant = gpostmile.project.participants[c];
                    if (participant.selected) {
                        participants.push(participant.id);
                    }
                }
            }

            var jp = { "participants": participants };
            var json = JSON.stringify(jp);

            if (participants.length > 0) {

                var confirmRemove = function (response, myarg) {

                    if (response.status === "ok") {

                        gpostmile.project.participants = response.participants;
                        Y.fire('postmile:renderProjectParticipants', gpostmile.project);

                    } else {

                        Y.log('error leaving project ' + JSON.stringify(response));
                        Y.fire('postmile:inform', 'Error', 'Failed to remove participants.');

                    }
                };

                var askRemove = function (arg) {
                    var uri = "/project/" + gpostmile.project.id + "/participants";
                    deleteJson(uri, json, confirmRemove);
                };
                askHeader = participants.length > 1 ? 'Remove Participants?' : 'Remove Participant?';
                Y.fire('postmile:confirm', askHeader, 'If you remove a participant with items assigned, a dummy will be created to assume them.', askRemove);

            }

            manageOverlay.hide();

        });


        var messageNode = Y.one("#invite-message");
        var inviteLabel = Y.one("#invite-message-label");
        function messageKey(e) {
            var text = messageNode.get('value');
            inviteLabel.setContent(' ' + (250 - text.length) + ' characters left (no links, please)...');
            if (text.length > 250 - 1) {
                messageNode.set('value', text.substring(0, 250 - 1));
            }
            if (text.indexOf('http://') >= 0) {
                messageNode.set('value', text.replace('http://', '(please, no links)'));
            }
        }
        messageNode.on('keyup', messageKey);

        cancelButton.on('click', function (e) {
            manageOverlay.hide();
        });

        xButton.on('click', function (e) {
            manageOverlay.hide();
        });


        var launchManage = Y.one(".launch-manage");
        launchManage.on('click', function (e) {
            var pm = Y.one('#project-participants-menu');
            pm.addClass('menu-hidden');
            renderManage();
        });

    }


    /**
    * fetch the task participant data, delaying the menu visibility until we have the data
    * note that hover in tasklist currently prefetches this data
    *
    */

    function showTaskParticipants(trigger, task, maxY) {
        gpostmile.task = task;

        if (task.participants) {
            showTaskParticipantsSync(trigger, task, maxY);
        } else {
            var cbo = {
                trigger: trigger,
                task: task,
                maxY: maxY
            };
            getJson("/task/" + task.id, showTaskParticipantsCB, cbo);
        }
    }

    function showTaskParticipantsCB(response, cbo) {

        if (!response || (response._networkRequestStatusCode && response._networkRequestStatusCode !== 200)) {

            var trigger = cbo.trigger;
            var task = cbo.task;
            var maxY = cbo.maxY;

            Y.assert(gpostmile.task === task);

            // todo: other fields? shall we update anything/anywhere else?
            task.participants = response.participants || [];

            showTaskParticipantsSync(trigger, task, maxY);

        } else {

            Y.log('error getting task participants ' + JSON.stringify(response));

        }

    }

    function showTaskParticipantsSync(trigger, task, maxY) {
        var taskId = task.id;

        // needs to be done for each task selection after gpostmile.contacts[c].selected set
        renderTaskParticipants(task);

        // alignment needs to be done after render
        var points = [Y.WidgetPositionAlign.TR, Y.WidgetPositionAlign.BR];
        taskParticipantsOverlay.set('align', { node: trigger, points: points });

        // realignment needs to be done after render and orig alignment
        var taskParticipantsOverlayNode = Y.one("#task-participants");
        var y = taskParticipantsOverlayNode.getY();
        var h = parseInt(taskParticipantsOverlayNode.getComputedStyle('height'), 10);
        var b = y + h;
        if (b > maxY) {
            // var over = ( b - maxY ) ;
            // var newY = ( y - over ) ; 
            // taskParticipantsOverlayNode.setY( newY ) ;
            points = [Y.WidgetPositionAlign.BR, Y.WidgetPositionAlign.TR];
            taskParticipantsOverlayNode.addClass('above');
            taskParticipantsOverlay.set('align', { node: trigger, points: points });
        }
        else {
            taskParticipantsOverlayNode.removeClass('above');
        }
        taskParticipantsOverlay.set('align', { node: trigger, points: points });

        if (task.participantsCount > 1) {
            taskParticipantsOverlayNode.addClass('multiple');
        }
        else {
            taskParticipantsOverlayNode.removeClass('multiple');
        }

        taskParticipantsOverlay.taskId = taskId;

        // finally show it!
        taskParticipantsOverlay.show();
    }


    /**
    * improve usability of the participants menu by tweaking the visibility and timing
    *
    */

    var taskParticipantsOverlayTimer;
    function hideTaskParticipantsNow() {
        // cancelHideTaskParticipants( ) ;
        taskParticipantsOverlay.hide();
        var taskList = Y.one('#tasks');
        var liNodes = taskList.all("li");
        var liNode = taskList.one('li.task[task="' + taskParticipantsOverlay.taskId + '"]');
        liNodes.removeClass("participantsMenu");
        if (!liNode.hasClass("open")) {
            liNode.removeClass("active");
        }
    }

    function cancelHideTaskParticipants() {
        if (taskParticipantsOverlayTimer) {
            clearTimeout(taskParticipantsOverlayTimer);
            taskParticipantsOverlayTimer = null;
        }
    }


    /**
    * external funcs to manage showing of task participants menu from tasklist (person icon)
    *
    */

    function hideTaskParticipants(immediate) {
        cancelHideTaskParticipants();
        if (immediate) {
            // taskParticipantsOverlay.hide() ;
            hideTaskParticipantsNow();
        } else {
            // taskParticipantsOverlayTimer = setTimeout( Y.bind( taskParticipantsOverlay.hide, taskParticipantsOverlay ), 1000 ) ;
            taskParticipantsOverlayTimer = setTimeout(hideTaskParticipantsNow, 300);
        }
    }

    function toggleTaskParticipants(trigger, task, maxY) {
        var v = taskParticipantsOverlay.get('visible');
        if (v) {
            hideTaskParticipants(true);
        } else {
            showTaskParticipants(trigger, task, maxY);
        }
        return !v;
    }

    function isTaskParticipantsOpen(taskId) {
        var v = taskParticipantsOverlay.get('visible');
        return v && taskId === taskParticipantsOverlay.taskId;
    }


    /**
    * bindings
    *
    */

    function bind() {
        bindInviteOverlay();
        bindManageOverlay();
        bindParticipantsOverlay();

        // event handlers
        Y.on("postmile:renderContacts", function (contacts) {
            renderContacts(contacts);
        });

    }

    bind();

    /**
    * external funcs / entry points and data
    *
    */


    Y.namespace('postmile').contacts = {
        // showTaskParticipants: showTaskParticipants,
        toggleTaskParticipants: toggleTaskParticipants,
        hideTaskParticipants: hideTaskParticipants,
        isTaskParticipantsOpen: isTaskParticipantsOpen,
        last: null
    };


}, "1.0.0", { requires: ['node', 'overlay', 'widget-anim', 'gallery-overlay-extras'] });
