/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* sled module - take care of everything to do with a sled that isn't tasks or suggestions
*
*
*/

YUI.add('sledsled', function (Y) {

	var gsled = Y.sled.gsled;
	// now in Y.sled.sled var calendar ;
	var sledInputTitleOverlay;


	// renderSled will also fetch more data (including details and tasks) as needed
	// if details get more complicated, then factor them out instead of reusing renderSled

	function renderSled(sled, force) {

		if (!sled || ( sled._networkRequestStatusCode && sled._networkRequestStatusCode !== 200 ) || !sled.id && !force) {
			Y.log( 'renderSled - no data: ' + JSON.stringify( sled ) ) ;
			return; // todo: revisit why this is necessary
		}

		Y.assert(sled);

		gsled.sled = sled; // set active sled

		var prevSled = gsled.sleds[sled.id];

		if (!prevSled) {
			prevSled = sled; // blank/new sled
		}

		if (prevSled) {

			// replace wholeasle in dict (by key), and in array by index
			// to flush/fill-out what was already prime
			gsled.sleds[prevSled.id] = sled; 
			gsled.sleds[prevSled.index] = sled; 

			// prepoluate with previous sled data (same id), 
			// paying attention to pending requests, 
			// to avoid rerequests
			sled.index = sled.index || prevSled.index ;
			sled.requestedDetails = prevSled.requestedDetails;
			sled.requestedTasks = prevSled.requestedTasks;
			sled.requestedTips = prevSled.requestedTips;
			sled.requestedSuggestions = prevSled.requestedSuggestions;
			sled.tasks = sled.tasks || prevSled.tasks;
			sled.tips = sled.tips || prevSled.tips;
			sled.suggestions = sled.suggestions || prevSled.suggestions;
			sled.place = sled.place || prevSled.place;
			sled.date = sled.date || prevSled.date;
			sled.time = sled.time || prevSled.time;
			sled.participants = sled.participants || prevSled.participants;
			sled.subscribed = prevSled.subscribed;
		}


		renderSledDetails( sled ) ;

		renderSledParticipants( sled ) ;


		// if needed, get sled tasks, then render tasks (even if empty)
		// note that we pass sled.id as the sled object may be/become defunct by the time the request returns 
		// (from getting more sled data/detaisl)

		// done in prevSled sled.tasks = Y.sled.initialTasks ;
		if (sled.id === Y.sled.initialSledId) {

			// once we've rendered sled, dump the initial cache, get tips, sugs, etc
			Y.sled.initialTasks = Y.sled.initialSledId = null; 

		} else {

			// do not refretch/rerender details we aleady have  

			renderSledTasks( sled ) ;

			renderSledTips( sled ) ;

			renderSledSuggestions( sled ) ;

			// set active sled
			if (sled.id) {
				// jslint is concerned function confirmSavedActiveSled(response, myarg) {
				var confirmSavedActiveSled = function(response, myarg) {
					if (!response || ( response.status !== 'ok' ) ) {
						Y.log( 'error storing active sled from renderSled ' + JSON.stringify( response ) ) ;
					}
				} ;
				var json = '{"value":"' + sled.id + '"}';
				postJson( '/storage/activesled', json, confirmSavedActiveSled);
			}

		}


		// show detail area now that it's valid
		// var sleddetails = Y.one("#sled-details");
		// sleddetails.removeClass("sled-loading");
		var sleddetailsbar = Y.one("#sled-details-bar");
		sleddetailsbar.removeClass("hidden");

		// show participants menu now that it's valid
		var participantsmenu = Y.one("#sled-participants");
		participantsmenu.removeClass("sled-loading");
		setTimeout(function () { participantsmenu.one('#sled-participants-menu').removeClass("sled-loading"); }, 1000);

		// show sleds menu area - even though the underlying sled list may not yet be populated,
		// it's worth showing just for the current sled title
		// todo: do not let the underlying menu be clickable until the sled list is populated / valid
		var sledsmenu = Y.one("#sleds-list");
		// todo: figure out why immediate removal of class doesn't work var sledoptions = Y.one( "#sleds-menu" ) ;
		setTimeout(function () { sledsmenu.removeClass("sled-loading"); }, 0);
		setTimeout(function () { sledsmenu.one('#sleds-menu').removeClass("sled-loading"); }, 1000);
		// setTimeout( function() { sledsmenu.one('#sleds').removeClass("sled-loading"); }, 1000 ) ;

		// conditional display of menu item
		var joinSled = Y.one("#join-sled");
		if (sled.isPending) {
			joinSled.removeClass('sled-loading');
		} else {
			joinSled.addClass('sled-loading');
		}

		// if pending, be proactive upon rendering and ask user to join sled
		if (sled.isPending) {
			Y.fire( 'sled:askJoinCurrentSled', true ) ;
		}

		// uncover any loading blockers
		Y.fire( 'sled:checkUncover' );

		// start getting updates on sled (this automatically unsubscribes from other sleds)
		if (Y.sled.stream) {
			Y.fire( 'sled:subscribeSled', sled ) ;
		}

		// document.location.href = document.location.href.split('#')[0] + '#sled=' + sled.id;
		if (Y.sled.history) {
			Y.sled.history.hash.replace({ sled: sled.id });
		}

	}


	// render sled details such as title, date, time, place

	function renderSledDetails( sled ) {

		// sled name/title
		var html = Y.sled.templates.sledTitle( sled.title ) ;
		var sledInputTitle = Y.one('#sled-title-input');
		sledInputTitle.set('value', html);
		var sledTitle = Y.one('#sled-title');
		sledTitle.setContent(html); // no em's as it's not that kind of menu

		// details including date, time, and place
		var placeN = Y.one('#sled-details .place');
		var dateN = Y.one('#sled-details .date');
		var timeN = Y.one('#sled-details .time');
		var placeT = "";
		var timeT = "";
		var dateAndTimeT = "";

		// if needed, get sled details (place, date, time) (psuedo-recurse)
		// otherwise render already present details
		if (!sled.requestedDetails && sled.id !== "") {
			sled.requestedDetails = true; // just to say we've tried
			getJson( "/project/" + sled.id, renderSled); 
		} else {
			// they may be blank on purpose rather than an initial conditoon
			placeT = sled.place || "";
			dateAndTimeT = displayStringFromDate(sled.date);
			timeT = displayStringFromTime(sled.time);
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


	// render sled participants menu

	function renderSledParticipants( sled ) {

		if (!gsled.sled.participants || !(gsled.sled.participants instanceof Array)) {
			gsled.sled.participants = [];
		}

		var html = "";
		if (sled.participants && sled.participants.length > 0) {

			var pm = Y.one('#sled-participants');
			var sm = Y.one('#sleds-menu');
			var deleteSledMenuItem = Y.one("#sleds-list #delete-sled");
			if (sled.participants[0].id === Y.sled.gsled.profile.id) {
				deleteSledMenuItem.removeClass('sled-loading');
				if (sled.participants.length > 1) {
					pm.one('.launch-manage-menu-item').removeClass('sled-loading');
				} else {
					pm.one('.launch-manage-menu-item').addClass('sled-loading');
				}
				sm.one('.leave-sled-menu-item').addClass('sled-loading');
			} else {
				deleteSledMenuItem.addClass('sled-loading');
				sm.one('.leave-sled-menu-item').removeClass('sled-loading');
				pm.one('.launch-manage-menu-item').addClass('sled-loading');
			}

			var i,l ;	// at least try to keep jslint from being so unhappy
			for ( /* var */ i=0, l=sled.participants.length; i < l; ++i) {
				var participant = sled.participants[i];
				sled.participants[participant.id] = participant;
				html += Y.sled.templates.participantMenuItem( participant ) ;
			}

			var participantsCount = Y.one('#participants-count');
			participantsCount.setContent(sled.participants.length);
			if (sled.participants.length > 1) {
				pm.addClass('multi-participants');
			}
			else {
				pm.removeClass('multi-participants');
			}
			if (sled.participants.length > 9) {
				participantsCount.addClass('two-digits');
			}
			else {
				participantsCount.removeClass('two-digits');
			}
		}
		var participants = Y.all('#participants');
		participants.setContent(html);

	}


	// render sled tasks

	function renderSledTasks( sled ) {			
		// tasks
		if (!sled.requestedTasks && sled.id && sled.id !== "") {
			sled.requestedTasks = true; // just to say we tried
			getJson( "/project/" + sled.id + "/tasks", function( tasks, sledId ){ Y.fire( 'sled:renderTasks', tasks, sledId ) ; }, sled.id ) ;
		} else {	
			// clear even if not tasks
			Y.fire( 'sled:renderTasks', sled.tasks, sled.id ) ;	
		}
	}


	// render sled tips

	function renderSledTips( sled ) {			
		// tips (start here w tips, using events instead of calls)
		if (!sled.requestedTips && sled.id && sled.id !== "") {
			sled.requestedTips = true; // just to say we tried
			getJson( "/project/" + sled.id + "/tips", function( tips, sledId ){ Y.fire( 'sled:renderTips', tips, sledId ) ; }, sled.id ) ;
		} else {	
			// clear even if no tips
			Y.fire( 'sled:renderTips', sled.tips, sled.id ) ;
		}
	}


	// render sled suggestions

	function renderSledSuggestions( sled ) {			
		// and suggestions
		if (!sled.requestedSuggestions && sled.id && sled.id !== "") {
			sled.requestedSuggestions = true; // just to say we tried
			getJson( "/project/" + sled.id + "/suggestions", function( suggestions, sledId ){ Y.fire( 'sled:renderSuggestions', suggestions, sledId ) ; }, sled.id);
		} else {	
			// clear even if no suggestions
			Y.fire( 'sled:renderSuggestions', sled.suggestions, sled.id ) ;
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
			j = d.getFullYear() + "-" + ((d.getMonth() + 1) >= 10 ? (d.getMonth() + 1) : ("0" + (d.getMonth() + 1))) + "-" + ((d.getDate() >= 10) ? (d.getDate()) : ("0" + (d.getDate()))) ;
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
			var t1 = ta[1] > 9 ? " " + ta[1] : "0" + ta[1];	// space keeps jslint less unhappy
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

	function setDate( d ) {

		var sled = gsled.sled;
		var dateN = Y.one('#sled-details .date');

		var j ;
		if( d === '' ) {
			j = d ;
		} else if( typeof d === 'string' ) {
			j = jsonStringFromDate( new Date(d) );
		} else {
			j = jsonStringFromDate(d);
		}

		if (j === sled.date) {
			// no op

		} else if (j && !isValidDate(d) && j!=='') {	// empty ok

			dateN.set('value', displayStringFromDate(sled.date));

		} else {

			// valid and different date
			var confirmDateAndTime = function(response, myarg) {

				if (response.status === "ok") {

					// commit to data (UI already changed)
					sled.date = j || "";

				} else {

					// restore date and time UI
					var dateN = Y.one('#sled-details .date');
					var ods = displayStringFromDate( sled.date );
					dateN.set('value', ods);

					Y.log( 'error setting date / time ' + JSON.stringify( response ) ) ;

				}
			} ;

			var jsonStruct = { date: j };
			var jsonString = JSON.stringify(jsonStruct);
			postJson( "/project/" + sled.id, jsonString, confirmDateAndTime);
		}

		var ds = displayStringFromDate(d);
		dateN.set('value', ds);
	}


	// prompt the user about joining the sled, 
	// and retry any request that failed perms and caused the prompt

	function askJoinCurrentSled( ask, retryCallback ) {

		function joinCurrentSled() {

			function confirmJoinSled(response, myarg) { // response has id, rev, status

				if (response.status === "ok") {

					delete Y.sled.gsled.sled.isPending; // = false ;
					delete Y.sled.gsled.sled.participants[Y.sled.gsled.profile.id].isPending;

					// rerender all sleds to ensure the sleds menu looks correct wrt pending etc
					// and rerender active sled to correct join menu option
					Y.fire( 'sled:renderSleds', Y.sled.gsled.sleds, true ) ;

					Y.fire( 'sled:statusMessage', 'Joined sled' ) ;

					if( retryCallback ) {
						retryCallback() ;
					}

				} else {

					// orig call err hndlr should fix this window.location.reload(); 

					Y.fire( 'sled:errorMessage',  'Error joining sled ' + JSON.stringify( response ) ) ;

				}

			}

			postJson("/project/" + Y.sled.gsled.sled.id + '/join', null, confirmJoinSled);

		}

		function revertSled() {
					// orig call err hndlr should fix this window.location.reload(); 
		}

		if( !ask ) {
			joinCurrentSled() ;
		} else {
			Y.fire( 'sled:confirm', 'Join this sled?', 'Joining allows you to make changes. You can always leave later.', joinCurrentSled, null, revertSled, null);
		}

	}


	// bind UI - including details (date, time, place), tips, menu, events

	function bind() {

		// sled title

		var sledInputTitleNode = Y.one("#sled-title-input-overlay");
		var sledTitle = Y.one('#sled-title');
		var sledInputTitle = Y.one("#sled-title-input");

		// create overlay to lay over sled title to accept input for [re]naming
		sledInputTitleOverlay = new Y.Overlay({
			srcNode: sledInputTitleNode,
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
		sledInputTitleOverlay.render();

		// when sled title is clicked, overlay the temporary input field for user input to name/rename
		sledTitle.on('click', function () {

			var w = sledTitle.getComputedStyle('width');
			w = parseInt(w, 10) - 10;
			w = w + 'px'; // presume w was in pixels
			sledInputTitle.setStyle('width', w);

			sledInputTitleOverlay.set('align', {
				node: "#sled-title",
				points: [Y.WidgetPositionAlign.LC, Y.WidgetPositionAlign.LC]
			});

			sledInputTitle.set('value', Y.sled.gsled.sled.title);

			sledInputTitleOverlay.show();
			sledInputTitle.focus();
		});

		// preselect the input field's text when given focus
		sledInputTitle.on('focus', function () {
			setTimeout(Y.bind(sledInputTitle.select, sledInputTitle), 100) ;
		});

		// update sled title, hide input field, and restore anchor
		// when user finishes focusing on it (and it's changed)
		sledInputTitle.on('blur', function (e) {

			sledInputTitleOverlay.hide();

			var sled = gsled.sled;
			var title = sledInputTitle.get('value');
			if (!title) {
				sledInputTitle.set('value', sled.title);
				return;
			}

			sledTitle.setContent(title);

			var json = '{"title":"' + title + '"}';

			function confirmChangedSled(response, myarg) { // response has id, rev, status

				if(response.status === "ok") {

					sled.title = title;

					sled.rev = response.rev;

					// need to renderSleds menu for both adding and changing sled names
					// just to repop the menu of sleds with prop id, do not set and render last/active sled
					Y.fire( 'sled:renderSleds', gsled.sleds, false ) ;

				} else {

					// restore UI in case of error
					sledTitle.setContent(sled.title);
					sledInputTitle.set('value', sled.title);   

				}
			}

			postJson( "/project/" + sled.id, json, confirmChangedSled);
		});

		// handle return and escape
		sledInputTitle.on('keydown', function (e) {
			if (e.keyCode === 13) {	// return
				sledInputTitle.blur();
			}
			if (e.keyCode === 27) {	// escape
				var sled = gsled.sled;
				sledInputTitle.set('value', sled.title);
				sledInputTitle.blur();
			}
		});


		// sled date

		var dateN = Y.one('#sled-details .date');

		// launch calendar, give sled new date if it doesn't have one
		dateN.on('focus', function (e) {

			// delay this binding until needed so it has time to load, init
			if( !Y.sled.sled.calendar ) {
				bindCalendar();
			}

			var sledDate = gsled.sled.date ? new Date(gsled.sled.date) : new Date();
			Y.sled.sled.calendar.render({ selected: sledDate, date: sledDate });
			setTimeout(Y.bind(dateN.select, dateN), 0) ;
		});

		// process new date when field looses user's focus
		dateN.on('blur', function (e) {
			var sled = gsled.sled;
			var dateInput = dateN.get('value');
			setDate( dateInput ) ;
		});

		// pay attention to escape and return
		dateN.on('keydown', function (e) {
			var sled = gsled.sled;
			if (e.keyCode === 13) {	// return
				dateN.blur();
				Y.sled.sled.calendar.hide();
			}
			if (e.keyCode === 27) {	// escape
				dateN.set('value', displayStringFromDate(sled.date));
				dateN.blur();
				Y.sled.sled.calendar.hide();
			}
		});


		// sled time

		var timeField = Y.one("#sled-details .time");

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

			var sled = gsled.sled;
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
				if( response.status === 'ok' ) {
					sled.time = newTime ;
				} else {
					newContents = displayStringFromTime(sled.time);
					timeField.set('value', newContents);
					Y.log( 'error setting time ' + JSON.stringify( response ) ) ;
				}
			}
			var json = JSON.stringify(update);
			postJson( "/project/" + sled.id, json, confirmChangedTime);
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
			var sled = gsled.sled;
			if (e.keyCode === 13) {	// return
				timeField.blur();
			}
			if (e.keyCode === 27) {	// escape
				timeField.set('value', displayStringFromTime(sled.time));
				timeField.blur();
			}
		});


		// sled place

		var place = Y.one("#sled-details .place");

		// select text when receiving focus	
		place.on('focus', function (e) {
			// e.currentTarget.select() ;
			setTimeout(Y.bind(e.currentTarget.select, e.currentTarget), 100);
		});

		// process place when loosing focus
		function onPlace(e) {

			var sled = gsled.sled;
			// gsled.onPlaceHandler = place.on( 'click', onPlace );	
			var placeInput = place.get('value');
			var newContents = placeInput || ""; // renderSled does this as well
			var json = '{"place":"' + placeInput + '"}';
			function confirmChangedPlace(response, myarg) { // response has id, rev, status
				if( response.status === 'ok' ) {
					sled.place = placeInput;	// following line handles blank input
				} else {
					newContents = sled.place || ""; // renderSled does this as well
					place.set('value', newContents);
					Y.log( 'error setting place ' + JSON.stringify( response ) ) ;
				}
			}
			postJson( "/project/" + sled.id, json, confirmChangedPlace);
		}
		gsled.onPlaceHandler = place.on('blur', onPlace);

		// handle return and escape keys
		var placeN = Y.one('#sled-details .place');
		placeN.on('keydown', function (e) {
			if (e.keyCode === 13) {	// return
				placeN.blur();
			}
			if (e.keyCode === 27) {	// escape
				var sled = gsled.sled;
				placeN.set('value', sled.place || "");
				placeN.blur();
			}
		});


		// sled menu incl logout, settings, tour

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
				Y.fire( 'sled:launchTour' ) ;
			});
		}

		var prefs = Y.one("#account-menu #mysettings");
		if (prefs) {
			prefs.on('click', function (e) {
				// used to open and collapse prefs submenu, now clear storage to help with debug
				function confirmDeleteSettings( response ) {
					Y.log( 'deleted storage/settings' ) ;
				}
				deleteJson( "/storage/settings", null, confirmDeleteSettings ) ;
			});
		}


		// event handling 

		Y.on( "sled:askJoinCurrentSled", function( retryRequest ) {
			askJoinCurrentSled( retryRequest ) ;
		});

		Y.on( "sled:renderSled", function( sled, force ) {
			renderSled( sled, force ) ;
		});

		Y.on( "sled:renderSledParticipants", function( sled ) {
			renderSledParticipants( sled ) ;
		});

	}

	function bindCalendar() {
		Y.sled.sled.calendar = new Y.Calendar('date', {});
		Y.sled.sled.calendar.on('select', function (d) {
			Y.sled.sled.setDate(d);
		});
	}

	Y.namespace("sled.sled");
	Y.sled.sled = {
		setDate: setDate,	// make event?
		last: null
	};

	bind();

}, "1.0.0", { requires: ["sledglobal", 'slednetwork', 'node'] });
