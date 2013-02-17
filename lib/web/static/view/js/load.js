/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* global ui and data functions needed to get project started smoothly before yui et al loaded
*
*	will use some YUI (via global Y) when available
*
*
*/

var Y; // global to carry across script tags / in this func
// global var debug;	// determines what is loaded and how

/* let it be global var */initialProjectId = null;
var initialTasks;
var initialTasksRendered;
/* let it be global var */initialProject = null;
var initialProjectRendered;
var projectCodeLoaded;

var st;
st = new Date;
st = st.getTime();
timeLog = function (s, pri) {
    if (pri && pri <= 1 && typeof console !== 'undefined') {
        console.log("TIME " + ((new Date).getTime() - st) + " " + s);
    }
}

getQueryVariable = function (variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == variable) {
            return pair[1];
        }
    }
    // alert('Query Variable ' + variable + ' not found');
}


// Window resize handler

function resizeListBox() {

    var topBar = document.getElementById('top-bar');
    var mainBox = document.getElementById('main-box');
    var projectDetails = document.getElementById('project-details-bar');
    var blueBox = document.getElementById('bluebox');
    var tasks = document.getElementById('tasks');
    var tourGuideBox = document.getElementById('tour-guide-alignment');

    var minHeight = 591;  // 546 (Invite dialog) + 45
    var height = Math.max(window.innerHeight, minHeight);
    var width = Math.max(window.innerWidth, 1180);
    var outsideWhiteHeight = 185;   // 45 + 20 + 15 + 15 + 80

    var prevMainBoxHeight = parseInt(mainBox.style.height, 10);

    document.body.style.overflowY = (height === minHeight || window.innerWidth < (width - 150) ? 'auto' : 'hidden');

    mainBox.style.height = (height - outsideWhiteHeight) + 'px';
    blueBox.style.height = (height - 83 - outsideWhiteHeight) + 'px';
    tasks.style.height = (height - 118 - outsideWhiteHeight) + 'px';
    tourGuideBox.style.height = (height + 60 - outsideWhiteHeight) + 'px';

    var prevMainBoxWidth = parseInt(mainBox.style.width, 10);

    topBar.style.width = (width - 150) + 'px';
    mainBox.style.width = (width - 180) + 'px';
    projectDetails.style.width = (width - 460) + 'px';
    blueBox.style.width = (width - 445) + 'px';
    tourGuideBox.style.width = (width - 150) + 'px';

    if (Y && Y.one) {
        var tourGuide = Y.one('#tour-guide');
        if (tourGuide) {

            if (tourGuide.hasClass('stickyW')) {
                tourGuide.setStyle('width', parseInt(tourGuide.getStyle('width'), 10) - prevMainBoxWidth + (width - 180) + 'px');
            }
            if (tourGuide.hasClass('stickyH')) {
                tourGuide.setStyle('height', parseInt(tourGuide.getStyle('height'), 10) - prevMainBoxHeight + (height - outsideWhiteHeight) + 'px');
            }
        }
    }

    var footer = document.getElementById('footer');
    footer.style.position = 'static';
    footer.style.bottom = null;
    footer.style.minWidth = width - 150 + 'px';

    if (Y && Y.postmile && Y.postmile.tasklist) {
        var taskList = Y.one("#tasks");
        var liNodes = taskList.all("li");
        liNodes.each(Y.postmile.tasklist.showUpdatedAgo);
    }

}

window.onresize = resizeListBox;


// Show task list loading wheel

function showTaskListLoading() {

    var blueBox = document.getElementById('bluebox').style;
    var tasks = document.getElementById('tasks').style;
    var loading = document.getElementById('bluebox-loading').style;

    tasks.overflowY = 'hidden';
    loading.display = 'inline-block';
    loading.top = (parseInt(blueBox.height, 10) / 2 - 32) + 'px';
    loading.left = (parseInt(blueBox.width, 10) / 2 - 32) + 'px';
}

function hideTaskListLoading() {

    var loading = document.getElementById('bluebox-loading').style;
    var tasks = document.getElementById('tasks').style;

    loading.display = 'none';
    tasks.overflowY = 'scroll';
}

// Show suggestions loading wheel

function showSuggestionsLoading() {

    var loading = document.getElementById('suggestions-loading').style;

    loading.display = 'inline-block';
}

hideSuggestionsLoading = function () {

    var loading = document.getElementById('suggestions-loading').style;

    loading.display = 'none';

    // Lauch guided tour if first time

    getJson("/storage/showtour", function (json) {
        Y.postmile.gpostmile.showTour = (json.showtour ? (json.showtour === 'true') : true);
        if (Y.postmile.gpostmile.showTour) {
            Y.fire('postmile:launchTour');
            postJson('/storage/showtour', '{"value":"false"}', function (response, myarg) { });
        }
    });
}


// <!--========== prime/prefetch active project id and tasks (loaded before body for perf) =============================== -->

preBody = function () {

    function confirmLogin(fragProject) {

        function confirmActiveProject(json) {

            initialProjectId = json.activeProject;

            function gotTasks(tasks) {

                initialTasks = tasks;

                if (typeof initialTaskRender === 'function' && !initialTasksRendered && projectCodeLoaded) {	// project loaded and already tried 
                    timeLog("rendering tasks from gotTasks callback ", 1);
                    initialTaskRender();
                    // console.log( "Retrying initialLoad " );
                }
            }

            function gotProject(project) {

                initialProject = project;

                if (typeof initialProjectRender === 'function' && !initialProjectRendered && projectCodeLoaded) {	// project loaded and already tried 
                    timeLog("rendering project from gotProject callback ", 1);
                    initialProjectRender();
                    // console.log( "Retrying initialLoad " );
                }
            }

            getJson("/project/" + initialProjectId + "/tasks", gotTasks);
            getJson("/project/" + initialProjectId, gotProject);
        }

        if (fragProject) {
            confirmActiveProject({ activeProject: fragProject });
        } else {
            getJson("/storage/activeProject", confirmActiveProject); // sync these:?
        }

    }

    loadCredentials(function () { confirmLogin(fragment) });

}


// <!--========== loaded after YUI-min but before body - just start loading the rest of YUI =============================== -->

postYUI = function () {

    var loadModules = {

        'postmile-tasks-list': { path: 'tasklist.js' },
        'postmile-global': { path: 'global.js' },
        'postmile-history': { path: 'history.js' },
        'postmile-settings': { path: 'settings.js' },
        'postmile-suggestions-list': { path: 'suggestions.js' },
        'postmile-templates': { path: 'templates.js' },
        'postmile-network': { path: 'network.js' },
        'postmile-stream': { path: 'stream.js' },
        'postmile-dnd': { path: 'dnd.js' },
        'postmile-user': { path: 'user.js' },
        'postmile-project': { path: 'project.js' },
        'postmile-projects-list': { path: 'projectslist.js' },
        'postmile-contacts': { path: 'contacts.js' },
        'postmile-tooltips': { path: 'tooltips.js' },
        'postmile-ui-utils': { path: 'uiutils.js' },
        'postmile-tips': { path: 'tips.js' },
        'postmile-tour': { path: 'tour.js' },
        'postmile-calendar': { path: 'calendar.js' },
        'postmile-menu': { path: 'menu.js' },
        'postmile-overlays-extra': { path: 'overlay-extras.js' }
    };

    Y = new YUI({

        filter: debug ? 'raw' : null,
        debug: debug,
        combine: false,

        comboBase: 'https://sec.yimg.com/combo?',
        root: 'yui-ssl/3.3.0/build/',

        groups: {
            postmile: {
                base: 'js/',
                modules: loadModules
            }
        }
    });

    Y.use(

    // common
			'node-base',
			'json-parse',
    // 'querystring',
			'dd-delegate',
			'substitute',
			'overlay',

		function (Y) {
		    // timeLog( "native done loading my base YUI modules" );
		});
}

// <!--========== run Y.use on all needed YUI and project modules =============================== -->

postBody = function () {

    function initialTaskRender() {

        Y.postmile.initialProjectId = initialProjectId;
        Y.postmile.initialTasks = initialTasks;

        if (initialTasks && initialProject) {

            initialProject.tasks = initialTasks;

            Y.fire('postmile:renderTasks', initialTasks, initialProjectId);

        }

    }

    function initialProjectRender() {

        Y.postmile.initialProjectId = initialProjectId;
        Y.postmile.initialProject = initialProject;

        if (initialProject) {

            Y.postmile.gpostmile.projects[initialProjectId] = initialProject; // doesn't help much as projectsList just wipes it out again

            initialProject.tasks = initialTasks;

            initialProject.requestedDetails = true; // just to say we tried

            Y.fire('postmile:renderProject', initialProject);

        }

    }

    function initialRender() {

        timeLog("rendering tasks and project from initialRender (project loaded) ", 1);

        projectCodeLoaded = true;

        initialTaskRender();

        hideTaskListLoading();
        showSuggestionsLoading();

        initialProjectRender();
    }

    timeLog("load initial modules YUI modules ", 3);
    Y.use(
    // common
			'node-base',
			'json-parse',
    // 'querystring',
			'dd-delegate',
			'substitute',
			'overlay',

		function (Y) {

		    if (debug) {

		        Y.use(

					'test',

		        // for multiple debug requests
					'postmile-global',
					'postmile-templates',
					'postmile-dnd',
					'postmile-tasks-list',
					'postmile-project',

					initialRender
				);

		    } else {

		        if (!Y.assert || !debug) {
		            Y.assert = function () { };
		        }
		        Y.assert(Y.assert);

		        Y.use(

		        // for one batch request
					'project',
					'postmile-tasks-list',
					'postmile-project',

					initialRender
				);

		    }

		});

    Y.use('node-base', 'oop', 'node-focusmanager', function (Y) {

        Y.use('postmile-menu', function (Y) {

            var accountmenu = Y.one('#account');
            accountmenu.plug(Y.Plugin.NodeMenuNav);

            /*for now, make this global var*/projectsmenu = Y.one('#projects-list');
            projectsmenu.plug(Y.Plugin.NodeMenuNav);

            var participantsmenu = Y.one('#project-participants');
            participantsmenu.plug(Y.Plugin.NodeMenuNav);
        });
    });


    // =============================== load initial modules ===============================
    timeLog("native applying/using all/advanced YUI modules ", 3);
    Y.use(
			'overlay',
			'event-key',
			'anim', // base not good enough for easing
			'postmile-menu',

    // for tooltips
			"event-mouseenter",
			"widget",
			"widget-position",
			"widget-stack",

			"history",

			'postmile-overlays-extra', // brought from YUI/gallery-land into project fold for https issues
			'postmile-calendar',

			'postmile-global',
			'postmile-history',
			'postmile-user',
			'postmile-suggestions-list',
			'postmile-network',
			'postmile-stream',
			'postmile-settings',
			'postmile-templates',
			'postmile-projects-list',
			'postmile-project',
			'postmile-tasks-list',
			'postmile-dnd',
			'postmile-contacts',
			'postmile-tooltips',
			'postmile-ui-utils',
			'postmile-tips',
			'postmile-tour',

		function (Y) {

		    timeLog("done loading project ", 2);

		});

    resizeListBox();
    showTaskListLoading();
}

