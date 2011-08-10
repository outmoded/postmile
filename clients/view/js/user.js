/*
* Copyright (c) 2011 Yahoo! Inc. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* user module:
*
*	upon login, get the active sled, user profile, the list of sleds, and user contacts
*	(details of the current sled, as well as tips and suggestions for that sled, were req'd in rendering that sled)
*	also includes funcitn to render the profile (the account menu)
*	render the tips
*	and manage the next, close, and show tip links
*
*/ 

YUI.add('sleduser', function (Y) {

	var gsled = Y.sled.gsled;


	// login is more of init now that we've got auth
	// it sets the current sled based on the frag passed in 
	// gets the profile, list of sleds, and contacts

	function login(fragSled) {

		if (fragSled) {
			gsled.activeSledId = fragSled;
		} else {
			var confirmActiveSled = function(response) {
				if (response && (response._networkRequestStatusCode && response._networkRequestStatusCode === 200)) {
					gsled.activeSledId = response.activesled;
				} else {
					Y.log('login confirmActiveSled - error: ' + JSON.stringify(response));
				}
			} ;
			getJson("storage/activesled", confirmActiveSled); // sync these:?
		}

		getJson("profile", renderProfile);

		getJson( "sleds", function( sleds ){ Y.fire( 'sled:renderSleds', sleds, true ) ; } ) ; 

		getJson( "contacts", function( contacts ){ Y.fire( 'sled:renderContacts', contacts ) ; } ) ; 
	}


	// renderProfile

	function renderProfile(profile) {

		if (!profile || (profile._networkRequestStatusCode && profile._networkRequestStatusCode !== 200)) {
			Y.log('renderProfile - no data: ' + JSON.stringify(profile));
			return;
		}

		gsled.profile = profile;

		// set name wrt precedence: profile name, username, first email addr, and finally 'Account'
		var target = Y.one('#account #name');		
		var name;
		name = name || gsled.profile.name;
		name = name || gsled.profile.username;
		name = name || ( gsled.profile.emails && gsled.profile.emails.length > 0 && gsled.profile.emails[0].address );
		name = name || 'Account';
		gsled.profile.display = name;
		target.setContent(name);

		// show the acct menu now that it's loaded
		var accountmenu = Y.one("#account");
		accountmenu.removeClass("sled-loading");
		setTimeout(function () { accountmenu.one('#account-menu').removeClass("sled-loading"); }, 1000);

		Y.fire( 'sled:checkUncover' );
	}


	// attach UI 

	function bind() {

		// event handlers

		Y.on( "sled:renderProfile", function( profile ) {
			renderProfile( profile ) ;
		});

	}


	// main - start

	bind() ;


	// main - kick it all off, get token et al

	loadCredentials( function () { login(fragment); } );


	// exports

	Y.namespace("sled").user = {	
	} ;


}, "1.0.0", { requires: ["sledsledlist", "sledglobal", 'slednetwork', 'sledcontacts', 'node'] });

