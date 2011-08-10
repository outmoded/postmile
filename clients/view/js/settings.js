/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* sled settings (aka perferences) module
*
*	needed before YUI is loaded to start net req of sled data
*	use Y.fire for misc when it become available
*
*
*/ 

YUI.add('sledsettings', function(Y) {

var gsled = Y.sled.gsled ;

// renderSettings
function renderSettings( settings ) {
	// gsled.settings = settings ;
	gsled.settings = [] ;
	var html = "" ;
	var i,l ;
	for (/*var*/ i=0, l=settings.length; i < l; ++i) {
		var setting = settings[i] ;
		if( setting.id !== "oneDetailAtaTime" ) {
			gsled.settings.push( setting ) ;
			// setting.index = i ;	// for convenience if we have only key and want to find place in array, but then have to watch for deletes to compact
			gsled.settings[setting.id] = setting ;	// prime
			html += Y.sled.templates.settingsMenuItem( setting ) ;
		}
	}
	html += "" ;
	var settingsNode = Y.one('#settings');
	settingsNode.setContent(html);
}

// bind UI
function bind( ) {

	/*
	// collapse and restore setting menu
	var mySettingsMenu = Y.one( "#mysettings" ) ;
	var settingsMenu = Y.one( "#settings" ) ;
	mySettingsMenu.on('click',function (e) {
		var current = settingsMenu.getStyle("display");
		current === "none" ? settingsMenu.setStyle("display", "inline") : settingsMenu.setStyle("display", "none") ;
	}) ;
	*/

	// allow user to switch settings via account popup menu
	var loginMenu = Y.one("#account-menu");
	loginMenu.delegate('click',function (e) {
		var settingId = e.currentTarget.getAttribute('setting') ;	// get does not always work
		Y.assert( settingId ) ;
		var ssetting = gsled.settings[settingId] ;
		Y.assert( ssetting ) ;
		ssetting.value = !ssetting.value ;
		selectedSledMenuLink = loginMenu.one('li[setting="' + ssetting.id + '"]') ;
		selectedSledMenuAnchor = selectedSledMenuLink.one('a');
		if( ssetting.value ) {
			selectedSledMenuAnchor.addClass( 'enabled' ) ;
		} else {
			selectedSledMenuAnchor.removeClass( 'enabled' ) ;
		}
		var postableSettings = { 'value' : JSON.stringify(gsled.settings) } ;
		postJson( "storage/settings", JSON.stringify( postableSettings ), confirmSetSettings ) ;
	}, '.setting' ) ;
}

// confirmSetSettings
function confirmSetSettings( response ) {
	if( response.status !== "ok" ) {
		Y.log( 'error setting settings ' + JSON.stringify( response ) ) ;
	}
}

// confirmGetSettings
function confirmGetSettings( response ) {
	if (!response || ( response._networkRequestStatusCode && response._networkRequestStatusCode !== 200 ) || !response.settings ) {	// && settings.length > 0 ) {
		var postableSettings = { 'value' : JSON.stringify(gsled.settings) } ;
		postJson( "storage/settings", JSON.stringify( postableSettings ), confirmSetSettings ) ;
	} else {
		gsled.settings = JSON.parse( response.settings ) ;	// todo: secure
		renderSettings( gsled.settings ) ;	// adds settings[id]
	}
}

// settings
function settings() {
	if( !gsled.settings ) {
		gsled.settings = [ { id:"multipleDetails", title:"Multi-Details", value:false } ] ;	// defaults until response, and stops it from rerequesting
		renderSettings( gsled.settings ) ;	// adds settings[id]
		getJson( "storage/settings", confirmGetSettings ) ;
	}
	return gsled.settings ;
}
function multipleDetails() {
	if( !settings().multipleDetails ) {
		gsled.settings.push( { id:"multipleDetails", title:"Multi-open Details", value:false } ) ;
		renderSettings( gsled.settings ) ;	// adds settings[id]
	}
	return ( settings() && settings().multipleDetails ) ? settings().multipleDetails.value : false ;
}
function multilineDetails() {
	if( !settings().multilineDetails ) {
		gsled.settings.push( { id:"multilineDetails", title:"Multi-line Details", value:false } ) ;
		renderSettings( gsled.settings ) ;	// adds settings[id]
	}
	return ( settings() && settings().multilineDetails ) ? settings().multilineDetails.value : false ;
}
function confirmDelete() {
	if( !settings().confirmDelete ) {
		gsled.settings.push( { id:"confirmDelete", title:"Confirm Delete", value:true } ) ;
		renderSettings( gsled.settings ) ;	// adds settings[id]
	}
	return ( settings() && settings().confirmDelete ) ? settings().confirmDelete.value : true ;
}
function sledsReorder() {
	if( !settings().sledsReorder ) {
		gsled.settings.push( { id:"sledsReorder", title:"Sled Reorder", value:true } ) ;
		renderSettings( gsled.settings ) ;	// adds settings[id]
	}
	return ( settings() && settings().sledsReorder ) ? settings().sledsReorder.value : true ;
}

Y.namespace("sled.settings");
Y.sled.settings = {
	multipleDetails: multipleDetails,
	confirmDelete: confirmDelete,
	sledsReorder: sledsReorder,
	multilineDetails: multilineDetails,
	last: null
} ;

bind() ;

// just to prefetch the details and establish the menu (todo: make it a dialog)
if( Y.sled.settings ) {
	Y.sled.settings.multipleDetails() ;	// prime
}


}, "1.0.0", {requires:['sledglobal', 'slednetwork']} );
