/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* stream module to manage streaming sockets, subscriptions, and updates
*
*
*/ 


YUI.add('sledstream', function(Y) {

// module vars
var socketMessage = {} ;
var socket ;


// subscribe allow us to listen and receieve updates to a particular sled
// although we could subscribe to multiple sleds, try to limit our subscription to just the current sled
// we automatically receive user/profile events

function subscribe( sled ) {

	if( sled && !sled.subscribed && socketMessage.session ) {

		var confirmPostStream = function( response, myarg ) {
			if( response.status === 'ok' ) {
				sled.subscribed = true ;
			} else {
				Y.log( "post " + response.status + " for " + sled.title  + ' ' + JSON.stringify(response) ) ;
			}
		} ;

		// keep subscribed so we can get updates for previously loaded sleds
		// unsubscribeAll() ;

		// it's okay to subscribe even before we get an ok reply to unsubribes
		postJson( 'stream/' + socketMessage.session + '/sled/' + sled.id, null, confirmPostStream ) ;
	}

}


// unsubscribe to all sleds with delete

function unsubscribeAll( ) {

	if( socketMessage.session ) {

		var confirmDeleteStream = function( response, sled ) {
			if( response.status === 'ok' ) {
				sled.subscribed = false ;
			} else {
				Y.log( "delete " + response.status + " for " + sled.title  + ' ' + JSON.stringify(response) ) ;
			}
		} ;

		var i,l ;
		for (/*var*/ i=0, l=Y.sled.gsled.sleds.length; i < l; ++i) {
			var sled = Y.sled.gsled.sleds[i] ;
			if( sled.subscribed ) {
				deleteJson( 'stream/' + socketMessage.session + '/sled/' + sled.id, null, confirmDeleteStream, sled ) ;
				sled.subscribed = false ;	// presume this works (we'd not do anything differently anyways)
			}
		}
	}
}


// handle message coming in on stream socket

function handleStreamMessage( message ) {

	Y.log( 'stream update ' + JSON.stringify( message ) ) ;

	if (message.type === 'connect') {

		socket.send({ type: 'initialize', id: session.id, mac: MAC.macMessage(message.session, session) });
		socketMessage.session = message.session ;

	}

	else if (message.type === 'initialize') {

		if( message.status === 'ok' ) {

			socketMessage.status = message.status ;

			// unsubscribeAll is probably too heavy, even if it's a reconnect - just reset the subscription status
			var i,l ;
			for (/*var*/ i=0, l=Y.sled.gsled.sleds.length; i < l; ++i) {
				var sled = Y.sled.gsled.sleds[i] ;
				sled.subscribed = false ;	// presume this works (we'd not do anything differently anyways)
			}

			if( Y.sled && Y.sled.gsled && Y.sled.gsled.sled ) {
				subscribe( Y.sled.gsled.sled ) ;
			}

		}

	}

	else if (message.type === 'subscribe') {
	}

	else if (message.type === 'disconnect') {

		Y.log( 'socket message disconnect ' + JSON.stringify(message)  + ' ' + JSON.stringify(message) ) ;

		// perhaps reconnect, reinitialize again

		if( Y.sled && Y.sled.gsled && Y.sled.gsled.sled ) {
			subscribe( Y.sled.gsled.sled ) ;
		}

	}

	else if( message.type === 'update' ) {

		handleStreamUpate( message ) ;

	} else {

		Y.log( 'socket message else ' + ' ' + JSON.stringify(message) ) ;

	}

}


// handle update message from stream socket

function handleStreamUpate( message ) {

	// check to see if this update is from us in this session
	// the first 8 bytes of the ID is sent in the message, so compare against just those bytes
	if( session.id.indexOf( message.macId ) === 0 ) {

		// update by my own self in this browser - no op

	} else {
		
		switch( message.object ) {
			
			case 'sleds':
			case 'sledlist': // not used
				updateSleds( message ) ;
				break ;
			
			case 'sled':
				updateSled( message ) ;
				break ;
			
			case 'tasks':
				updateTasks( message ) ;
				break ;
			
			case 'task':
				updateTask( message ) ;
				break ;
			
			case 'details':
				updateDetails( message ) ;
				break ;
			
			case 'profile':
			case 'user':
				updateProfile( message ) ;
				break ;
			
			case 'contacts':
				updateContacts( message ) ;
				break ;

			case 'tips':
				updateTips( message ) ;
				break ;

			case 'suggestions':
				updateSuggestions( message ) ;
				break ;

			// also not used 'storage', 'prefs' ...   
			
		}

	}

}


// render updated sled/sledlist

function updateSleds( message ) {

		function gotSleds( response, myArg ) {

			if( response && response._networkRequestStatusCode && response._networkRequestStatusCode === 200 ) {

				Y.fire( 'sled:renderSleds', response ) ;

				Y.fire( 'sled:changedBy', 'Sleds changed', message.by, '.sled-title-box' ) ;

			} else {

				Y.log( 'error getting sleds for stream update ' + JSON.stringify( response ) ) ;

			}

		}

		getJson( "sleds", gotSleds ) ;

	}
	
	
// updateSled

function updateSled( message ) {

	// don't set sled object as it will be replaced w subsequent net req for new sled data
	// var sledId = Y.sled.gsled.sleds[ message.sled ].id ;	
	var sledId = message.sled ;	

	function gotSled( response, myArg ) {

		if( response && response._networkRequestStatusCode && response._networkRequestStatusCode === 200 ) {

			// this will redraw what should already be the current sled
			Y.fire( 'sled:renderSled', response, myArg ) ;

			// if title changed, should also rerender sled titles in sledlist
			// note: we might not be subscribed to a sled when it's title is changed
			Y.fire( 'sled:renderSleds', Y.sled.gsled.sleds ) ;

			// Y.sled.gsled.sled has now changed as a result of network request
			// but should still have same id to indicate if user is logically on same sled
			// when that is confirmed, let the user know (where) the sled was updated
			if( sledId === Y.sled.gsled.sled.id ) {	// it's still acticve on the UI

				Y.fire( 'sled:changedBy', 'Sled changed', message.by, '#main-box' ) ;

			} else {

				// var sled = Y.sled.gsled.sleds[ sledId ] ;
				// sled.dirty = true ;

			}

		} else {

			Y.log( 'error getting sled for stream update ' + JSON.stringify( response ) ) ;

		}

	}

	getJson( "sled/" + message.sled, gotSled ) ;

}


// render updated tasks and highlight

function updateTasks( message ) {

	function gotTasks( tasks ) {	// response includes a myArg

		if( tasks && tasks._networkRequestStatusCode && tasks._networkRequestStatusCode === 200 ) {

			var sled = Y.sled.gsled.sleds[ message.sled ] ;

			// if it's acticve on the UI
			if( sled.id === Y.sled.gsled.sled.id ) {	

				Y.fire( 'sled:renderTasks', tasks, message.sled ) ;	

				Y.fire( 'sled:changedBy', 'Tasks changed', message.by, '#bluebox' ) ;

			} else {

				// update the data in leiu of having it done via rendering
				// (could also use a dirty flag such as sled.dirty = true)
				
				sled.tasks = tasks ;	

				if( tasks ) {	// && isArray && length > 0
					var i,l ;
					for (/*var*/ i=0, l=tasks.length; i < l; ++i) {
						var task = tasks[i] ;
						task.index = i ;	// for convenience if we have only key and want to find place in array
						tasks[task.id] = task ;	
					}
				}

			}

		} else {

			Y.log( 'error getting tasks for stream update ' + JSON.stringify( tasks ) ) ;

		}

	}
	
	getJson( "sled/" + message.sled + "/tasks", gotTasks ) ;
}


// render updated task and highlight

function updateTask( message ) {

	var sled = Y.sled.gsled.sleds[ message.sled ] ;
	var task = sled.tasks[ message.task ] ;
	Y.assert( task.id === message.task ) ;

	function gotTask( response, myArg ) {

		if( response && response._networkRequestStatusCode && response._networkRequestStatusCode === 200 ) {

			// can't wholesale replace task as there's other fields such as details
			// (or repoint task we'd have to go back and repoint other objects and arrays w refs)
			task.created = response.modified ;
			task.modified = response.created ;
			task.participants = response.participants || [] ;
			Y.assert( !task.sled || task.sled === response.sled ) ;
			task.status = response.status ;
			task.title = response.title ;
			Y.assert( task.id === response.id ) ;
			// leave other fields alone, like task.details
			// got to process to get some fields that come with GET TASKS like participantCount and isParticipant
			task.participantsCount = task.participants.length ;
			task.isParticipant = false ;
			var c,l ;
			for (/*var*/ c=0, l=task.participants.length; c < l; c++) {
				if( task.participants[c] === Y.sled.gsled.profile.id ) {
					task.isMe = true ;
					break ;
				}
			}

			if( sled.id === Y.sled.gsled.sled.id ) {	// it's acticve on the UI

				var tasksNode = Y.one( '#tasks' ) ;
				var taskNode = tasksNode.one( '.task[task="' + task.id + '"]' ) ;
				var html = Y.sled.templates.taskListHtml( task, taskNode ) ;
				taskNode.replace( html ) ;
				taskNode = tasksNode.one( '.task[task="' + task.id + '"]' ) ;	// need to reget the node after replace
				Y.sled.tasklist.showUpdatedAgo( taskNode, true ) ;
				Y.fire( 'sled:changedBy', 'Task changed', message.by, taskNode ) ;
			}

		} else {

			Y.log( 'error getting task for stream update ' + JSON.stringify( response ) ) ;

		}

	}

	getJson( "task/" + task.id, gotTask ) ;

}


// render updated details and highlight

function updateDetails( message ) {

	var sled = Y.sled.gsled.sleds[ message.sled ] ;
	var task = sled.tasks[ message.task ] ;

	function gotDetails( response, myArg ) {

		if( response && response._networkRequestStatusCode && response._networkRequestStatusCode === 200 ) {

			task.details = response ;
			
			if( task.details.thread.length > 0 ) {	// in case we have update other than add, such as delete
				var detailsObject = task.details.thread[ task.details.thread.length-1 ] ;	
				task.detailsModified = detailsObject.created ;
				task.detailsModifiedBy = detailsObject.user ;
			}

			if( sled.id === Y.sled.gsled.sled.id ) {	// it's acticve on the UI
			
				var tasksNode = Y.one( '#tasks' ) ;
				var taskNode = tasksNode.one( '.task[task="' + task.id + '"]' ) ;
				
				// do this just for 'updated ago' behavior
				var html = Y.sled.templates.taskListHtml( task, taskNode ) ;
				taskNode.replace( html ) ;
				taskNode = tasksNode.one( '.task[task="' + task.id + '"]' ) ;	// need to reget the node after replace
				Y.sled.tasklist.showUpdatedAgo( taskNode, true ) ;
								
				// now update the details
				html = Y.sled.templates.taskDetailsHtml( task ) ;
				var detailsNode = taskNode.one('.messages') ;
				detailsNode.setContent(html);
				
				Y.fire( 'sled:changedBy', 'Item details added', message.by, taskNode ) ;
			}

		} else {

			Y.log( 'error getting task details for stream update ' + JSON.stringify( response ) ) ;

		}
	}

	getJson( "task/" + task.id + "/details", gotDetails, task ) ;
}


// render updated profile/user

function updateProfile( message ) {

	// just rerender whole tasklist - todo: global list of tasks, and export detail render
	getJson( "profile", function( profile ){ Y.fire( 'sled:renderProfile', profile ) ; } ) ; 

}


// just render updated contacts - not currently highlighting any node

function updateContacts( message ) {

	// get new contacts when updated
	// can be caused by ourselves when inviting someone to a sled
	// just rerender updated contacts - not currently highlighting any node
	getJson( "contacts", function( contacts ){ Y.fire( 'sled:renderContacts', contacts ) ; } ) ; 

}


// just render updated tips - not currently highlighting any node

function updateTips( message ) {

	if( Y.sled && Y.sled.user ) {
		getJson( "sled/" + message.id + "/tips", function( tips, sledId ){ Y.fire( 'sled:renderTips', tips, sledId ) ; }, message.id ) ;
	}

}


// just render updated suggestions - not currently highlighting any node

function updateSuggestions( message ) {

	if( Y.sled && Y.sled.suggestionlist ) {
		getJson( "sled/" + message.id + "/suggestions", function( suggestions, sledId ){ Y.fire( 'sled:renderSuggestions', suggestions, sledId ) ; }, message.id ) ;
	}

}


// bind actions such as events

function bind( ) {

        socket = new io.Socket('api.' + postmile.domain, { port: 80, rememberTransport: false });
		
		socket.on('connect', function () {
			Y.log( 'Connected!' ) ;
		});

		socket.on('message', function (message) {
			handleStreamMessage( message ) ;
		});

		socket.connect();

		Y.on( "sled:subscribeSled", function( sled ) {
			subscribe( sled ) ;
		});

	}


// any exports

Y.namespace("sled").stream = {
} ;


// start binding when module loaded

bind() ;


}, "1.0.0", {requires:['node']} );
