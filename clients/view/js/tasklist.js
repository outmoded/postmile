/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* tasklist module - handles:
*
*	list of tasks
*	check stat for each task
*	notes icon and details (rendering and input) for each state (notes aka details)
*	task title
*	participants icon (rendering, w and w/o 'Me', menu of project participants with checkbox state, delete)
*
*
*/

// tasks module - perhaps should factor-out details since that may become sophisticated on its own

YUI.add('postmile-tasks-list', function (Y) {

    var gpostmile = Y.postmile.gpostmile;
    var taskList = Y.one("#tasks");
    var exitKey = -1; // key last typed when exiting dialog

    // tri-states in task checkbox for css, api, and ui
    var checkStates = [
	{ css: 'default', api: 'open', ui: 'open' },
	{ css: 'in-progress', api: 'pending', ui: 'pending' },
	{ css: 'completed', api: 'close', ui: 'closed' }
];


    // render

    function render(tasks, projectId) {

        if (!tasks || (tasks._networkRequestStatusCode && tasks._networkRequestStatusCode !== 200)) {
            // it's okay for thre to be no tasks (still need to render none/blank)
            // tho if it's a net err, perhaps could retry (but that'd be at a lower level)
        }

        // may sometimes not have project yet
        if (gpostmile && gpostmile.projects) {
            var project = gpostmile.projects[projectId];
            if (project) {
                project.tasks = tasks;
            }
        }

        // generate the html for the given task data
        var html = "";
        if (tasks) {	// && isArray && length > 0
            var i, l;
            for (/*var*/i = 0, l = tasks.length; i < l; ++i) {
                var task = tasks[i];
                task.index = i; // for convenience if we have only key and want to find place in array
                tasks[task.id] = task;
                html += Y.postmile.templates.taskListHtml(task);
            }
        }
        html += "";

        // try to stop setContent from barfing
        try {
            taskNodes = taskList.all('>li');
            taskNodes.remove();
        } catch (err) {
            Y.log('error replacing tasklist content');
        }

        // set the html of the task data into the list
        taskList.setContent(html);

        // do things like turn off 'updated ago' on long titles 
        // (perhaps we should make this a func and do this also for adding and dropping suggestions)
        // manageLongTitles() ;
        var liNodes = taskList.all("li");
        liNodes.each(showUpdatedAgo);

        // append the 'Click to Enter' task
        addAddTask(taskList);

        sync();

        timeLog("done rendering tasks ");
    }


    // check to see if title's updatedAgo has wrapped back around

    function showEllipses(liTarget) {

        var text = liTarget.one('.measureText');
        var title = liTarget.one('.tasktitle');

        if (text && title) {

            text.set('value', title.get('value'));

            var container = liTarget.one('.titlearea');
            // count =  node.get('value','').split( '\n' ).length ;
            // node.setAttribute("rows",count);
            // text.style.height = text.scrollHeight+'px';
            var sw = text.get('scrollWidth');

            var ow = parseInt(container.getStyle("width"));
            var lw = parseInt(liTarget.getStyle("width"));
            var tow = lw - 84 - 5; // target/max width from liTarget down to span
            var tsw = tow - 36 - 5; // target/max width from span to text
            // var cw = container.get("clientWidth") ;
            // var padLeft = parseInt( text.getStyle( 'padding-left' ) ) ;
            // var padRight = parseInt( text.getStyle( 'padding-right' ) ) ;
            var editing = liTarget.hasClass('editing');
            var open = liTarget.hasClass('open');

            if (false) {
                ;
            } else if (open) {

                // if( sw <= ow || editing ) {
                if (sw < tsw || ow < tow || editing) {
                    title.setAttribute("rows", "1");
                    title.setAttribute("wrap", "off");
                } else {
                    title.setAttribute("rows", "");
                    title.setAttribute("wrap", "");
                }

                liTarget.removeClass('long-title');
                liTarget.addClass('short-title');
                title.setStyle("width", (sw/*-padLeft-padRight*/) + 'px');

            } else if (editing) {

                liTarget.removeClass('long-title');
                liTarget.addClass('short-title');
                title.setStyle("width", '');

                // } else if( sw <= ow || editing ) {
            } else if (sw < tsw || ow < tow || editing) {

                liTarget.removeClass('long-title');
                liTarget.addClass('short-title');
                title.setStyle("width", (sw/*-padLeft-padRight*/) + 'px');

            } else {

                liTarget.removeClass('short-title');
                liTarget.addClass('long-title');
                title.setStyle("width", '');

            }

            container.setStyle("width", (tow) + 'px');
            title.setStyle("width", (tsw) + 'px');

        }

    }

    function showUpdatedAgo(liTarget, doSync) {

        // presume scroll bar for calculations
        // better to grow task width than to shrink task width
        var tasks = document.getElementById('tasks').style;
        tasks.overflowY = 'scroll';

        var titleNode = liTarget.one(".tasktitle");
        var updatedAgoNode = liTarget.one(".updatedAgo");
        // var measureSpan = liTarget.one( '.measureSpan' ) ;
        var measureText = liTarget.one('.measureText');

        if (titleNode && updatedAgoNode && measureText) {

            var display = updatedAgoNode.getStyle('display');

            // measureSpan.setContent( titleNode.get( 'value' ) ) ;
            measureText.set('value', titleNode.get('value'));

            liTarget.removeClass('updatedago-would-wrap'); // node wrapped, hide it

            var x = titleNode.getX();
            // var w = parseInt( measureSpan.getStyle("width") ) ;
            var w = measureText.get('scrollWidth');

            updatedAgoNode.setX(x + w);

        }

        showEllipses(liTarget);

        if (doSync) {
            sync();
        }
    }


    // when tasks are changed, need to ensure they have the correctly generated states
    // for DnD and tooltips

    function sync() {

        if (Y.postmile.dnd && Y.postmile.dnd.tasksDndDelegate) {
            Y.postmile.dnd.tasksDndDelegate.syncTargets(); // gpostmile.tasksSortable.delegate.syncTargets() ;
        }

        if (Y.postmile.tooltips && Y.postmile.tooltips.tasktip) {
            Y.postmile.tooltips.tasktip.set("triggerNodes", ".yui3-hastooltip");
            Y.postmile.tooltips.tasktip.syncUI();
        }

    }


    // reorder

    function reorder(dragNode) {

        var projectId = gpostmile.project.id;
        var project = gpostmile.projects[projectId];
        var tasks = project.tasks;

        var dropNode = dragNode.get('nextSibling');
        var dropIndex = tasks.length;
        if (dropNode) {
            var dropId = dropNode.getAttribute('task');
            if (dropId) {	// might've been on addnewtask
                var dropTask = tasks[dropId];
                dropIndex = dropTask.index;
            }
        }

        var dragId = dragNode.getAttribute('task');
        var dragTask = tasks[dragId];
        var dragIndex = dragTask.index;

        if (dragIndex < dropIndex) {
            dropIndex--;
        }

        if (dragTask.index !== dropIndex) {

            // post new order
            var confirmTaskOrder = function (response, myarg) {

                if (response.status === 'ok') {
                    // task.rev = response.rev ;

                    // change array order
                    var dragSplice = tasks.splice(dragIndex, 1);
                    tasks.splice(dropIndex, 0, dragSplice[0]);

                    // update index fields
                    if (tasks) {	// just update all indecies
                        var i, l;
                        for (/*var*/i = 0, l = tasks.length; i < l; ++i) {
                            var task = tasks[i];
                            task.index = i; // for convenience if we have only key and want to find place in array
                            Y.assert(tasks[task.id] === task);
                        }
                    }

                    Y.fire('postmile:statusMessage', 'Item reordered');

                } else {

                    Y.fire('postmile:renderProject', Y.postmile.gpostmile.project);

                    Y.fire('postmile:errorMessage', 'Item reorder failed');

                }
            };

            postJson("/task/" + dragTask.id + "?position=" + dropIndex, "", confirmTaskOrder);
        }

    }


    // util to add an addNewTask (aka 'Click to Enter') to the list

    function addAddTask(taskList) {

        var html = Y.postmile.templates.listAddTaskTemplate;

        if (!taskList) {
            taskList = Y.one('#tasks');
        }

        taskList.append(html); // it'd be nice if appened returned appended node

        // don't let the 'Click to Enter' task be drag or drop able
        var addTaskLi = taskList.one(".addnewtask");
        addTaskLi.removeClass('yui3-dd-drop');

    }


    // dropSuggestion 

    function dropSuggestion(dragNode) {

        var projectId = gpostmile.project.id;
        var tasks = gpostmile.project.tasks;
        var suggestions = gpostmile.project.suggestions;
        var dragId = dragNode.getAttribute('suggestion');
        var dragSuggestion = suggestions[dragId];
        // var dragIndex = dragSuggestion.index ;
        var dropNode = dragNode.get('nextSibling');
        var dropIndex = tasks.length;

        if (dropNode) {
            var dropId = dropNode.getAttribute('task');
            if (dropId) {	// might've been on addnewtask
                var dropTask = tasks[dropId];
                dropIndex = dropTask.index;
            }
        }

        var title = dragSuggestion.title; // copy?
        // var json = '{"title":"' + title + '"}'  ;
        var task = { "title": title, "participantsCount": 0 };
        var html = Y.postmile.templates.taskInnerHtml(task);
        dragNode.setContent(html);

        showUpdatedAgo(dragNode, true);

        addSuggestionToServer(dragSuggestion, gpostmile.project, tasks, task, dropIndex, dragNode);

    }


    // addSuggestion

    function addSuggestion(suggestion) {

        var projectId = gpostmile.project.id;
        var tasks = gpostmile.project.tasks;

        var title = suggestion.title;
        var task = { "title": title, "participantsCount": 0 };

        var html = Y.postmile.templates.taskListHtml(task);
        var newNode = Y.Node.create(html);

        // append to task list
        var tasklistNode = Y.one('#tasks');
        var lastNode = tasklistNode.one('li:last-child');

        // just before addAddTask 'Click to Enter'
        lastNode.insertBefore(newNode, lastNode);

        showUpdatedAgo(newNode, true);

        // scroll / animate to end of list
        scrollNodeToBottom(newNode);

        addSuggestionToServer(suggestion, gpostmile.project, tasks, task, tasks.length, newNode);
    }


    // addSuggestionToServer

    function addSuggestionToServer(suggestion, project, tasks, task, index, node) {

        function confirmDroppedSuggestionTaskAdded(response, myarg) { // response has id, rev, status

            if (response.status === 'ok') {

                task.rev = response.rev;
                task.id = response.id;

                task.index = index;
                tasks.splice(index, 0, task); // tasks[index] = task would just replace / stomp


                tasks[task.id] = task;

                node.setAttribute("task", task.id);

                Y.fire('postmile:statusMessage', 'Suggestion added');

            } else {

                // todo: undelete/regen suggesitons list, renderSuggestions

                Y.fire('postmile:renderProject', project);

                Y.fire('postmile:errorMessage', 'Suggestion add failed');

            }
        }

        putJson('/project/' + project.id + '/task' + '?suggestion=' + suggestion.id + '&position=' + index,
		'',
		confirmDroppedSuggestionTaskAdded);

        sync();

    }


    // renderDetails

    function renderDetails(details, task) {
        task.details = details;

        var html = Y.postmile.templates.taskDetailsHtml(task);
        task.liDetailsTextTarget.setContent(html);

        html = Y.postmile.templates.taskEditedByHtml(task);
        task.liEditedByTarget.setContent(html);
    }


    // manage size of details input

    function shrinkDetails(node) {
        node.setStyle("height", '5px'); // nominal size for empty line
    }
    function expandDetails(node) {	// could do this on delete as well
        // count =  node.get('value','').split( '\n' ).length ;
        // node.setAttribute("rows",count);
        // text.style.height = text.scrollHeight+'px';
        var sh = node.get('scrollHeight');
        // var oh = node.getStyle("height") ;
        // var ch = node.get("clientHeight") ;
        var padTop = parseInt(node.getStyle('padding-top'));
        var padBot = parseInt(node.getStyle('padding-bottom'));
        node.setStyle("height", (sh - padTop - padBot) + 'px');
    }
    function resizeDetails(node) {
        shrinkDetails(node);
        expandDetails(node);
    }


    // close all details

    function closeAllDetails() {

        var liNodes = taskList.all("li");
        // var liTextareaNodes = taskList.all("textarea");

        liNodes.removeClass("open");
        liNodes.removeClass("active");
        liNodes.removeClass("participantsMenu");

        var liAnchorTargets = taskList.all(".tasktitle");
        liAnchorTargets.setStyle("white-space", "nowrap");
        liAnchorTargets.setAttribute("rows", "1");
        liAnchorTargets.setAttribute("wrap", "off");

    }


    // scroll / animate to end of list

    function checkNodeOverTop(node, msg) {

        var tasklistNode = Y.one('#tasks');

        var oldScrollTop = tasklistNode.get('scrollTop');
        var clientHeight = tasklistNode.get('scrollHeight');
        var containerHeight = tasklistNode.get('clientHeight');
        var containerY = tasklistNode.getXY()[1];
        var nodeHeight = parseInt(node.getStyle('height'), 10);
        var nodeY = node.getXY()[1];
        // var scrollTop = clientHeight - containerHeight ;
        var containerBottom = containerY + containerHeight;
        var nodeBottom = nodeY + nodeHeight;

        if (nodeBottom > containerBottom || (nodeY < containerY && nodeHeight > containerHeight)) {
            var overTop = nodeBottom - containerBottom;
            var newScrollTop = oldScrollTop + overTop;
            scrollTo(newScrollTop);
        } else if (nodeY < containerY) {
            var overTop = containerY - nodeY;
            var newScrollTop = oldScrollTop - overTop;
            scrollTo(newScrollTop);
        }

    }


    // scroll / animate to end of list

    function scrollNodeToBottom(node) {

        var tasklistNode = Y.one('#tasks');

        var clientHeight = tasklistNode.get('scrollHeight');
        var containerHeight = tasklistNode.get('clientHeight');
        var scrollTop = clientHeight - containerHeight;

        scrollTo(scrollTop);

    }

    function scrollTo(scrollTop) {

        var tasklistNode = Y.one('#tasks');

        var oldScrollTop = tasklistNode.get('scrollTop');

        // todo: protect against Anim not being loaded yet
        var scrollAnim = new Y.Anim({
            node: tasklistNode,
            to: {	// width: 0, height: 0
                scrollTop: scrollTop
            }
        });

        var scrollTime = Math.abs(scrollTop - oldScrollTop) / 1000 + 0.1;

        scrollAnim.set('duration', scrollTime);
        scrollAnim.set('easing', Y.Easing.easeOut);
        scrollAnim.run();
        scrollAnim.on('end', function () { });

    }


    // open details

    function openDetails(e) {

        var liTarget = e.currentTarget.ancestor("li", true);
        var taskId = liTarget.getAttribute('task');
        var task = gpostmile.project.tasks[taskId];
        var liTitleTarget = liTarget.one(".tasktitle");
        var newInput = liTitleTarget; // liTitleTarget.one("input.tasktitle") ;
        var liDetailsDivTarget = liTarget.one("div.messages");
        var liDetailsTextTarget = liDetailsDivTarget;
        var liEditedByTarget = liTarget.one("div.edited-by").ancestor(); // parent div

        // were the details currently open when we clicked on them?
        var current = liTarget.hasClass("open");

        // cut out spans and divs
        if (!e.target.test('li') && !e.target.test('.taskicon') && !e.target.test('.collapseDetails')) {
            return;
        }

        if (!task) {
            return;
        }

        if (newInput) {
            if (e.target === newInput) {
                return;
            } else {
                newInput.blur();
            }
        }

        // remember for rendering
        task.liDetailsTextTarget = liDetailsTextTarget;
        task.liEditedByTarget = liEditedByTarget;

        // mark it as read
        task.last = task.detailsModified + 1;

        var liTaskIconTarget = liTarget.one(".taskicon");

        // if the note was new, now that it's read, replcace icon w just content
        if (liTaskIconTarget && liTaskIconTarget.hasClass('noteNew')) {
            liTaskIconTarget.removeClass('noteNew');
            liTaskIconTarget.addClass('noteContent');
        }

        // need to do the same thing on the list node as it looks different with a new note
        if (liTarget && liTarget.hasClass('noteNew')) {
            liTarget.removeClass('noteNew');
            liTarget.addClass('noteContent');
        }

        // and clear the updatedAgo comment appended after the title
        liTarget.one('.updatedAgo').setContent('');

        // do this after getting the current state, but before setting node state
        if (!Y.postmile.settings || !Y.postmile.settings.multipleDetails()) {
            closeAllDetails();
        }

        // show same as hover (border, etc)
        liTarget.addClass("active");

        // toggle showing of details
        var liAnchorTitleTarget = liTarget.one(".tasktitle");
        if (!current) {

            // finally, when we hear from server that the new details were put...
            function renderDetailsAndSetFocus(response, task) {

                if (response && response._networkRequestStatusCode === 200) {

                    // rerender
                    renderDetails(response, task);

                    // scroll to show both input and most details
                    // give the opened node's height time to be recalculated
                    // checkNodeOverTop( liTarget, "pre" ) ;
                    setTimeout(function () { checkNodeOverTop(liTarget, "post"); }, 10);
                    // checkNodeOverTop will also call the scrolling function as needed
                    // scrollTasks( liTarget ) ;

                    // and prompt user for more details
                    var liDetailsInputTarget = liTarget.one("textarea.taskdetails");
                    task.liDetailsInputTarget = liDetailsInputTarget;
                    liDetailsInputTarget.focus();

                } else {

                    Y.log('tasklist module: get details failed ' + JSON.stringify(response));

                }
            }

            // only fetch details if we hadn't before (streams will provide us with updates)
            if (!task.requestedDetails && taskId !== "") {

                task.requestedDetails = true;
                getJson("/task/" + taskId + "/details", renderDetailsAndSetFocus, task);

            } else {

                renderDetailsAndSetFocus(task.details, task);

            }

            // open task to show details
            liTarget.addClass("open");

            // show entire task title
            if (liAnchorTitleTarget) {
                liAnchorTitleTarget.setStyle("white-space", "normal");
                liAnchorTitleTarget.setAttribute("rows", "");
                liAnchorTitleTarget.setAttribute("wrap", "");
            } else {
            }

        } else {

            // hide details
            liTarget.removeClass("open");

            // show ellipse if task title too long
            liAnchorTitleTarget.setStyle("white-space", "nowrap");
            liAnchorTitleTarget.setAttribute("rows", "1");
            liAnchorTitleTarget.setAttribute("wrap", "off");

        }

        function confirmLastPost(response, myarg) {

            if (response.status === 'ok') {

                task.last = task.detailsModified + 1;

            } else {

                Y.log('tasklist module: confirmLastPost failed ' + JSON.stringify(response));

            }

        }

        showUpdatedAgo(liTarget);

        postJson('/task/' + task.id + '/last', "", confirmLastPost);

    }


    // blur details
    //	note that this is not called when details are closed/hidden
    //	leaving users typing in the input field
    //	(lack of visibility doesn't cause a blur event)

    function blurDetails(e) {

        var liDetailsInputTarget = e.currentTarget;
        var detailsText = liDetailsInputTarget.get('value');

        setTimeout(function () { resizeDetails(liDetailsInputTarget) }, 0);

        setTimeout(function () { checkNodeOverTop(liTarget); }, 0);

        if (!detailsText) {
            return;
        }

        // var json = '{ "type":"text", "content":"' + encodeURIComponent(detailsText) + '"}' ;	// todo: just stringify
        // var json = '{ "type":"text", "content":' + JSON.stringify(detailsText) + '}' ;
        // var json = '{ "type":"text", "content":"' + detailsText + '"}' ;
        // var detailsObject = { "type":"text", "content": detailsText, "user": { id: gpostmile.profile.id, display: gpostmile.profile.name }, "created": ((new Date()).getTime()) } ;
        var detailsObject = { "type": "text", "content": detailsText };
        var json = JSON.stringify(detailsObject); // escapes newlines too
        detailsObject.user = { id: gpostmile.profile.id, display: gpostmile.profile.name };
        detailsObject.created = new Date().getTime();

        var liTarget = liDetailsInputTarget.ancestor("li");
        var taskId = liTarget.getAttribute('task'); // get does not always work
        var task = gpostmile.project.tasks[taskId];

        liDetailsInputTarget.set('value', '');

        function confirmTaskDetails(response, myarg) {

            if (response.status === 'ok') {

                task.rev = response.rev;

                task.details.thread[task.details.thread.length] = detailsObject;

                // set new state for task note/detail icon as well as whole list node
                // first, clear state / classes
                var liTaskIconTarget = liTarget.one(".taskicon");
                liTaskIconTarget.removeClass('noteNew');
                liTaskIconTarget.removeClass('noteContent');
                liTaskIconTarget.removeClass('noteEmpty');
                liTarget.removeClass('noteNew');
                liTarget.removeClass('noteContent');
                liTarget.removeClass('noteEmpty');
                // then check details thread for content, or empty - can't be 'new' as user already viewed it upon typing
                // detailsModified is from server - now we can look at details
                var addClass = task.details.thread.length ? 'noteContent' : 'noteEmpty';
                liTaskIconTarget.addClass(addClass);
                liTarget.addClass(addClass);

                // prompt user for more details by giving focus back to details input field
                task.liDetailsInputTarget.focus();

                // and set the time viewed to just after it was modified (avoiding it to be marked as new)
                // task.detailsModified = task.detailsModified || 1 ;
                task.detailsModified = ((new Date()).getTime());
                task.detailsModifiedBy = detailsObject.user;
                task.last = task.detailsModified + 1;

                renderDetails(task.details, task);

                Y.fire('postmile:statusMessage', 'Details added');

                var confirmLastPost = function (response, myarg) {
                    if (response.status === 'ok') {
                        // we may have already done this in response to posting the details
                        task.last = task.detailsModified + 1;
                    } else {
                        Y.log('tasklist module: confirmLastPost failed ' + JSON.stringify(response));
                    }
                };

                postJson('/task/' + task.id + '/last', "", confirmLastPost);

            } else {

                Y.fire('postmile:errorMessage', 'Addition to details failed');

            }
        }

        postJson('/task/' + task.id + '/detail', json, confirmTaskDetails);

    }


    // nextState 
    //	for the checkbox of a given list node, 
    //	set the next state of the check box 
    //	in both the checkbox and list node
    //  as well as update the task data
    //	and return the current state and the next state

    function nextState(liTarget, newState) {

        var liCheckTarget = liTarget.one(".check");
        var taskId = liTarget.getAttribute('task'); // get does not always work
        var task = gpostmile.project.tasks[taskId];

        var oldState;

        var ci;
        for ( /*var*/ci = 0; ci < checkStates.length; ci++) {

            var css = checkStates[ci].css;
            var nci = (ci + 1) % checkStates.length;

            if (liCheckTarget.hasClass(css)) {

                newState = (typeof newState === 'undefined') ? nci : newState;
                oldState = ci;

            }

            liCheckTarget.removeClass(css);

        }

        liCheckTarget.addClass(checkStates[newState].css);
        task.status = checkStates[newState].api;
        if (checkStates[newState].css === 'completed') {
            liTarget.addClass('completed');
        } else {
            liTarget.removeClass('completed');
        }

        return { oldState: oldState, newState: newState };
    }


    // check task 
    //	handle a click on the checkbox of a task
    //	both the data and the UI

    function checkTask(e) {

        var liTarget = e.currentTarget.ancestor("li", true); // true == scans/tests self
        var liCheckTarget = liTarget.one(".check");
        var taskId = liTarget.getAttribute('task'); // get does not always work
        var task = gpostmile.project.tasks[taskId];
        var state = nextState(liTarget);
        var jsonObject = { status: task.status };
        var json = JSON.stringify(jsonObject);

        // mark task as active, as if were being hovered or opened
        liTarget.addClass("active");

        function confirmTaskCheck(response, myarg) { // response has id, rev, status

            if (response.status === "ok") {

                Y.fire('postmile:statusMessage', 'Task ' + checkStates[state.newState].ui);

            } else {

                nextState(liTarget, state.oldState);

                Y.fire('postmile:errorMessage', 'Task ' + 'check' + ' failed');

            }

        }

        postJson("/task/" + task.id, json, confirmTaskCheck);

    }


    // askDeleteTask - ask before deleting

    function askDeleteTask(e) {
        if (Y.postmile.settings.confirmDelete()) {
            Y.fire('postmile:confirm', 'Delete item?', 'This will permanently delete the item and all its details.', fadeDeleteTask, e);
        } else {
            fadeDeleteTask(e);
        }
    }

    // fadeDeleteTask - start fade anim and request delete from API, 
    //	wait until fade done before collapsing deleted node and removing from list

    function fadeDeleteTask(e) {

        var liCloseTarget = e.currentTarget;
        var liTarget = liCloseTarget.ancestor("li", true);
        var taskId = liTarget.getAttribute('task');
        var tasks = gpostmile.project.tasks;
        var task = gpostmile.project.tasks[taskId];
        var fadeAnim = new Y.Anim({
            node: liTarget,
            to: {
                opacity: 0
            }
        });

        fadeAnim.set('duration', 0.75);
        fadeAnim.set('easing', Y.Easing.easeOut);
        fadeAnim.run();
        fadeAnim.on('end', function () {
            var activeTask = taskList.one(".active");
            if (!activeTask) {
                var nextLiTarget = liTarget.next();
            }

            liTarget.remove();
        });

        function confirmTaskDelete(response, myarg) {

            if (response.status === 'ok') {

                task.rev = response.rev;

                delete tasks[task.id]; // remove from task dictionary
                tasks.splice(task.index, 1); // remove from task sequence

                // update all indicies
                if (tasks) {
                    var i, l;
                    for (/*var*/i = 0, l = tasks.length; i < l; ++i) {
                        tasks[i].index = i;
                    }
                }

                Y.fire('postmile:statusMessage', 'Item deleted');

            } else {

                Y.fire('postmile:renderProject', Y.postmile.gpostmile.project);

                Y.fire('postmile:errorMessage', 'Item deletion failed');

            }
        }

        deleteJson("/task/" + task.id, null, confirmTaskDelete);

    }


    // show participants menu
    //	get task, check menu bounds, call contacts code

    function showParticipants(e) {

        var project = gpostmile.project;
        var tasks = project.tasks;

        var liTarget = e.currentTarget.ancestor("li", true);

        var taskId = liTarget.getAttribute('task'); // get does not always work
        var task = gpostmile.project.tasks[taskId];

        var scrollWindowNode = Y.one("#tasks");
        var maxY = scrollWindowNode.getY() + parseInt(scrollWindowNode.getComputedStyle('height'), 10);

        if (Y.postmile.contacts) {
            var showingNow = Y.postmile.contacts.toggleTaskParticipants(e.currentTarget, task, maxY);
            if (showingNow) {
                liTarget.addClass('participantsMenu');
            } else {
                liTarget.removeClass('participantsMenu');
            }
        }

    }


    // activate hovered tasks
    //	add 'active' class to show border (background, etc)

    function onHover(e) {

        var liTarget = e.currentTarget.ancestor("li", true); // true == scans/tests self
        var taskId = liTarget.getAttribute('task'); // get does not always work
        var task = null;

        if (gpostmile.project && gpostmile.project.tasks && taskId) {
            task = gpostmile.project.tasks[taskId];
        }

        liTarget.addClass("active");

        // prefetch participants for quicker response/interactivity on the person icon
        if (task && !task.participants) {

            var gotTaskParticipants = function (response, myarg) {

                if (response._networkRequestStatusCode === 200) {

                    task.created = response.modified;
                    task.modified = response.created;
                    task.participants = response.participants || [];
                    task.project = response.project;
                    task.status = response.status;
                    task.title = response.title;

                } else {
                    Y.log('tasklist module: gotTaskParticipants failed ' + JSON.stringify(response));
                }

            };

            getJson("/task/" + task.id, gotTaskParticipants);
        }

    }


    // deactivate after hover

    function endHover(e) {

        var liTarget = e.currentTarget.ancestor("li", true);
        var liTitleTarget = liTarget.one(".tasktitle");
        var taskId = liTarget.getAttribute('task');
        var newInput;
        var detailsOpen;
        var participantsOpen;

        if (liTitleTarget) {
            newInput = liTitleTarget; // liTitleTarget.one("input.tasktitle") ;
            detailsOpen = liTarget.hasClass("open");
        }

        if (Y.postmile.contacts) {
            participantsOpen = Y.postmile.contacts.isTaskParticipantsOpen(taskId);
        }

        if (!(newInput && newInput._node === document.activeElement)
			&& (!detailsOpen)
			&& (!participantsOpen)) {
            liTarget.removeClass("active");
        }
    }


    // called when done typing in task title (blur, return, escape)
    //	includes typing on 'Click to Add' title (todo: factor that out to simplify and shorten this func)

    function titleTyped(e) {
        showUpdatedAgo(e.currentTarget.ancestor("li", true));
    }

    function titleEntered(e) {

        var project = gpostmile.project;
        var liTarget = e.currentTarget.ancestor("li", true); // true == scans/tests self

        if (!liTarget) {
            return;
        }

        var taskId = liTarget.getAttribute('task');
        var task = null;

        var liTitleTarget = liTarget.one(".tasktitle");
        var newInput = liTitleTarget; // liTitleTarget.one("input.tasktitle") ;
        var title = newInput.get('value');
        var jsonObject = { title: title };
        var json = JSON.stringify(jsonObject);

        var liNodes = taskList.all("li");

        // remove highlighting (we don't get a hover out event when input field is focussed)
        if (!liTarget.hasClass('open')) {
            liNodes.removeClass("active");
        }

        liNodes.removeClass("editing");

        if (taskId) {
            task = gpostmile.project.tasks[taskId];
        }

        if (task) {
            wasTitle = task.title;
        } else {
            if (!title || exitKey === 27) {	// empty or escape
                Y.one('#tasks').all(".addnewtask").remove(true);
                addAddTask(taskList);
                liTarget = null;
            }
        }

        if (liTarget) {	// may be null - if user hit escape or blank

            if (!task) {
                task = { "title": title, "participantsCount": 0 };
            }

            // todo: don't redo text
            // set the new task title to gen off the template, revert to old, the back to new when net req confirmed
            var oldTaskTitle = task.title;
            task.title = title;
            var html = Y.postmile.templates.taskInnerHtml(task);
            task.title = oldTaskTitle;
            liTarget.setContent(html); // via closure; todo: make this text temp
            showUpdatedAgo(liTarget, true);

            var confirmTask = function (response, myarg) { // response has id, rev, status

                if (response.status === 'ok') {

                    task.rev = response.rev;
                    task.title = title;

                    // if it's a newly added task
                    if (!task.id) {
                        task.id = response.id;
                        liTarget.setAttribute("task", task.id);
                        project.tasks[task.id] = task;
                    }

                    Y.fire('postmile:statusMessage', 'Task ' + (taskId ? 'changed' : 'added'));

                } else {

                    html = Y.postmile.templates.taskInnerHtml(task);
                    liTarget.setContent(html);
                    showUpdatedAgo(liTarget, true);

                    Y.fire('postmile:errorMessage', 'Task ' + (taskId ? 'change' : 'add') + ' failed');
                }
            };

            if (!taskId) {	// if( liTarget.name === "addnewtask" ) 

                var confirmAddTask = function (response, myarg) { // response has id, rev, status

                    if (response.status === 'ok') {

                        task.index = project.tasks.length; // will be added to the end, last in the array
                        project.tasks[project.tasks.length] = task;

                        liTarget.removeClass("addnewtask");
                        liTarget.addClass('task');

                        addAddTask(taskList);

                        // works best after we add the task (otherwise li is still hovered/highlighted)
                        liTarget.removeClass("active");

                        var newLi = taskList.one(".addnewtask");
                        if (exitKey === 13) {
                            taskTitleClick({ currentTarget: newLi });
                        }

                        // do not need to rerender anymore of task as title set
                        confirmTask(response, myarg);

                        sync();

                    } else {

                        Y.one('#tasks').all(".addnewtask").remove(true);
                        addAddTask(taskList);
                        // liTarget = null ;

                        // rerender to sync UI w unchanged data
                        render(project.tasks, project.id);

                        Y.fire('postmile:errorMessage', 'Task ' + (taskId ? 'change' : 'add') + ' failed');
                    }

                };

                putJson("/project/" + project.id + "/task", json, confirmAddTask);

            } else {

                if (title && title !== oldTaskTitle) {
                    postJson("/task/" + task.id, json, confirmTask);
                }

            }

        }

        sync(); // to ensure we've got tooltrip trigger back on title
    }

    /*
    * listen to mouse to disambiguate selection vs dragging
    *	if moves more than five pixels horz, before any selection occurs (was vert move < 5 px)
    *	then treat as selection instead of drag (don't resend mouse down to start drag)
    */

    function bindDragVsSelect() {
        var mdh;
        var muh;
        var mmh;
        var ssh;
        var ssc;
        var mde;
        var mdXY;

        function listenForSuperfluousSelection(e) {
            if (ssh) {
                ssh.detach(); // only needs to be done once
            }
            ssh = Y.on('selectstart', abortSuperfluousSelection, 'body');
            ssc = 0;
        }
        function abortSuperfluousSelection(e) {
            window.getSelection().empty();
            if (ssc++ > 3) {	// only needs to be done a few times
                if (ssh) {
                    ssh.detach();
                }
                ssh = null;
            }
        }

        function taskMouseDown(e) {
            if (mmh) {
                mmh.detach();
            }
            mmh = taskList.delegate('mousemove', taskMouseMove, 'li .tasktitle');
            mde = e;
            mdXY = [e.clientX, e.clientY];
            // e.stopPropagation() ;
        }

        function taskMouseUp(e) {
            dragging = 0;
            if (mmh) {
                mmh.detach();
            }
            mmh = null;
        }

        function taskMouseMove(e) {

            if (Math.abs(mdXY[1] - e.clientY) > 5 && !window.getSelection().toString()) {

                if (mde) {

                    // mde.currentTarget.simulate( mde.type, mde ) ;  will not work with DnD

                    var liTarget = e.currentTarget.ancestor("li", true); // true == scans/tests self

                    // try in vain to avoid superfluous selection
                    // ... simulate( 'mouseup', 'click' on various nodes
                    // ... delay setTimeout( startDrag, 1000 ) ;
                    listenForSuperfluousSelection();

                    liTarget.simulate('mousedown', { clientX: mde.clientX, clientY: mde.clientY });

                    mde = null;

                    if (mmh) {
                        mmh.detach();
                    }
                    mmh = null;
                }
            }
        }

        mdh = taskList.delegate('mousedown', taskMouseDown, 'li .tasktitle');
        muh = taskList.delegate('mouseup', taskMouseUp, 'li .tasktitle');
    }


    // click on task (outside of title)

    function taskSingleClick(e) {

        var project = gpostmile.project;
        var liTarget = e.currentTarget.ancestor("li", true); // true == scans/tests self
        var liTitleTarget = liTarget.one(".tasktitle"); // choses first one, with ttile (not span of right icons)
        var taskId = liTarget.getAttribute('task'); // get does not always work
        var task = null;

        // no longer treat task click outside of title as a title click
        if (e.target.get('tagName').toLowerCase() === 'li') {
            document.activeElement.blur();
        }

        // do treat task click outside of title as a title click
        // taskTitleClick( e ) ;
        // liTarget.one('input.tasktitle').focus() ;

        // newInput = liTitleTarget.one("input") ;	// it'd be nice if we could just get this from setContent
        // showUpdatedAgo( liTarget ) ;
        // Y.assert( newInput ) ;
        // newInput.focus();
    }


    // click on task (on title)

    function taskTitleClick(e) {

        // don't immediately add active and editing classes 
        // because the forthcoming focus causes a blur which will remove editing

        var project = gpostmile.project;
        var liTarget = e.currentTarget.ancestor("li", true); // true == scans/tests self
        var liTitleTarget = liTarget.one(".tasktitle"); // choses first one, with ttile (not span of right icons)
        var taskId = liTarget.getAttribute('task'); // get does not always work
        var task = null;
        var newInput = liTitleTarget; // liTitleTarget.one("input.tasktitle") ;
        var sel = window.getSelection();

        if (sel.toString() && liTitleTarget.contains(sel.anchorNode)) {
            return;
        }

        if (taskId) {
            task = gpostmile.project.tasks[taskId];
        }

        // do this now after focus as caused blur and removed 'editing' class from all LI nodes
        liTarget.addClass("active");
        liTarget.addClass("editing");

        // do this after adding 'editing' class so that can be used to correctly show task state
        showUpdatedAgo(liTarget, true);

        if (newInput && e.type === 'click' && e.target === newInput) {
            return;
        } else {
            // setTimeout( Y.bind( newInput.focus, newInput ), 100 )  ;	// don't let li node steal focus
            newInput = liTitleTarget; // liTitleTarget.one("input.tasktitle") ;
            newInput.focus(); // this causes a blur event which can remove the editing class
            // window.getSelection().empty() ;	//  - also, try to clear selection
            Y.postmile.uiutils.setCursor(newInput, 999); // move cursor to end
        }

    }


    // bind UI

    function bind() {

        function tasklistKeypress(e) {

            e.currentTarget.removeClass("addnewitem");

            exitKey = e.keyCode;

            if (e.keyCode === 13) {	// return
                e.currentTarget.blur();
            }

            if (e.keyCode === 27) {	// escape
                var liTarget = e.currentTarget.ancestor("li", true); // true == scans/tests self
                var taskId = liTarget.getAttribute('task'); // get does not always work
                var task = gpostmile.project.tasks[taskId];
                if (task) {
                    e.currentTarget.set('value', task.title);
                }
                e.currentTarget.blur();
            }

        }

        taskList.delegate('keydown', tasklistKeypress, '.tasktitle');

        // just text 
        // taskList.delegate('click', taskTitleClick, '.tasktitle' ) ;

        // cilck anywhere on width of title area
        taskList.delegate('click', taskTitleClick, '.titlearea');

        // click on add new item
        taskList.delegate('click', taskTitleClick, '.addnewtask');

        taskList.delegate('click', checkTask, '.check'); // 'li > .check'

        taskList.delegate('click', showParticipants, '.participants'); // does a toggle

        taskList.delegate('click', askDeleteTask, '.deleteTask');

        taskList.delegate('hover', onHover, endHover, 'li'); // easier / better than mouse over

        taskList.delegate('click', openDetails, '.taskicon');
        // nah taskList.delegate( 'dblclick', openDetails, 'li' ) ;	// incl task title
        taskList.delegate('click', taskSingleClick, 'li');
        taskList.delegate('click', openDetails, '.collapseDetails'); // will toggle close when open

        // should also be called when details are closed/hidden (lack of visibility doesn't cause a blur event)
        function detailsKeypress(e) {

            if (e.keyCode === 13) {	// return
                // no longer listening to blur event, but logic is same, so just ensure current target is same / valid
                // e.currentTarget.blur() ;

                if (!e.shiftKey) {	// if( !Y.postmile.settings.multilineDetails() )

                    // try to truncate newline, but it's too early
                    // var value = e.currentTarget.get('value') ;
                    // e.currentTarget.set('value', value.substring(0,length-1) ) ;
                    // this stops the chars from getting into text value: e.halt() ;

                    // not on this thread - wait until after we've resized the text box
                    // blurDetails( e ) ;	
                    setTimeout(function () { blurDetails(e) }, 0);
                }

            }

            if (e.keyCode === 27) {	// escape
                e.currentTarget.set('value', '');
                // e.currentTarget.blur() ;
            }

            // backspace or delete - might make it smaller - and delay until this keystroke is included
            if (e.keyCode === 8 || e.keyCode === 127 || e.keyCode === 27) {
                setTimeout(function () { resizeDetails(e.currentTarget) }, 0);
            } else {
                setTimeout(function () { expandDetails(e.currentTarget) }, 0);
            }

        }
        taskList.delegate('keyup', detailsKeypress, '.taskdetails textarea'); // keyup ensures the char is in the field

        // should also be called when details are closed/hidden (lack of visibility doesn't cause a blur event)
        function detailsFocus(e) {
            var ct = e.currentTarget;
            setTimeout(function () { resizeDetails(ct) }, 0);
        }
        taskList.delegate('focus', detailsFocus, '.taskdetails textarea'); // was textarea

        function addTaskDetailClicked(e) {
            // no longer listening to blur event, but logic is same, so just ensure current target is same / valid
            // e.currentTarget.ancestor().one('textarea.taskdetails').blur() ;	// better way to get input sib?
            e.currentTarget = e.currentTarget.ancestor().one('textarea.taskdetails');
            blurDetails(e);
            // no longer listening to blur event, but logic is same, so just ensure current target is same / valid
        }
        taskList.delegate('click', addTaskDetailClicked, '.addTaskDetail');

        // details input
        taskList.delegate('focus', function (e) { e.currentTarget.set('value', ''); e.currentTarget.removeClass('addnewitem'); }, '.addnewitem');

        taskList.delegate('blur', function (e) { titleEntered(e); }, '.tasktitle');
        taskList.delegate('keyup', function (e) { titleTyped(e); }, '.tasktitle');


        // handle detecting a drag for selection vs dnd
        bindDragVsSelect();


        // event handlers

        Y.on("postmile:dropSuggestion", function (proxy) {
            dropSuggestion(proxy);
        });

        Y.on("postmile:addSuggestion", function (suggestion) {
            addSuggestion(suggestion);
        });

        Y.on("postmile:taskReorder", function (node) {
            reorder(node);
        });

        Y.on("postmile:renderTasks", function (tasks, projectId) {
            render(tasks, projectId);
        });

    }

    Y.namespace("project.tasklist");
    Y.postmile.tasklist = {
        showUpdatedAgo: showUpdatedAgo
    };

    bind();

}, "1.0.0", { requires: ['postmile-global', 'postmile-templates', 'postmile-suggestions-list', 'postmile-settings', 'postmile-dnd', 'event-key', 'node', 'anim'] });
