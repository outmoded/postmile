/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* user module:
*
*	upon login, get the active project, user profile, the list of projects, and user contacts
*	(details of the current project, as well as tips and suggestions for that project, were req'd in rendering that project)
*	also includes funcitn to render the profile (the account menu)
*	render the tips
*	and manage the next, close, and show tip links
*
*/

YUI.add('postmile-user', function (Y) {

    var gpostmile = Y.postmile.gpostmile;


    // login is more of init now that we've got auth
    // it sets the current project based on the frag passed in 
    // gets the profile, list of projects, and contacts

    function login(fragProject) {

        if (fragProject) {
            gpostmile.activeProjectId = fragProject;
        } else {
            var confirmActiveProject = function (response) {
                if (response && (response._networkRequestStatusCode && response._networkRequestStatusCode === 200)) {
                    gpostmile.activeProjectId = response.activeProject;
                } else {
                    Y.log('login confirmActiveProject - error: ' + JSON.stringify(response));
                }
            };
            getJson("/storage/activeProject", confirmActiveProject); // sync these:?
        }

        getJson("/profile", renderProfile);

        getJson("/projects", function (projects) { Y.fire('postmile:renderProjects', projects, true); });

        getJson("/contacts", function (contacts) { Y.fire('postmile:renderContacts', contacts); });
    }


    // renderProfile

    function renderProfile(profile) {

        if (!profile || (profile._networkRequestStatusCode && profile._networkRequestStatusCode !== 200)) {
            Y.log('renderProfile - no data: ' + JSON.stringify(profile));
            return;
        }

        gpostmile.profile = profile;

        // set name wrt precedence: profile name, username, first email addr, and finally 'Account'
        var target = Y.one('#account #name');
        var name;
        name = name || gpostmile.profile.name;
        name = name || gpostmile.profile.username;
        name = name || (gpostmile.profile.emails && gpostmile.profile.emails.length > 0 && gpostmile.profile.emails[0].address);
        name = name || 'Account';
        gpostmile.profile.display = name;
        target.setContent(name);

        // show the acct menu now that it's loaded
        var accountmenu = Y.one("#account");
        accountmenu.removeClass("postmile-loading");
        setTimeout(function () { accountmenu.one('#account-menu').removeClass("postmile-loading"); }, 1000);

        Y.fire('postmile:checkUncover');
    }


    // attach UI 

    function bind() {

        // event handlers

        Y.on("postmile:renderProfile", function (profile) {
            renderProfile(profile);
        });

    }


    // main - start

    bind();


    // main - kick it all off, get token et al

    loadCredentials(function () { login(fragment); });


    // exports

    Y.namespace('postmile').user = {
};


}, "1.0.0", { requires: ["'postmile-projects-list'", "postmile-global", 'postmile-network', 'postmile-contacts', 'node'] });

