/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* sledlist module
*
*	manage (render, select, delete, create) list of sleds (currently in sleds menu)
*	perhaps later allow more management like reordering
*
*
*/ 

YUI.add('sledsledlist', function(Y) {

var gsled = Y.sled.gsled ;


// render

function renderSleds( sleds, renderMostRecentSled ) {

	var i,l ;	// make jslint as happy as it can be about this

	// if sleds is not null, it's an array w length
	if (!sleds || ( sleds._networkRequestStatusCode && sleds._networkRequestStatusCode !== 200 ) ) {
		Y.log( 'renderSleds - no data: ' + JSON.stringify( sleds ) ) ;
		return;
	}

	// set active sleds
	gsled.sleds = sleds ;

	var html = "" ;
	var mostRecentSled = gsled.sled ;	// same as gsled.sleds[gsled.activeSledId] ;

	for ( i=0, l=sleds.length; i < l; ++i) {

		var sled = sleds[i] ;

		sled.index = i ;	// for convenience if we have only key and want to find place in array
		gsled.sleds[sled.id] = sled ;	// prime

		if( !mostRecentSled && ( !gsled.activeSledId || sled.id === gsled.activeSledId ) ) {
			mostRecentSled = sled ;
		} 

		html += Y.sled.templates.sledMenuItem( sled, mostRecentSled ) ;
	} 

	html += "" ;

	if( !mostRecentSled ) {
		mostRecentSled = gsled.sleds[ 0 ] ;
	}

	var sledsNode = Y.one('#sleds');
	sledsNode.setContent(html);

	// put back the initial sled so we don't get a double load - just this once
	if( initialSledId && initialSled ) {
		gsled.sleds[initialSledId] = initialSled ;
		for ( i=0, l=gsled.sleds.length; i < l; ++i) {
			if( gsled.sleds[i].id === initialSled.id ) {
				gsled.sleds[i] = initialSled ;
				gsled.sleds[i].index = i ;
			}
		}
	}

	if( renderMostRecentSled ) {
		if( mostRecentSled ) {
			Y.fire( 'sled:renderSled', mostRecentSled ) ;		// may be incomlpete, but call will prime to get details and tasks
		} else {
			makeAndRenderNewSled();
		}
	} else {
	}

	// put this here as well as in sled.js just in case sled is not rendered
	var sledsMenuLabel = Y.one( "#sleds-list" ) ;
	// for some reason, immediate removal of class doesn't work - delay even of 0 does
	setTimeout( function() { sledsMenuLabel.removeClass("sled-loading"); }, 0 ) ;
	setTimeout( function() { sledsMenuLabel.one('#sleds-menu').removeClass("sled-loading"); }, 1000 ) ;

	// configure menu for the state of this sled 
	if( mostRecentSled ) {
		removeSledFromMenu( mostRecentSled.id ) ;
	}

	if( Y.sled.dnd ) {
		Y.sled.dnd.sledsDnd() ; // takes care of create, sync, etc
	}

	Y.fire( 'sled:checkUncover' ) ;
}


// remove sled from menu - hide it if it's selected, as it shows in the menu label on top

function removeSledFromMenu( sledId ) {
	if( Y.sled.settings && Y.sled.settings.sledsReorder() ) {
		return null ;
	}
	var sledsMenu = Y.one( "#sleds-list #sleds" ) ;
	sledMenuAnchors = sledsMenu.all( ".sled a" ) ;
	sledMenuAnchors.removeClass( 'sled-loading' ) ;
	selectedSledMenuLink = sledsMenu.one('li[sled="' + sledId + '"]') ;
	selectedSledMenuAnchor = selectedSledMenuLink.one('a');
	selectedSledMenuAnchor.addClass( 'sled-loading' ) ;
}


// create a new sled to render

function makeAndRenderNewSled() {

	var myNewSled = {
		"id": "",
		"title": "Name your new sled",
		"participants": [ ],
		"tasks": [ ]
		} ;

	// add to sleds array (not done by renderSled), to the beginning
	gsled.sleds.unshift( myNewSled );	

	// new/empty active/selected sled, needs to be done before renderSleds because renderSled adds the sled arg to the sleds
	Y.fire( 'sled:renderSled', myNewSled, true ) ;

	// dismiss menu just in case we're creating a new sled because the user selected 'create' from the menu
	// could make a menu-specific callback to do just this
	var mySledsMenu = Y.one( "#sleds-menu" ) ;
	mySledsMenu.addClass( 'menu-hidden' ) ;

	function confirmAddedSled( response, myarg ) { // response has id, rev, status

		if( response.status === 'ok' ) {

			myNewSled.rev = response.rev ;	

			myNewSled.id = response.id ;
			gsled.sleds[myNewSled.id] = myNewSled ;	// needs to be added to sleds keys again with new id 


			if( !myNewSled.requestedSuggestions && myNewSled.id !== "" ) {

				myNewSled.requestedSuggestions = true ;
				getJson( "sled/" + myNewSled.id + "/suggestions",
						function( suggestions, sledId ){ Y.fire( 'sled:renderSuggestions', suggestions, sledId ) ; }, myNewSled.id ) ;

			} else {	

				// clear even if no suggestions
				Y.fire( 'sled:renderSuggestions', myNewSled.suggestions, myNewSled.id ) ;

			}

			if( !myNewSled.requestedTips && myNewSled.id !== "" ) {

				myNewSled.requestedTips = true ;	// just to say we tried
				getJson( "sled/" + myNewSled.id + "/tips", 
						function( tips, sledId ){ Y.fire( 'sled:renderTips', tips, sledId ) ; }, myNewSled.id ) ;	

			} else {	

				// clear even if no suggestions
				Y.fire( 'sled:renderTips', myNewSled.tips, myNewSled.id ) ;

			}

			// need to renderSleds menu for both adding and changing sled names
			// just to repop the menu of sleds with prop id, do not set and render last/active sled
			renderSleds( gsled.sleds, false ) ;

			document.location.href = document.location.href.split('#')[0] + '#sled=' + myNewSled.id ;

		} else {

			Y.log( 'error adding sled ' + JSON.stringify( response ) ) ;

		}
	}

	var json = '{"title":"' + myNewSled.title + '"}'  ;
	putJson( "sled", json, confirmAddedSled ) ;

}


// reorder

function reorder( dragNode ) {

	var dropNode = dragNode.get( 'nextSibling' ) ;
	var dropIndex = gsled.sleds.length ;
	if( dropNode ) {
		var dropId = dropNode.getAttribute('sled') ;
		if( dropId ) {	// might've been on other kind of item/node
			var dropSled = gsled.sleds[dropId] ;
			dropIndex = dropSled.index ;
		}
	}

	var dragId = dragNode.getAttribute('sled') ;
	var dragSled = gsled.sleds[dragId] ;
	var dragIndex = dragSled.index ;

	if( dragIndex < dropIndex ) {
		dropIndex--;
	}

	if( dragSled.index !== dropIndex ) {

		// post new order
		var confirmOrder = function( response, myarg ) {

			if( response.status === 'ok' ) {

				// change array order
				var dragSplice = gsled.sleds.splice( dragIndex, 1 ) ;
				gsled.sleds.splice( dropIndex, 0, dragSplice[0] ) ;

				// update index fields
				if( gsled.sleds ) {	// just update all indecies
					var i,l ;
					for (/*var*/ i=0, l=gsled.sleds.length; i < l; ++i) {
						var sled = gsled.sleds[i] ;
						sled.index = i ;	// for convenience if we have only key and want to find place in array
						Y.assert( gsled.sleds[sled.id] === sled ) ;	
					}
				}

				Y.fire( 'sled:statusMessage', 'Sled reordered' ) ;

			} else {

				renderSleds( gsled.sleds, false ) ;

				Y.fire( 'sled:errorMessage',  'Sled reorder failed' ) ;

			}
		} ;

		postJson( "sled/" + dragSled.id + "?position=" + dropIndex, "", confirmOrder ) ;
		// Y.log( "sled/" + dragSled.id + "?position=" + dropIndex + "  (" + dragIndex + ")" ) ;
	}

}


// delete a sled

function deleteSled( sledId ) {
	
	var sc,i,l ;	
	
	function confirmLeftSled( response, myarg ) {

		if( response.status === "ok" ) {

			// remove sled index from array
			for( sc=0 ; sc < gsled.sleds.length ; sc++ ) {
				if( gsled.sleds[sc].id === sledId ) {
					gsled.sleds.splice( sc, 1 ) ;
				}
			}

			// remove sled id from dictionary
			delete gsled.sleds[sledId] ;

			// update index fields
			if( gsled.sleds ) {	// just update all indecies
				for ( i=0, l=gsled.sleds.length; i < l; ++i) {
					var sled = gsled.sleds[i] ;
					sled.index = i ;	// for convenience if we have only key and want to find place in array
					Y.assert( gsled.sleds[sled.id] === sled ) ;	
				}
			}


			// remove from menu, go to next in menu, create new sled if needed

			var sledMenuNode = Y.one( '#sleds-list #sleds .sled[sled="' + sledId + '"]' ) ;

			if( sledMenuNode ) {

				var nextNode = sledMenuNode.next() ;

				if( !nextNode ) {

					// if menu item was last, make next menu cycle around wrap around to first
					var firstNode = sledMenuNode.ancestor().one('*') ;
					if( firstNode !== sledMenuNode ) {
						nextNode = firstNode ;
					}
				}

				if( !nextNode ) {

					// if no more sleds, make another one
					makeAndRenderNewSled() ;

				} else {

					// slect and render next sled
					var newSledId = nextNode.getAttribute('sled') ;	// get does not work
					var ssled = gsled.sleds[newSledId] ;

					Y.fire( 'sled:renderSled', ssled ) ;

				}

				// remove originally selected sled menu item
				sledMenuNode.remove() ;

			}

		} else {

			Y.log( 'error deleting sled ' + JSON.stringify( response ) ) ;
			Y.fire( 'sled:inform', 'Error', 'Failed to delete sled.');

		}

	}

	deleteJson( "sled/" + sledId, null, confirmLeftSled ) ;

}


// bind UI

function bind( ) {

	// bind delete sled menu item, and ask first
	var deleteSledMenuItem = Y.one( "#sleds-list #delete-sled" ) ;
	deleteSledMenuItem.on( 'click', function( e ) {
		Y.fire( 'sled:confirm',  
			'Delete sled?', 
			'Deleting the sled will remove all the items and details. This change will delete the sled for all participants and it is permanent.', 
			deleteSled, 
			gsled.sled.id ) ;
	});

	var leaveSledMenuItem = Y.one( ".leave-sled" ) ;
	leaveSledMenuItem.on( 'click', function( e ) {
		var pm = Y.one('#sled-participants-menu') ;
		pm.addClass( 'menu-hidden' ) ;
		Y.fire( 'sled:confirm', 
			'Leave this Sled?', 
			'You will not be able to join unless invited back by another participant.', 
			deleteSled, 
			gsled.sled.id ) ;
	});

	// bind join sled menu item, and ask first
	var joinSledMenuItem = Y.one( "#sleds-list #join-sled" ) ;
	joinSledMenuItem.on( 'click', function( e ) {
		Y.fire( 'sled:askJoinCurrentSled', true ) ;	// if false, don't ask, just do it
	});

	// bind create new sled menu item
	var newSled = Y.one( "#sleds-list #newsled" ) ;
	newSled.on('click', makeAndRenderNewSled ) ;

	// allow user to switch sleds via menu
	var sledsMenu = Y.one( "#sleds-list #sleds" ) ;
	sledsMenu.delegate('click',function (e) {

		var sledId = e.currentTarget.getAttribute('sled') ;	// get does not always work
		var ssled = gsled.sleds[sledId] ;

		// if sled does not have details, this will get them
			Y.fire( 'sled:renderSled', ssled ) ;


		// remove sled from menu, as it shows in the menu label on top
		removeSledFromMenu( ssled.id ) ;

		// show menus once bound
		Y.one("#sleds-menu").addClass( 'menu-hidden' ) ;
		Y.one("#sleds-menu").previous().removeClass( 'menu-label-menuvisible' ) ;
		Y.one("#sleds-menu").previous().removeClass( 'menu-label-active' ) ;

	}, '.sled' ) ;

	// event handlers
	Y.on( "sled:renderSleds", function( sleds, renderMostRecentSled ) {
		renderSleds( sleds, renderMostRecentSled ) ;
	});

	Y.on( "sled:sledReorder", function( node ) {
		reorder( node ) ;
	});

}

Y.namespace("sled").sledlist = {
} ;

bind() ;

}, "1.0.0", {requires:["sledglobal", 'slednetwork', "sledsledlist", 'node' ]} );
