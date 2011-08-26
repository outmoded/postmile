/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* global ui and data functions needed to get sled started smoothly before yui et al loaded
*
*	will use some YUI (via global Y) when available
*
*
*/ 

var Y;	// global to carry across script tags / in this func
// global var debug;	// determines what is loaded and how

/* let it be global var */ initialSledId = null;
var initialTasks;
var initialTasksRendered;
/* let it be global var */ initialSled = null;
var initialSledRendered;
var sledCodeLoaded;

var st;
st = new Date; 
st = st.getTime();
timeLog = function ( s, pri ) {
	if( pri && pri <= 1 && typeof console !== 'undefined' ) {
		console.log( "TIME " + ( (new Date).getTime() - st ) + " " + s );
	}
}

getQueryVariable = function(variable) {
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
	var sledDetails = document.getElementById('sled-details-bar');
	var blueBox = document.getElementById('bluebox');
	var tasks = document.getElementById('tasks');
	var tourGuideBox = document.getElementById('tour-guide-alignment');

	var minHeight = 591;	 // 546 (Invite dialog) + 45
	var height = Math.max(window.innerHeight, minHeight);
	var width = Math.max(window.innerWidth, 1180);
	var outsideWhiteHeight = 185;   // 45 + 20 + 15 + 15 + 80

	var prevMainBoxHeight =  parseInt(mainBox.style.height, 10);

	document.body.style.overflowY = (height === minHeight || window.innerWidth < (width - 150) ? 'auto' : 'hidden');

	mainBox.style.height = (height - outsideWhiteHeight) + 'px';
	blueBox.style.height = (height - 83 - outsideWhiteHeight) + 'px';
	tasks.style.height = (height - 118 - outsideWhiteHeight) + 'px';
	tourGuideBox.style.height = (height + 60 - outsideWhiteHeight) + 'px';

	var prevMainBoxWidth =  parseInt(mainBox.style.width, 10);

	topBar.style.width = (width - 150) + 'px';
	mainBox.style.width = (width - 180) + 'px';
	sledDetails.style.width = (width - 460) + 'px';
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
	
	if( Y && Y.sled && Y.sled.tasklist ) {
		var taskList = Y.one( "#tasks" );
		var liNodes = taskList.all("li");
		liNodes.each( Y.sled.tasklist.showUpdatedAgo );		
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

	getJson("storage/showtour", function (json) {
		Y.sled.gsled.showTour = (json.showtour ? (json.showtour === 'true') : true);
		if (Y.sled.gsled.showTour) {
			Y.fire( 'sled:launchTour' );
			postJson('storage/showtour', '{"value":"false"}', function (response, myarg) {});
		}
	});
}


// <!--========== prime/prefetch active sled id and tasks (loaded before body for perf) =============================== -->

preBody = function() {

	function confirmLogin( fragSled ) {

		function confirmActiveSled( json ) {

			initialSledId = json.activesled;

			function gotTasks( tasks ) {

				initialTasks = tasks;

				if( typeof initialTaskRender === 'function' && !initialTasksRendered && sledCodeLoaded ) {	// sled loaded and already tried 
					timeLog( "rendering tasks from gotTasks callback ", 1 );
					initialTaskRender();
					// console.log( "Retrying initialLoad " );
				} 
			}

			function gotSled( sled ) {

				initialSled = sled;

				if( typeof initialSledRender === 'function' && !initialSledRendered && sledCodeLoaded ) {	// sled loaded and already tried 
					timeLog( "rendering sled from gotSled callback ", 1 );
					initialSledRender();
					// console.log( "Retrying initialLoad " );
				} 
			}

			getJson(postmile.api.uri + "/sled/" + initialSledId + "/tasks", gotTasks);
			getJson(postmile.api.uri + "/sled/" + initialSledId, gotSled);
		}

		if( fragSled ) {
			confirmActiveSled( { activesled: fragSled } );
		} else {
            getJson(postmile.api.uri + "/storage/activesled", confirmActiveSled); // sync these:?
		}

	}

	loadCredentials( function() { confirmLogin( fragment ) } );

}


// <!--========== loaded after YUI-min but before body - just start loading the rest of YUI =============================== -->

postYUI = function() {

	var loadModules = {
				sledtasklist: { path: 'tasklist.js' },
				sledglobal: { path: 'global.js' },
				sledhistory: { path: 'history.js' },
				sledsettings: { path: 'settings.js' },
				sledsuggestionlist: { path: 'suggestionlist.js' },
				sledtemplates: { path: 'templates.js' },
				slednetwork: { path: 'network.js' },
				sledstream: { path: 'stream.js' },
				sleddnd: { path: 'dnd.js' },
				sleduser: { path: 'user.js' },
				sledsled: { path: 'sled.js' },
				sledsledlist: { path: 'sledlist.js' },
				sledcontacts: { path: 'contacts.js' },
				sledtooltips: { path: 'tooltips.js' },
				sleduiutils: { path: 'uiutils.js' },
				sledtips: { path: 'tips.js' },
				sledtour: { path: 'tour.js' },
				'sled-calendar': { path: 'calendar.js' },
				'sled-menu': { path: 'sled-menu.js' },
				'sled-overlay-extras': { path: 'sled-overlay-extras.js' }
	};

	Y = new YUI( {

		// debug : true,
		// combine: false,
		filter: debug ? 'raw' : null,	// can make sled-min unfound	// or debug
		debug : debug,
		combine: !debug,

		// base: 'https://sec.yimg.com/combo?yui-ssl/3.3.0/build/',
		comboBase: 'https://sec.yimg.com/combo?',
		root: 'yui-ssl/3.3.0/build/',

		groups: {
			sled: {
				// combine: false,
				base: 'js/',
				// root: '2.8.0r4/build/',
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

		function(Y) {
			// timeLog( "native done loading my base YUI modules" );
		});
}

// <!--========== run Y.use on all needed YUI and sled modules =============================== -->

postBody = function() {

	function initialTaskRender() {

			Y.sled.initialSledId = initialSledId;
			Y.sled.initialTasks = initialTasks;

			if( initialTasks && initialSled ) {

				initialSled.tasks = initialTasks;

				Y.fire( 'sled:renderTasks', initialTasks, initialSledId );

			}

	}

	function initialSledRender() {

			Y.sled.initialSledId = initialSledId;
			Y.sled.initialSled = initialSled;

			if( initialSled ) {

				Y.sled.gsled.sleds[initialSledId] = initialSled;	// doesn't help much as sledsList just wipes it out again

				initialSled.tasks = initialTasks;

				initialSled.requestedDetails = true;	// just to say we tried

				Y.fire( 'sled:renderSled', initialSled );

			}

	}

	function initialRender() {

		timeLog( "rendering tasks and sled from initialRender (sled loaded) ", 1 );

		sledCodeLoaded = true;

		initialTaskRender();

		hideTaskListLoading();
		showSuggestionsLoading();

		initialSledRender();
	}

	timeLog( "load initial modules YUI modules ", 3 );
	Y.use(
			// common
			'node-base',
			'json-parse',
			// 'querystring',
			'dd-delegate',
			'substitute',
			'overlay',

		function(Y) {

			if( debug ) {

				Y.use(

					'test',

					// for multiple debug requests
					'sledglobal',
					'sledtemplates',
					'sleddnd',
					'sledtasklist',
					'sledsled',

					initialRender
				);

			} else {

				if( !Y.assert || !debug ) {
					Y.assert = function(){};
				}
				Y.assert( Y.assert );

				Y.use(

					// for one batch request
					'sled',
					'sledtasklist',
					'sledsled',

					initialRender
				);

			}

	});

	Y.use('node-base', 'oop', 'node-focusmanager', function(Y) {

	    Y.use('sled-menu', function(Y) {

		    var accountmenu = Y.one('#account');
		    accountmenu.plug(Y.Plugin.NodeMenuNav);

		    /*for now, make this global var*/ sledsmenu = Y.one('#sleds-list');
		    sledsmenu.plug(Y.Plugin.NodeMenuNav);

		    var participantsmenu = Y.one('#sled-participants');
		    participantsmenu.plug(Y.Plugin.NodeMenuNav);
	    });
	});


	// =============================== load initial modules ===============================
	timeLog( "native applying/using all/advanced YUI modules ", 3 );
	Y.use(
			'overlay',
			'event-key',
			'anim',	// base not good enough for easing
			'sled-menu',

			// for tooltips
			"event-mouseenter",
			"widget",
			"widget-position",
			"widget-stack",

			"history",

			'sled-overlay-extras',	// brought from YUI/gallery-land into sled fold for https issues
			'sled-calendar',

			'sledglobal',
			'sledhistory',
			'sleduser',
			'sledsuggestionlist',
			'slednetwork',
			'sledstream',
			'sledsettings',
			'sledtemplates',
			'sledsledlist',
			'sledsled',
			'sledtasklist',
			'sleddnd',
			'sledcontacts',
			'sledtooltips',
			'sleduiutils',
			'sledtips',
			'sledtour',

		function(Y) {

			timeLog( "done loading sled ", 2 );

	});

	resizeListBox();
	showTaskListLoading();
}

