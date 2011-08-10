/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* sledglobal module
*
*	the root data structure for profile, contacts, all sleds, tasks, suggestions, tips, etc.
*
*
*/ 

YUI.add('sledglobal', function(Y) {

Y.namespace("sled");
Y.namespace("sled.global");
Y.sled.global = {	// export it
	// baseObject: {},
	profile: {},
	contacts: [],
	sleds: [],
	sled: null,	// no active/selected sled
	users: {},
	tips: {},
	tip: -1,
	last: null
} ;
Y.namespace("sled.gsled");
Y.sled.gsled = Y.sled.global ;

}, "1.0.0" , {requires:['node']} );
