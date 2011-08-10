/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* sledhistory module
*
*	for now, just catch when user changes the URL fragment
*	eventually keep track of what the user may be doing (back, forward, etc)
*
*
*/ 

YUI.add('sledhistory', function(Y) {

var gsled = Y.sled.gsled ;
var hash ;

function setHash() {	
	history.setHash( hash ) ;
}

function bind() {	

	// var history = new Y.History({
	hash = new Y.HistoryHash({
		// initialState: { }
	});

	Y.on('history:change', function (e) {

	  var changed = e.changed ;	// removed = e.removed;

		if( changed.sled && e.src !== 'replace' && Y.sled.sled ) {
			var ssled = gsled.sleds[ changed.sled.newVal ] ;
			Y.fire( 'sled:renderSled', ssled ) ;
		}

	});

}

bind() ;

Y.namespace("sled").history = {	// export it
	hash: hash,
	last: null
} ;

}, "1.0.0" , {requires:['history']} );
