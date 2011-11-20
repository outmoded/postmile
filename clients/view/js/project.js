/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* project module - take care of everything to do with a project that isn't tasks or suggestions
*
*
*/

YUI.add('postmile-project', function (Y) {

    var gpostmile = Y.postmile.gpostmile;
    // now in Y.postmile.project var calendar ;
    var projectInputTitleOverlay;


    // renderProject will also fetch more data (including details and tasks) as needed
    // if details get more complicated, then factor them out instead of reusing renderProject

    function renderProject(project, force) {

        if (!project || (project._networkRequestStatusCode && project._networkRequestStatusCode !== 200) || !project.id && !force) {
            Y.log('renderProject - no data: ' + JSON.stringify(project));
            return; // todo: revisit why this is necessary
        }

        Y.assert(project);

        gpostmile.project = project; // set active project

        var prevProject = gpostmile.projects[project.id];

        if (!prevProject) {
            prevProject = project; // blank/new project
        }

        if (prevProject) {

            // replace wholeasle in dict (by key), and in array by index
            // to flush/fill-out what was already prime
            gpostmile.projects[prevProject.id] = project;
            gpostmile.projects[prevProject.index] = project;

            // prepoluate with previous project data (same id), 
            // paying attention to pending requests, 
            // to avoid rerequests
            project.index = project.index || prevProject.index;
            project.requestedDetails = prevProject.requestedDetails;
            project.requestedTasks = prevProject.requestedTasks;
            project.requestedTips = prevProject.requestedTips;
            project.requestedSuggestions = prevProject.requestedSuggestions;
            project.tasks = project.tasks || prevProject.tasks;
            project.tips = project.tips || prevProject.tips;
            project.suggestions = project.suggestions || prevProject.suggestions;
            project.place = project.place || prevProject.place;
            project.date = project.date || prevProject.date;
            project.time = project.time || prevProject.time;
            project.participants = project.participants || prevProject.participants;
            project.subscribed = prevProject.subscribed;
        }


        renderProjectDetails(project);

        renderProjectParticipants(project);


        // if needed, get project tasks, then render tasks (even if empty)
        // note that we pass project.id as the project object may be/become defunct by the time the request returns 
        // (from getting more project data/detaisl)

        // done in prevProject project.tasks = Y.postmile.initialTasks ;
        if (project.id === Y.postmile.initialProjectId) {

            // once we've rendered project, dump the initial cache, get tips, sugs, etc
            Y.postmile.initialTasks = Y.postmile.initialProjectId = null;

        } else {

            // do not refretch/rerender details we aleady have  

            renderProjectTasks(project);

            renderProjectTips(project);

            renderProjectSuggestions(project);

            // set active project
            if (project.id) {
                // jslint is concerned function confirmSavedActiveProject(response, myarg) {
                var confirmSavedActiveProject = function (response, myarg) {
                    if (!response || (response.status !== 'ok')) {
                        Y.log('error storing active project from renderProject ' + JSON.stringify(response));
                    }
                };
                var json = '{"value":"' + project.id + '"}';
                postJson('/storage/activeProject', json, confirmSavedActiveProject);
            }

        }


        // show detail area now that it's valid
        // var projectdetails = Y.one("#project-details");
        // projectdetails.removeClass("postmile-loading");
        var projectdetailsbar = Y.one("#project-details-bar");
        projectdetailsbar.removeClass("hidden");

        // show participants menu now that it's valid
        var participantsmenu = Y.one("#project-participants");
        participantsmenu.removeClass("postmile-loading");
        setTimeout(function () { participantsmenu.one('#project-participants-menu').removeClass("postmile-loading"); }, 1000);

        // show projects menu area - even though the underlying project list may not yet be populated,
        // it's worth showing just for the current project title
        // todo: do not let the underlying menu be clickable until the project list is populated / valid
        var projectsmenu = Y.one("#projects-list");
        // todo: figure out why immediate removal of class doesn't work var projectoptions = Y.one( "#projects-menu" ) ;
        setTimeout(function () { projectsmenu.removeClass("postmile-loading"); }, 0);
        setTimeout(function () { projectsmenu.one('#projects-menu').removeClass("postmile-loading"); }, 1000);
        // setTimeout( function() { projectsmenu.one('#projects').removeClass("postmile-loading"); }, 1000 ) ;

        // conditional display of menu item
        var joinProject = Y.one("#join-project");
        if (project.isPending) {
            joinProject.removeClass('postmile-loading');
        } else {
            joinProject.addClass('postmile-loading');
        }

        // if pending, be proactive upon rendering and ask user to join project
        if (project.isPending) {
            Y.fire('postmile:askJoinCurrentProject', true);
        }

        // uncover any loading blockers
        Y.fire('postmile:checkUncover');

        // start getting updates on project (this automatically unsubscribes from other projects)
        if (Y.postmile.stream) {
            Y.fire('postmile:subscribeProject', project);
        }

        // document.location.href = document.location.href.split('#')[0] + '#project=' + project.id;
        if (Y.postmile.history) {
            Y.postmile.history.hash.replace({ project: project.id });
        }

    }


    // render project details such as title, date, time, place

    function renderProjectDetails(project) {

        // project name/title
        var html = Y.postmile.templates.projectTitle(project.title);
        var projectInputTitle = Y.one('#project-title-input');
        projectInputTitle.set('value', html);
        var projectTitle = Y.one('#project-title');
        projectTitle.setContent(html); // no em's as it's not that kind of menu

        // details including date, time, and place
        var placeN = Y.one('#project-details .place');
        var dateN = Y.one('#project-details .date');
        var timeN = Y.one('#project-details .time');
        var placeT = "";
        var timeT = "";
        var dateAndTimeT = "";

        // if needed, get project details (place, date, time) (psuedo-recurse)
        // otherwise render already present details
        if (!project.requestedDetails && project.id !== "") {
            project.requestedDetails = true; // just to say we've tried
            getJson("/project/" + project.id, renderProject);
        } else {
            // they may be blank on purpose rather than an initial conditoon
            placeT = project.place || "";
            dateAndTimeT = displayStringFromDate(project.date);
            timeT = displayStringFromTime(project.time);
        }

        if (placeN) {
            placeN.set('value', placeT);
        }
        if (dateN) {
            dateN.set('value', dateAndTimeT);
        }
        if (timeN) {
            timeN.set('value', timeT);
        }

    }


    // render project participants menu

    function renderProjectParticipants(project) {

        if (!gpostmile.project.participants || !(gpostmile.project.participants instanceof Array)) {
            gpostmile.project.participants = [];
        }

        var html = "";
        if (project.participants && project.participants.length > 0) {

            var pm = Y.one('#project-participants');
            var sm = Y.one('#projects-menu');
            var deleteProjectMenuItem = Y.one("#projects-list #delete-project");
            if (project.participants[0].id === Y.postmile.gpostmile.profile.id) {
                deleteProjectMenuItem.removeClass('postmile-loading');
                if (project.participants.length > 1) {
                    pm.one('.launch-manage-menu-item').removeClass('postmile-loading');
                } else {
                    pm.one('.launch-manage-menu-item').addClass('postmile-loading');
                }
                sm.one('.leave-project-menu-item').addClass('postmile-loading');
            } else {
                deleteProjectMenuItem.addClass('postmile-loading');
                sm.one('.leave-project-menu-item').removeClass('postmile-loading');
                pm.one('.launch-manage-menu-item').addClass('postmile-loading');
            }

            var i, l; // at least try to keep jslint from being so unhappy
            for ( /* var */i = 0, l = project.participants.length; i < l; ++i) {
                var participant = project.participants[i];
                project.participants[participant.id] = participant;
                html += Y.postmile.templates.participantMenuItem(participant);
            }

            var participantsCount = Y.one('#participants-count');
            participantsCount.setContent(project.participants.length);
            if (project.participants.length > 1) {
                pm.addClass('multi-participants');
            }
            else {
                pm.removeClass('multi-participants');
            }
            if (project.participants.length > 9) {
                participantsCount.addClass('two-digits');
            }
            else {
                participantsCount.removeClass('two-digits');
            }
        }
        var participants = Y.all('#participants');
        participants.setContent(html);

    }


    // render project tasks

    function renderProjectTasks(project) {
        // tasks
        if (!project.requestedTasks && project.id && project.id !== "") {
            project.requestedTasks = true; // just to say we tried
            getJson("/project/" + project.id + "/tasks", function (tasks, projectId) { Y.fire('postmile:renderTasks', tasks, projectId); }, project.id);
        } else {
            // clear even if not tasks
            Y.fire('postmile:renderTasks', project.tasks, project.id);
        }
    }


    // render project tips

    function renderProjectTips(project) {
        // tips (start here w tips, using events instead of calls)
        if (!project.requestedTips && project.id && project.id !== "") {
            project.requestedTips = true; // just to say we tried
            getJson("/project/" + project.id + "/tips", function (tips, projectId) { Y.fire('postmile:renderTips', tips, projectId); }, project.id);
        } else {
            // clear even if no tips
            Y.fire('postmile:renderTips', project.tips, project.id);
        }
    }


    // render project suggestions

    function renderProjectSuggestions(project) {
        // and suggestions
        if (!project.requestedSuggestions && project.id && project.id !== "") {
            project.requestedSuggestions = true; // just to say we tried
            getJson("/project/" + project.id + "/suggestions", function (suggestions, projectId) { Y.fire('postmile:renderSuggestions', suggestions, projectId); }, project.id);
        } else {
            // clear even if no suggestions
            Y.fire('postmile:renderSuggestions', project.suggestions, project.id);
        }
    }


    // common date & time utils

    function isValidDate(d) {
        if (Object.prototype.toString.call(d) !== "[object Date]") {
            return false;
        }
        return !isNaN(d.getTime());
    }

    function jsonStringFromDate(d) {
        var j;
        if (isValidDate(d)) {
            j = d.getFullYear() + "-" + ((d.getMonth() + 1) >= 10 ? (d.getMonth() + 1) : ("0" + (d.getMonth() + 1))) + "-" + ((d.getDate() >= 10) ? (d.getDate()) : ("0" + (d.getDate())));
        }
        return j;
    }

    function displayStringFromDate(ds) {
        var d = new Date(ds);
        var s;
        if (isValidDate(d)) {
            s = (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear();
        } else {
            s = "";
        }
        return s;
    }

    function jsonStringFromTime(time) {
        var d = new Date("1/1/1970 " + time.replace(/am/, " am").replace(/pm/, " pm"));
        var j;
        if (time && isValidDate(d)) {
            j = d.toString().replace(/Thu Jan 01 1970 /, "").replace(/ GMT.*/, "");
        }
        return j;
    }

    function displayStringFromTime(ts) {
        if (!ts) {
            return "";
        }
        var d = new Date("1/1/1970 " + ts.replace(/am/, " am").replace(/pm/, " pm"));
        var ta = [];
        var dts = ""; // = time && time.length >= 3 ? time[0] + ":" + time[1] : "" ;
        if (isValidDate(d)) {
            ta[0] = d.getHours();
            ta[1] = d.getMinutes();
            ta[2] = d.getSeconds();
        }
        if (isValidDate(d)) {
            var t1 = ta[1] > 9 ? " " + ta[1] : "0" + ta[1]; // space keeps jslint less unhappy
            if (ta[0] === 0) {
                dts = ta[0] + 12 + ":" + t1 + " am";
            } else if (ta[0] === 12) {
                dts = ta[0] + ":" + t1 + " pm";
            } else if (ta[0] > 12) {
                dts = ta[0] - 12 + ":" + t1 + " pm";
            } else {
                dts = ta[0] + ":" + t1 + " am";
            }
        }
        return dts;
    }

    function setDate(d) {

        var project = gpostmile.project;
        var dateN = Y.one('#project-details .date');

        var j;
        if (d === '') {
            j = d;
        } else if (typeof d === 'string') {
            j = jsonStringFromDate(new Date(d));
        } else {
            j = jsonStringFromDate(d);
        }

        if (j === project.date) {
            // no op

        } else if (j && !isValidDate(d) && j !== '') {	// empty ok

            dateN.set('value', displayStringFromDate(project.date));

        } else {

            // valid and different date
            var confirmDateAndTime = function (response, myarg) {

                if (response.status === "ok") {

                    // commit to data (UI already changed)
                    project.date = j || "";

                } else {

                    // restore date and time UI
                    var dateN = Y.one('#project-details .date');
                    var ods = displayStringFromDate(project.date);
                    dateN.set('value', ods);

                    Y.log('error setting date / time ' + JSON.stringify(response));

                }
            };

            var jsonStruct = { date: j };
            var jsonString = JSON.stringify(jsonStruct);
            postJson("/project/" + project.id, jsonString, confirmDateAndTime);
        }

        var ds = displayStringFromDate(d);
        dateN.set('value', ds);
    }


    // prompt the user about joining the project, 
    // and retry any request that failed perms and caused the prompt

    function askJoinCurrentProject(ask, retryCallback) {

        function joinCurrentProject() {

            function confirmJoinProject(response, myarg) { // response has id, rev, status

                if (response.status === "ok") {

                    delete Y.postmile.gpostmile.project.isPending; // = false ;
                    delete Y.postmile.gpostmile.project.participants[Y.postmile.gpostmile.profile.id].isPending;

                    // rerender all projects to ensure the projects menu looks correct wrt pending etc
                    // and rerender active project to correct join menu option
                    Y.fire('postmile:renderProjects', Y.postmile.gpostmile.projects, true);

                    Y.fire('postmile:statusMessage', 'Joined project');

                    if (retryCallback) {
                        retryCallback();
                    }

                } else {

                    // orig call err hndlr should fix this window.location.reload(); 

                    Y.fire('postmile:errorMessage', 'Error joining project ' + JSON.stringify(response));

                }

            }

            postJson("/project/" + Y.postmile.gpostmile.project.id + '/join', null, confirmJoinProject);

        }

        function revertProject() {
            // orig call err hndlr should fix this window.location.reload(); 
        }

        if (!ask) {
            joinCurrentProject();
        } else {
            Y.fire('postmile:confirm', 'Join this list?', 'Joining allows you to make changes. You can always leave later.', joinCurrentProject, null, revertProject, null);
        }

    }


    // bind UI - including details (date, time, place), tips, menu, events

    function bind() {

        // project title

        var projectInputTitleNode = Y.one("#project-title-input-overlay");
        var projectTitle = Y.one('#project-title');
        var projectInputTitle = Y.one("#project-title-input");

        // create overlay to lay over project title to accept input for [re]naming
        projectInputTitleOverlay = new Y.Overlay({
            srcNode: projectInputTitleNode,
            zIndex: 100,
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
        projectInputTitleOverlay.render();

        // when project title is clicked, overlay the temporary input field for user input to name/rename
        projectTitle.on('click', function () {

            var w = projectTitle.getComputedStyle('width');
            w = parseInt(w, 10) - 10;
            w = w + 'px'; // presume w was in pixels
            projectInputTitle.setStyle('width', w);

            projectInputTitleOverlay.set('align', {
                node: "#project-title",
                points: [Y.WidgetPositionAlign.LC, Y.WidgetPositionAlign.LC]
            });

            projectInputTitle.set('value', Y.postmile.gpostmile.project.title);

            projectInputTitleOverlay.show();
            projectInputTitle.focus();
        });

        // preselect the input field's text when given focus
        projectInputTitle.on('focus', function () {
            setTimeout(Y.bind(projectInputTitle.select, projectInputTitle), 100);
        });

        // update project title, hide input field, and restore anchor
        // when user finishes focusing on it (and it's changed)
        projectInputTitle.on('blur', function (e) {

            projectInputTitleOverlay.hide();

            var project = gpostmile.project;
            var title = projectInputTitle.get('value');
            if (!title) {
                projectInputTitle.set('value', project.title);
                return;
            }

            projectTitle.setContent(title);

            var json = '{"title":"' + title + '"}';

            function confirmChangedProject(response, myarg) { // response has id, rev, status

                if (response.status === "ok") {

                    project.title = title;

                    project.rev = response.rev;

                    // need to renderProjects menu for both adding and changing project names
                    // just to repop the menu of projects with prop id, do not set and render last/active project
                    Y.fire('postmile:renderProjects', gpostmile.projects, false);

                } else {

                    // restore UI in case of error
                    projectTitle.setContent(project.title);
                    projectInputTitle.set('value', project.title);

                }
            }

            postJson("/project/" + project.id, json, confirmChangedProject);
        });

        // handle return and escape
        projectInputTitle.on('keydown', function (e) {
            if (e.keyCode === 13) {	// return
                projectInputTitle.blur();
            }
            if (e.keyCode === 27) {	// escape
                var project = gpostmile.project;
                projectInputTitle.set('value', project.title);
                projectInputTitle.blur();
            }
        });


        // project date

        var dateN = Y.one('#project-details .date');

        // launch calendar, give project new date if it doesn't have one
        dateN.on('focus', function (e) {

            // delay this binding until needed so it has time to load, init
            if (!Y.postmile.project.calendar) {
                bindCalendar();
            }

            var projectDate = gpostmile.project.date ? new Date(gpostmile.project.date) : new Date();
            Y.postmile.project.calendar.render({ selected: projectDate, date: projectDate });
            setTimeout(Y.bind(dateN.select, dateN), 0);
        });

        // process new date when field looses user's focus
        dateN.on('blur', function (e) {
            var project = gpostmile.project;
            var dateInput = dateN.get('value');
            setDate(dateInput);
        });

        // pay attention to escape and return
        dateN.on('keydown', function (e) {
            var project = gpostmile.project;
            if (e.keyCode === 13) {	// return
                dateN.blur();
                Y.postmile.project.calendar.hide();
            }
            if (e.keyCode === 27) {	// escape
                dateN.set('value', displayStringFromDate(project.date));
                dateN.blur();
                Y.postmile.project.calendar.hide();
            }
        });


        // project time

        var timeField = Y.one("#project-details .time");

        // selectAll and popup menu
        function onTimeFocus(e) {
            var timeNode = timeField._node;
            if (timeNode.selectionStart === 0 && timeNode.selectionEnd === 0) {
                setTimeout(Y.bind(timeField.select, timeField), 100);
            }
        }
        timeField.on('focus', onTimeFocus);
        timeField.on('click', onTimeFocus);

        // process when loosing user focus
        function onTimeBlur(e) {

            var project = gpostmile.project;
            var timeInput = timeField.get('value');
            var newTime = jsonStringFromTime(timeInput);
            var newContents = displayStringFromTime(newTime);
            var update = { time: "" }; // todo: how do I delete a time via the API?
            if (timeInput && newTime) {
                update = { time: newTime };
            } else {
                update = { time: "" };
            }
            function confirmChangedTime(response, myarg) { // response has id, rev, status
                if (response.status === 'ok') {
                    project.time = newTime;
                } else {
                    newContents = displayStringFromTime(project.time);
                    timeField.set('value', newContents);
                    Y.log('error setting time ' + JSON.stringify(response));
                }
            }
            var json = JSON.stringify(update);
            postJson("/project/" + project.id, json, confirmChangedTime);
            timeField.set('value', newContents);
        }

        // process blur conditionally
        // don't process if the field lost focus because the user simply moved to the menu
        function onTimeBlurMaybe(e) {
            function doOnTimeBlur() {
                onTimeBlur(e);
            }
            setTimeout(doOnTimeBlur, 100);
        }
        timeField.on('blur', onTimeBlurMaybe);

        // handle return and escape keys
        timeField.on('keydown', function (e) {
            var project = gpostmile.project;
            if (e.keyCode === 13) {	// return
                timeField.blur();
            }
            if (e.keyCode === 27) {	// escape
                timeField.set('value', displayStringFromTime(project.time));
                timeField.blur();
            }
        });


        // project place

        var place = Y.one("#project-details .place");

        // select text when receiving focus	
        place.on('focus', function (e) {
            // e.currentTarget.select() ;
            setTimeout(Y.bind(e.currentTarget.select, e.currentTarget), 100);
        });

        // process place when loosing focus
        function onPlace(e) {

            var project = gpostmile.project;
            // gpostmile.onPlaceHandler = place.on( 'click', onPlace );	
            var placeInput = place.get('value');
            var newContents = placeInput || ""; // renderProject does this as well
            var json = '{"place":"' + placeInput + '"}';
            function confirmChangedPlace(response, myarg) { // response has id, rev, status
                if (response.status === 'ok') {
                    project.place = placeInput; // following line handles blank input
                } else {
                    newContents = project.place || ""; // renderProject does this as well
                    place.set('value', newContents);
                    Y.log('error setting place ' + JSON.stringify(response));
                }
            }
            postJson("/project/" + project.id, json, confirmChangedPlace);
        }
        gpostmile.onPlaceHandler = place.on('blur', onPlace);

        // handle return and escape keys
        var placeN = Y.one('#project-details .place');
        placeN.on('keydown', function (e) {
            if (e.keyCode === 13) {	// return
                placeN.blur();
            }
            if (e.keyCode === 27) {	// escape
                var project = gpostmile.project;
                placeN.set('value', project.place || "");
                placeN.blur();
            }
        });


        // project menu incl logout, settings, tour

        var logout = Y.one("#account-menu #logout");
        if (logout) {
            logout.on('click', function (e) {
                window.location = postmile.web.uri + "/logout";
            });
        }

        var account = Y.one("#account-menu #accountsettings");
        if (account) {
            account.on('click', function (e) {
                window.location = postmile.web.uri + "/account";
            });
        }

        var tour = Y.one("#account-menu #guidedtour");
        if (tour) {
            tour.on('click', function (e) {
                Y.fire('postmile:launchTour');
            });
        }

        var prefs = Y.one("#account-menu #mysettings");
        if (prefs) {
            prefs.on('click', function (e) {
                // used to open and collapse prefs submenu, now clear storage to help with debug
                function confirmDeleteSettings(response) {
                    Y.log('deleted storage/settings');
                }
                deleteJson("/storage/settings", null, confirmDeleteSettings);
            });
        }


        // event handling 

        Y.on("postmile:askJoinCurrentProject", function (retryRequest) {
            askJoinCurrentProject(retryRequest);
        });

        Y.on("postmile:renderProject", function (project, force) {
            renderProject(project, force);
        });

        Y.on("postmile:renderProjectParticipants", function (project) {
            renderProjectParticipants(project);
        });

    }

    function bindCalendar() {
        Y.postmile.project.calendar = new Y.Calendar('date', {});
        Y.postmile.project.calendar.on('select', function (d) {
            Y.postmile.project.setDate(d);
        });
    }

    Y.namespace("project.project");
    Y.postmile.project = {
        setDate: setDate, // make event?
        last: null
    };

    bind();

}, "1.0.0", { requires: ["postmile-global", 'postmile-network', 'node'] });
