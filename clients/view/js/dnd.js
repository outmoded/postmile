/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* sleddnd (drag and drop) module
*
* handles two drag sources (tasks and suggestions) and one drop target (tasks)
*
*
*/ 


YUI.add('sleddnd', function(Y) {
	//Y.DD.DDM._debugShim = true;

	var legitDrop = false ;
	var savedCursor ;
	var savedMouseOutHideDelay ;
	var sledsDndDelegate ;
	
	//Static Vars
	var goingUp = false, lastY = 0;

	// task list is both a drag and drop target
	var tasksDndDelegate = new Y.DD.Delegate({
		cont: '#tasks',
		nodes: '#tasks li.task',
		// invalid: 'input',
		// valid: 'a',
		target: { padding: '-10 10 10 -10' },	// needed
		// constrain2node: '#tasks',
		last: null
		});

	// tasksDndDelegate.dd.removeInvalid( 'a' ) ;
	tasksDndDelegate.dd.addInvalid( '.tasktitle' ) ;
	tasksDndDelegate.dd.addInvalid( '.taskdetails' ) ;

	// plug it index
	tasksDndDelegate.dd.plug(Y.Plugin.DDProxy, {
		moveOnEnd: false,
		// cloneNode: true
		last: null
	});

	// constrain tasks to just the task list
	var tasklistNode = Y.one( '#tasks' ) ;
	if( tasklistNode ) {
		tasksDndDelegate.dd.plug(Y.Plugin.DDConstrained, {
			node: tasklistNode,
			last: null
		});
	}

	// don't allow draggin up or down past list
	var tasksNode = Y.one( '#tasks' ) ;
	if( tasksNode ) {
		tasksDndDelegate.dd.plug(Y.Plugin.DDNodeScroll, {
			node: tasksNode,	// get('parentNode')
			last: null
		});
	}

	// suggestion list is only drag 
	var suggestionsDndDelegate = new Y.DD.Delegate({
		cont: '#suggestions',
		nodes: '#suggestions li',
		last: null
		});

	suggestionsDndDelegate.dd.removeInvalid( 'a' ) ;	// what about <span>s with with images?

	// plug it in
	suggestionsDndDelegate.dd.plug(Y.Plugin.DDProxy, {
			moveOnEnd: false,
			// cloneNode: true
			last: null
		});

	// suggestionsDndDelegate.dd.plug(Y.Plugin.DDConstrained, ... });

	var suggestionNode = Y.one( '#suggestions' ) ;
	if( suggestionNode ) {
		suggestionsDndDelegate.dd.plug(Y.Plugin.DDNodeScroll, {
				node: suggestionNode,
				last: null
			});
	}

	// use whole tasklist to determine if drop was in tasks or outside (aborted)
	var tasklistDrop = new Y.DD.Drop({ node: Y.one( '#tasks' ) });

	//Listen for drag:start events on tasks
	tasksDndDelegate.on('drag:start', function(e) {
		savedCursor = document.body.style.cursor ;
		document.body.style.cursor = 'move' ;
		var drag = e.target; //Get our drag object
		drag.get('node').setStyle('opacity', '.25');
		// innerHTML's parent includes sibs
		// and can't count on outerHTML in places like FF
		// so go back to data and templates to regen markup
		// drag.get('dragNode').set('innerHTML', drag.get('node').get('outerHTML') );	
		var taskId = drag.get('node').getAttribute('task') ;
		var task = Y.sled.gsled.sled.tasks[taskId] ;
		var html = Y.sled.templates.taskListHtml( task ) ;
		drag.get('dragNode').set( 'innerHTML', html );	// innerHTML's parent includes sibs
		drag.get('dragNode').setStyles({
			opacity: '.5',
			borderColor: drag.get('node').getStyle('borderColor'),
			backgroundColor: drag.get('node').getStyle('backgroundColor'),
			last: null
		});
		// Y.sled.tasklist.showUpdatedAgo( drag.get('dragNode'), true ) ;
	});

	//Listen for drag:start events on suggestions
	suggestionsDndDelegate.on('drag:start', function(e) {
		var drag = e.target; //Get our drag object
		drag.get('node').setStyle('opacity', '.25');
		// innerHTML's parent includes sibs
		// and can't count on outerHTML in places like FF
		// so go back to data and templates to regen markup
		// drag.get('dragNode').set('innerHTML', drag.get('node').get('outerHTML') );	// outerHTML better than text since it includes markup
		var suggestions = Y.sled.gsled.sled.suggestions ;
		var dragId = drag.get('node').getAttribute('suggestion') ;
		var dragSuggestion = suggestions[dragId] ;
		var html = Y.sled.templates.suggestionListHtml( dragSuggestion ) ;
		drag.get('dragNode').set( 'innerHTML', html );	// innerHTML's parent includes sibs
		drag.get('dragNode').setStyles({
			opacity: '.5',
			borderColor: drag.get('node').getStyle('borderColor'),
			backgroundColor: drag.get('node').getStyle('backgroundColor'),
			last: null
		});
	});

	// Listen for drag:drag events just to track up/down (presume single DnD/time so only need to track one of suggestions, tasks)
	function setLastY( e ) {
		var y = e.target.lastXY[1] ;
		if (y < lastY) {
			goingUp = true;
		} else { 
			goingUp = false;
		}
		lastY = y; //Cache for next check
		Y.DD.DDM.syncActiveShims(true);
	}
	tasksDndDelegate.on('drag:drag', function(e) {
		setLastY( e ) ;
		// document.body.style.cursor = 'move' ;
	});
	suggestionsDndDelegate.on('drag:drag', function(e) {
		setLastY( e ) ;
	});

	// listen for enter and exit on task list to determine if drop was legit or should be aborted
	tasklistDrop.on('drop:enter', function(e) {
		legitDrop = true ;
	});
	tasklistDrop.on('drop:exit', function(e) {
		legitDrop = false ;
		// remove proxy from suggestion that may have been placed in task list
		var list = Y.one( '#tasks' ) ;
		var proxy = list.all( '.proxy' ) ;	// get all proxies in list
		proxy.remove( ) ;	// proxy nodelist may be empty
	});

	// listen for over - could be a dragged task or suggestion
	tasksDndDelegate.on('drop:over', function(e) {
		
		// somehow the sledslist menu is leaking events back into the task list - ignore those by checking if we're in a sleds drag
		if( savedMouseOutHideDelay ) {
			return ;
		}
		
		var drag = e.drag.get('node'),
			dragDrag = e.drag.get('dragNode'),
			drop = e.drop.get('node');

		if (drop.get('tagName').toLowerCase() === 'li') {
			if (!goingUp) {	// todo: make this halt up or something positional instead of dynamic Y
				drop = drop.get('nextSibling');
			}

			// is this coming from suggestions, or a reordering of tasks?
			if( drag.hasClass( 'task' ) ) {
				e.drop.get('node').get('parentNode').insertBefore(drag, drop);	// reordered task
			} else {
				// drag from suggestion
				// pull proxy from list instead of using drag
				var list = Y.one( '#tasks' ) ;
				var proxy = list.one( '.proxy' ) ;
				if( !proxy ) {
					// create proxy from task template
					// (with slight adjustments, like suggestion attr and proxy class)
					var anchor = drag.one( 'a' ) ;
					var task = {"title":anchor.get( 'text' ), "participantsCount":0}  ;
					var extraClasses = 'proxy addnewitem' ;
					var extraAttrs = 'suggestion="' + drag.getAttribute( 'suggestion' ) + '"' ;
					var extraContent = '' ;
					var html = Y.sled.templates.taskListHtml( task, null, extraClasses, extraAttrs, extraContent ) ;
					e.drop.get('node').get('parentNode').insertBefore(html, drop);
					proxy = list.one( '.proxy' ) ;
					Y.sled.tasklist.showUpdatedAgo( proxy, true ) ;
				} else {
					list.insertBefore( proxy, drop ) ; // just move proxy
				}
			}

			//Set the new parentScroll on the nodescroll plugin 
			if( e.drag.nodescroll ) {
				e.drag.nodescroll.set('parentScroll', e.drop.get('node').get('parentNode'));			
			}
			//Resize this nodes shim, so we can drop on it later.
			e.drop.sizeShim();

		}
	});

	// Listen for drag:end events started on tasks (and must end on tasks since that's the only drop)
	tasksDndDelegate.on('drag:end', function(e) {
		var drag = e.target;
		//Put our styles back
		drag.get('node').setStyles({
			visibility: '',
			opacity: '1'
		});
		Y.fire( 'sled:taskReorder', drag.get('node') ) ;
		document.body.style.cursor = savedCursor ;
	});

	// Listen for drag:end events started on suggestions (and must end on tasks since that's the only drop)
	suggestionsDndDelegate.on('drag:end', function(e) {

		var drag = e.target;
		var list = Y.one( '#tasks' ) ;
		var proxy = list.one( '.proxy' ) ;

		// check to see if it was dropped on task list (entered task list before an exit)
		if( !legitDrop ) {
			// restore originally dragged node with style
			drag.get('node').setStyles({
				visibility: '',
				opacity: '1'
			});
				if( proxy ) {
					list.removeChild( proxy ) ;
				}

		} else {
			// remove originally dragged node from suggestions
			drag.get('node').remove() ;
			if( proxy ) {
				// and start transformation of proxy dragged node
				// could do some of this in dropSuggestion
				proxy.removeClass( 'proxy' ) ;	
				proxy.removeClass( 'addnewitem' ) ;	
				proxy.addClass( 'task' ) ;
				// add it to task list via tasklist's dropSuggestion method
				Y.fire( 'sled:dropSuggestion', proxy ) ;
			}
		}
	});


	// this is strictly for the sleds list menu - nothing to do with tasks and suggestion - perhaps factor out somewhere else

	function sledsDnd() {
		
		if( Y.sled.settings && !Y.sled.settings.sledsReorder() ) {
			return null ;
		}

		if( sledsDndDelegate ) {
			sledsDndDelegate.syncTargets() ; // gsled.tasksSortable.delegate.syncTargets() ;
			return sledsDndDelegate ;
		}

		// sled list is both a drag and drop target
		sledsDndDelegate = new Y.DD.Delegate({
			cont: '#sleds',
			nodes: '#sleds li.sled',
			// invalid: 'input',
			// valid: 'a',
			target: { padding: '-10 10 10 -10' },	// needed
			// constrain2node: '#sleds',
			last: null
			});

		sledsDndDelegate.dd.removeInvalid( 'a' ) ;
		// sledsDndDelegate.dd.addInvalid( '.sledtitle' ) ;
		// sledsDndDelegate.dd.addInvalid( '.sleddetails' ) ;

		// plug it index
		sledsDndDelegate.dd.plug(Y.Plugin.DDProxy, {
			moveOnEnd: false,
			// cloneNode: true,
			last: null
		});

		// constrain sleds to just the sled list
		var sledlistNode = Y.one( '#sleds' ) ;
		if( sledlistNode ) {
			sledsDndDelegate.dd.plug(Y.Plugin.DDConstrained, {
				constrain2node: sledlistNode,
				last: null
			});
		}

		/*
		// don't allow draggin up or down past list
		var sledsNode = Y.one( '#sleds' ) ;
		if( sledsNode ) {
			sledsDndDelegate.dd.plug(Y.Plugin.DDNodeScroll, {
				node: sledsNode,	// get('parentNode')
				last: null
			});
		}
		*/

		//Listen for drag:start events on sleds
		sledsDndDelegate.on('drag:start', function(e) {
		
			// we need to make the menu stick up during drag by ignoring the mouse out caused by the drag proxy
			savedMouseOutHideDelay = sledsmenu.menuNav.get( 'mouseOutHideDelay' ) ;
			sledsmenu.menuNav.set( 'mouseOutHideDelay', 999999 ) ;
		
			savedCursor = document.body.style.cursor ;
			document.body.style.cursor = 'move' ;
			var drag = e.target; //Get our drag object
			drag.get('node').setStyle('opacity', '.25');
			// innerHTML's parent includes sibs
			// and can't count on outerHTML in places like FF
			// so go back to data and templates to regen markup
			// drag.get('dragNode').set('innerHTML', drag.get('node').get('outerHTML') );	// innerHTML's parent includes sibs
			var id = drag.get('node').getAttribute('sled') ;
			var sled = Y.sled.gsled.sleds[id] ;
			var html = Y.sled.templates.sledMenuItem( sled, Y.sled.gsled.sled ) ;
			drag.get('dragNode').set( 'innerHTML', html );	// innerHTML's parent includes sibs
			drag.get('dragNode').setStyles({
				opacity: '.5',
				borderColor: drag.get('node').getStyle('borderColor'),
				backgroundColor: drag.get('node').getStyle('backgroundColor'),
				last: null
			});
		
			// attempt to stop event from bubbling down to tasks
			// actually, tasks are not an ancestor (or descendent) so surprised this happens
			// could be a useful feature if we want events to pass thru transparent later as Eran asked
			// e.stopPropagation();, prevent default, halt, return false, etc
		});

		sledsDndDelegate.on('drag:drag', function(e) {
			setLastY( e ) ;
			// document.body.style.cursor = 'move' ;
		});
	
		sledsDndDelegate.on('drop:over', function(e) {
		
			var drag = e.drag.get('node'),
				dragDrag = e.drag.get('dragNode'),
				drop = e.drop.get('node');

			if (drop.get('tagName').toLowerCase() === 'li') {
				if (!goingUp) {	// todo: make this halt up or something positional instead of dynamic Y
					drop = drop.get('nextSibling');
				}

				// is this coming from suggestions, or a reordering of sleds?
				if( drag.hasClass( 'sled' ) ) {
					e.drop.get('node').get('parentNode').insertBefore(drag, drop);	// reordered sled
				} else {
					// drag from suggestion
					// pull proxy from list instead of using drag
					var list = Y.one( '#sleds' ) ;
					var proxy = list.one( '.proxy' ) ;
					if( !proxy ) {
						// create proxy from sled template
						// (with slight adjustments, like suggestion attr and proxy class)
						var anchor = drag.one( 'a' ) ;
						var sled = {"title":anchor.get( 'text' ), "participantsCount":0}  ;
						var extraClasses = 'proxy addnewitem' ;
						var extraAttrs = 'suggestion="' + drag.getAttribute( 'suggestion' ) + '"' ;
						var extraContent = '' ;
						var html = Y.sled.templates.sledMenuItem( sled, null ) ;	// , extraClasses, extraAttrs, extraContent ) ;
						e.drop.get('node').get('parentNode').insertBefore(html, drop);
					} else {
						list.insertBefore( proxy, drop ) ; // just move proxy
					}
				}

				//Set the new parentScroll on the nodescroll plugin 
				if( e.drag.nodescroll ) {
					e.drag.nodescroll.set('parentScroll', e.drop.get('node').get('parentNode'));			
				}
				//Resize this nodes shim, so we can drop on it later.
				e.drop.sizeShim();

			}
		});
	
		// Listen for drag:end events started on sleds (and must end on sleds since that's the only drop)
		sledsDndDelegate.on('drag:end', function(e) {

			sledsmenu.menuNav.set( 'mouseOutHideDelay', savedMouseOutHideDelay ) ;
			savedMouseOutHideDelay = null ;	// thsi is also used as a flag to help task ignore these drags

			var drag = e.target;
			//Put our styles back
			drag.get('node').setStyles({
				visibility: '',
				opacity: '1'
			});
		
			Y.fire( 'sled:sledReorder', drag.get('node') ) ;
			document.body.style.cursor = savedCursor ;

		});

		return sledsDndDelegate ;
	}
	

Y.namespace("sled.dnd");
Y.sled.dnd = {
	tasksDndDelegate: tasksDndDelegate,
	suggestionsDndDelegate: suggestionsDndDelegate,
	sledsDnd: sledsDnd,
	last: null
} ;

}, "1.0.0", {requires:['sledglobal', 'dd-constrain', 'dd-proxy', 'dd-drop', 'dd-scroll', 'dd-delegate', 'node']} );
