/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* sledlist module
*
*	manage (render, select, delete, create) list of projects (currently in projects menu)
*	perhaps later allow more management like reordering
*
*
*/ 

YUI.add('postmile-projects-list', function(Y) {

var gpostmile = Y.sled.gpostmile ;


// render

function renderProjects( projects, renderMostRecentProject ) {

	var i,l ;	// make jslint as happy as it can be about this

	// if projects is not null, it's an array w length
	if (!projects || ( projects._networkRequestStatusCode && projects._networkRequestStatusCode !== 200 ) ) {
		Y.log( 'renderProjects - no data: ' + JSON.stringify( projects ) ) ;
		return;
	}

	// set active projects
	gpostmile.projects = projects ;

	var html = "" ;
	var mostRecentProject = gpostmile.sled ;	// same as gpostmile.projects[gpostmile.activeProjectId] ;

	for ( i=0, l=projects.length; i < l; ++i) {

		var sled = projects[i] ;

		sled.index = i ;	// for convenience if we have only key and want to find place in array
		gpostmile.projects[sled.id] = sled ;	// prime

		if( !mostRecentProject && ( !gpostmile.activeProjectId || sled.id === gpostmile.activeProjectId ) ) {
			mostRecentProject = sled ;
		} 

		html += Y.sled.templates.sledMenuItem( sled, mostRecentProject ) ;
	} 

	html += "" ;

	if( !mostRecentProject ) {
		mostRecentProject = gpostmile.projects[ 0 ] ;
	}

	var sledsNode = Y.one('#projects');
	sledsNode.setContent(html);

	// put back the initial sled so we don't get a double load - just this once
	if( initialProjectId && initialProject ) {
		gpostmile.projects[initialProjectId] = initialProject ;
		for ( i=0, l=gpostmile.projects.length; i < l; ++i) {
			if( gpostmile.projects[i].id === initialProject.id ) {
				gpostmile.projects[i] = initialProject ;
				gpostmile.projects[i].index = i ;
			}
		}
	}

	if( renderMostRecentProject ) {
		if( mostRecentProject ) {
			Y.fire( 'sled:renderProject', mostRecentProject ) ;		// may be incomlpete, but call will prime to get details and tasks
		} else {
			makeAndRenderNewProject();
		}
	} else {
	}

	// put this here as well as in sled.js just in case sled is not rendered
	var sledsMenuLabel = Y.one( "#projects-list" ) ;
	// for some reason, immediate removal of class doesn't work - delay even of 0 does
	setTimeout( function() { sledsMenuLabel.removeClass("sled-loading"); }, 0 ) ;
	setTimeout( function() { sledsMenuLabel.one('#projects-menu').removeClass("sled-loading"); }, 1000 ) ;

	// configure menu for the state of this sled 
	if( mostRecentProject ) {
		removeProjectFromMenu( mostRecentProject.id ) ;
	}

	if( Y.sled.dnd ) {
		Y.sled.dnd.sledsDnd() ; // takes care of create, sync, etc
	}

	Y.fire( 'sled:checkUncover' ) ;
}


// remove sled from menu - hide it if it's selected, as it shows in the menu label on top

function removeProjectFromMenu( projectId ) {
	if( Y.sled.settings && Y.sled.settings.sledsReorder() ) {
		return null ;
	}
	var sledsMenu = Y.one( "#projects-list #projects" ) ;
	sledMenuAnchors = sledsMenu.all( ".sled a" ) ;
	sledMenuAnchors.removeClass( 'sled-loading' ) ;
	selectedProjectMenuLink = sledsMenu.one('li[sled="' + projectId + '"]') ;
	selectedProjectMenuAnchor = selectedProjectMenuLink.one('a');
	selectedProjectMenuAnchor.addClass( 'sled-loading' ) ;
}


// create a new sled to render

function makeAndRenderNewProject() {

	var myNewProject = {
		"id": "",
		"title": "Name your new sled",
		"participants": [ ],
		"tasks": [ ]
		} ;

	// add to projects array (not done by renderProject), to the beginning
	gpostmile.projects.unshift( myNewProject );	

	// new/empty active/selected sled, needs to be done before renderProjects because renderProject adds the sled arg to the projects
	Y.fire( 'sled:renderProject', myNewProject, true ) ;

	// dismiss menu just in case we're creating a new sled because the user selected 'create' from the menu
	// could make a menu-specific callback to do just this
	var myProjectsMenu = Y.one( "#projects-menu" ) ;
	myProjectsMenu.addClass( 'menu-hidden' ) ;

	function confirmAddedProject( response, myarg ) { // response has id, rev, status

		if( response.status === 'ok' ) {

			myNewProject.rev = response.rev ;	

			myNewProject.id = response.id ;
			gpostmile.projects[myNewProject.id] = myNewProject ;	// needs to be added to projects keys again with new id 


			if( !myNewProject.requestedSuggestions && myNewProject.id !== "" ) {

				myNewProject.requestedSuggestions = true ;
				getJson( "/project/" + myNewProject.id + "/suggestions",
						function( suggestions, projectId ){ Y.fire( 'sled:renderSuggestions', suggestions, projectId ) ; }, myNewProject.id ) ;

			} else {	

				// clear even if no suggestions
				Y.fire( 'sled:renderSuggestions', myNewProject.suggestions, myNewProject.id ) ;

			}

			if( !myNewProject.requestedTips && myNewProject.id !== "" ) {

				myNewProject.requestedTips = true ;	// just to say we tried
				getJson( "/project/" + myNewProject.id + "/tips", 
						function( tips, projectId ){ Y.fire( 'sled:renderTips', tips, projectId ) ; }, myNewProject.id ) ;	

			} else {	

				// clear even if no suggestions
				Y.fire( 'sled:renderTips', myNewProject.tips, myNewProject.id ) ;

			}

			// need to renderProjects menu for both adding and changing sled names
			// just to repop the menu of projects with prop id, do not set and render last/active sled
			renderProjects( gpostmile.projects, false ) ;

			document.location.href = document.location.href.split('#')[0] + '#sled=' + myNewProject.id ;

		} else {

			Y.log( 'error adding sled ' + JSON.stringify( response ) ) ;

		}
	}

	var json = '{"title":"' + myNewProject.title + '"}'  ;
	putJson( "/project", json, confirmAddedProject ) ;

}


// reorder

function reorder( dragNode ) {

	var dropNode = dragNode.get( 'nextSibling' ) ;
	var dropIndex = gpostmile.projects.length ;
	if( dropNode ) {
		var dropId = dropNode.getAttribute('sled') ;
		if( dropId ) {	// might've been on other kind of item/node
			var dropProject = gpostmile.projects[dropId] ;
			dropIndex = dropProject.index ;
		}
	}

	var dragId = dragNode.getAttribute('sled') ;
	var dragProject = gpostmile.projects[dragId] ;
	var dragIndex = dragProject.index ;

	if( dragIndex < dropIndex ) {
		dropIndex--;
	}

	if( dragProject.index !== dropIndex ) {

		// post new order
		var confirmOrder = function( response, myarg ) {

			if( response.status === 'ok' ) {

				// change array order
				var dragSplice = gpostmile.projects.splice( dragIndex, 1 ) ;
				gpostmile.projects.splice( dropIndex, 0, dragSplice[0] ) ;

				// update index fields
				if( gpostmile.projects ) {	// just update all indecies
					var i,l ;
					for (/*var*/ i=0, l=gpostmile.projects.length; i < l; ++i) {
						var sled = gpostmile.projects[i] ;
						sled.index = i ;	// for convenience if we have only key and want to find place in array
						Y.assert( gpostmile.projects[sled.id] === sled ) ;	
					}
				}

				Y.fire( 'sled:statusMessage', 'Project reordered' ) ;

			} else {

				renderProjects( gpostmile.projects, false ) ;

				Y.fire( 'sled:errorMessage',  'Project reorder failed' ) ;

			}
		} ;

		postJson( "/project/" + dragProject.id + "?position=" + dropIndex, "", confirmOrder ) ;
		// Y.log( "sled/" + dragProject.id + "?position=" + dropIndex + "  (" + dragIndex + ")" ) ;
	}

}


// delete a sled

function deleteProject( projectId ) {
	
	var sc,i,l ;	
	
	function confirmLeftProject( response, myarg ) {

		if( response.status === "ok" ) {

			// remove sled index from array
			for( sc=0 ; sc < gpostmile.projects.length ; sc++ ) {
				if( gpostmile.projects[sc].id === projectId ) {
					gpostmile.projects.splice( sc, 1 ) ;
				}
			}

			// remove sled id from dictionary
			delete gpostmile.projects[projectId] ;

			// update index fields
			if( gpostmile.projects ) {	// just update all indecies
				for ( i=0, l=gpostmile.projects.length; i < l; ++i) {
					var sled = gpostmile.projects[i] ;
					sled.index = i ;	// for convenience if we have only key and want to find place in array
					Y.assert( gpostmile.projects[sled.id] === sled ) ;	
				}
			}


			// remove from menu, go to next in menu, create new sled if needed

			var sledMenuNode = Y.one( '#projects-list #projects .sled[sled="' + projectId + '"]' ) ;

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

					// if no more projects, make another one
					makeAndRenderNewProject() ;

				} else {

					// slect and render next sled
					var newProjectId = nextNode.getAttribute('sled') ;	// get does not work
					var ssled = gpostmile.projects[newProjectId] ;

					Y.fire( 'sled:renderProject', ssled ) ;

				}

				// remove originally selected sled menu item
				sledMenuNode.remove() ;

			}

		} else {

			Y.log( 'error deleting sled ' + JSON.stringify( response ) ) ;
			Y.fire( 'sled:inform', 'Error', 'Failed to delete sled.');

		}

	}

	deleteJson( "/project/" + projectId, null, confirmLeftProject ) ;

}


// bind UI

function bind( ) {

	// bind delete sled menu item, and ask first
	var deleteProjectMenuItem = Y.one( "#projects-list #delete-sled" ) ;
	deleteProjectMenuItem.on( 'click', function( e ) {
		Y.fire( 'sled:confirm',  
			'Delete sled?', 
			'Deleting the sled will remove all the items and details. This change will delete the sled for all participants and it is permanent.', 
			deleteProject, 
			gpostmile.sled.id ) ;
	});

	var leaveProjectMenuItem = Y.one( ".leave-sled" ) ;
	leaveProjectMenuItem.on( 'click', function( e ) {
		var pm = Y.one('#sled-participants-menu') ;
		pm.addClass( 'menu-hidden' ) ;
		Y.fire( 'sled:confirm', 
			'Leave this Project?', 
			'You will not be able to join unless invited back by another participant.', 
			deleteProject, 
			gpostmile.sled.id ) ;
	});

	// bind join sled menu item, and ask first
	var joinProjectMenuItem = Y.one( "#projects-list #join-sled" ) ;
	joinProjectMenuItem.on( 'click', function( e ) {
		Y.fire( 'sled:askJoinCurrentProject', true ) ;	// if false, don't ask, just do it
	});

	// bind create new sled menu item
	var newProject = Y.one( "#projects-list #newsled" ) ;
	newProject.on('click', makeAndRenderNewProject ) ;

	// allow user to switch projects via menu
	var sledsMenu = Y.one( "#projects-list #projects" ) ;
	sledsMenu.delegate('click',function (e) {

		var projectId = e.currentTarget.getAttribute('sled') ;	// get does not always work
		var ssled = gpostmile.projects[projectId] ;

		// if sled does not have details, this will get them
			Y.fire( 'sled:renderProject', ssled ) ;


		// remove sled from menu, as it shows in the menu label on top
		removeProjectFromMenu( ssled.id ) ;

		// show menus once bound
		Y.one("#projects-menu").addClass( 'menu-hidden' ) ;
		Y.one("#projects-menu").previous().removeClass( 'menu-label-menuvisible' ) ;
		Y.one("#projects-menu").previous().removeClass( 'menu-label-active' ) ;

	}, '.sled' ) ;

	// event handlers
	Y.on( "sled:renderProjects", function( projects, renderMostRecentProject ) {
		renderProjects( projects, renderMostRecentProject ) ;
	});

	Y.on( "sled:sledReorder", function( node ) {
		reorder( node ) ;
	});

}

Y.namespace("sled").sledlist = {
} ;

bind() ;

}, "1.0.0", {requires:["postmile-global", 'postmile-network', "'postmile-projects-list'", 'node' ]} );
