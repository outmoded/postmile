/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* projectslist module
*
*	manage (render, select, delete, create) list of projects (currently in projects menu)
*	perhaps later allow more management like reordering
*
*
*/

YUI.add('postmile-projects-list', function (Y) {

    var gpostmile = Y.postmile.gpostmile;


    // render

    function renderProjects(projects, renderMostRecentProject) {

        var i, l; // make jslint as happy as it can be about this

        // if projects is not null, it's an array w length
        if (!projects || (projects._networkRequestStatusCode && projects._networkRequestStatusCode !== 200)) {
            Y.log('renderProjects - no data: ' + JSON.stringify(projects));
            return;
        }

        // set active projects
        gpostmile.projects = projects;

        var html = "";
        var mostRecentProject = gpostmile.project; // same as gpostmile.projects[gpostmile.activeProjectId] ;

        for (i = 0, l = projects.length; i < l; ++i) {

            var project = projects[i];

            project.index = i; // for convenience if we have only key and want to find place in array
            gpostmile.projects[project.id] = project; // prime

            if (!mostRecentProject && (!gpostmile.activeProjectId || project.id === gpostmile.activeProjectId)) {
                mostRecentProject = project;
            }

            html += Y.postmile.templates.projectMenuItem(project, mostRecentProject);
        }

        html += "";

        if (!mostRecentProject) {
            mostRecentProject = gpostmile.projects[0];
        }

        var projectsNode = Y.one('#projects');
        projectsNode.setContent(html);

        // put back the initial project so we don't get a double load - just this once
        if (initialProjectId && initialProject) {
            gpostmile.projects[initialProjectId] = initialProject;
            for (i = 0, l = gpostmile.projects.length; i < l; ++i) {
                if (gpostmile.projects[i].id === initialProject.id) {
                    gpostmile.projects[i] = initialProject;
                    gpostmile.projects[i].index = i;
                }
            }
        }

        if (renderMostRecentProject) {
            if (mostRecentProject) {
                Y.fire('postmile:renderProject', mostRecentProject); 	// may be incomlpete, but call will prime to get details and tasks
            } else {
                makeAndRenderNewProject();
            }
        } else {
        }

        // put this here as well as in project.js just in case project is not rendered
        var projectsMenuLabel = Y.one("#projects-list");
        // for some reason, immediate removal of class doesn't work - delay even of 0 does
        setTimeout(function () { projectsMenuLabel.removeClass("postmile-loading"); }, 0);
        setTimeout(function () { projectsMenuLabel.one('#projects-menu').removeClass("postmile-loading"); }, 1000);

        // configure menu for the state of this project 
        if (mostRecentProject) {
            removeProjectFromMenu(mostRecentProject.id);
        }

        if (Y.postmile.dnd) {
            Y.postmile.dnd.projectsDnd(); // takes care of create, sync, etc
        }

        Y.fire('postmile:checkUncover');
    }


    // remove project from menu - hide it if it's selected, as it shows in the menu label on top

    function removeProjectFromMenu(projectId) {
        if (Y.postmile.settings && Y.postmile.settings.projectsReorder()) {
            return null;
        }
        var projectsMenu = Y.one("#projects-list #projects");
        projectMenuAnchors = projectsMenu.all(".project a");
        projectMenuAnchors.removeClass('postmile-loading');
        selectedProjectMenuLink = projectsMenu.one('li[project="' + projectId + '"]');
        selectedProjectMenuAnchor = selectedProjectMenuLink.one('a');
        selectedProjectMenuAnchor.addClass('postmile-loading');
    }


    // create a new project to render

    function makeAndRenderNewProject() {

        var myNewProject = {
            "id": "",
            "title": "Name your new list",
            "participants": [],
            "tasks": []
        };

        // add to projects array (not done by renderProject), to the beginning
        gpostmile.projects.unshift(myNewProject);

        // new/empty active/selected project, needs to be done before renderProjects because renderProject adds the project arg to the projects
        Y.fire('postmile:renderProject', myNewProject, true);

        // dismiss menu just in case we're creating a new project because the user selected 'create' from the menu
        // could make a menu-specific callback to do just this
        var myProjectsMenu = Y.one("#projects-menu");
        myProjectsMenu.addClass('menu-hidden');

        function confirmAddedProject(response, myarg) { // response has id, rev, status

            if (response.status === 'ok') {

                myNewProject.rev = response.rev;

                myNewProject.id = response.id;
                gpostmile.projects[myNewProject.id] = myNewProject; // needs to be added to projects keys again with new id 


                if (!myNewProject.requestedSuggestions && myNewProject.id !== "") {

                    myNewProject.requestedSuggestions = true;
                    getJson("/project/" + myNewProject.id + "/suggestions",
						function (suggestions, projectId) { Y.fire('postmile:renderSuggestions', suggestions, projectId); }, myNewProject.id);

                } else {

                    // clear even if no suggestions
                    Y.fire('postmile:renderSuggestions', myNewProject.suggestions, myNewProject.id);

                }

                if (!myNewProject.requestedTips && myNewProject.id !== "") {

                    myNewProject.requestedTips = true; // just to say we tried
                    getJson("/project/" + myNewProject.id + "/tips",
						function (tips, projectId) { Y.fire('postmile:renderTips', tips, projectId); }, myNewProject.id);

                } else {

                    // clear even if no suggestions
                    Y.fire('postmile:renderTips', myNewProject.tips, myNewProject.id);

                }

                // need to renderProjects menu for both adding and changing project names
                // just to repop the menu of projects with prop id, do not set and render last/active project
                renderProjects(gpostmile.projects, false);

                document.location.href = document.location.href.split('#')[0] + '#project=' + myNewProject.id;

            } else {

                Y.log('error adding project ' + JSON.stringify(response));

            }
        }

        var json = '{"title":"' + myNewProject.title + '"}';
        putJson("/project", json, confirmAddedProject);

    }


    // reorder

    function reorder(dragNode) {

        var dropNode = dragNode.get('nextSibling');
        var dropIndex = gpostmile.projects.length;
        if (dropNode) {
            var dropId = dropNode.getAttribute('project');
            if (dropId) {	// might've been on other kind of item/node
                var dropProject = gpostmile.projects[dropId];
                dropIndex = dropProject.index;
            }
        }

        var dragId = dragNode.getAttribute('project');
        var dragProject = gpostmile.projects[dragId];
        var dragIndex = dragProject.index;

        if (dragIndex < dropIndex) {
            dropIndex--;
        }

        if (dragProject.index !== dropIndex) {

            // post new order
            var confirmOrder = function (response, myarg) {

                if (response.status === 'ok') {

                    // change array order
                    var dragSplice = gpostmile.projects.splice(dragIndex, 1);
                    gpostmile.projects.splice(dropIndex, 0, dragSplice[0]);

                    // update index fields
                    if (gpostmile.projects) {	// just update all indecies
                        var i, l;
                        for (/*var*/i = 0, l = gpostmile.projects.length; i < l; ++i) {
                            var project = gpostmile.projects[i];
                            project.index = i; // for convenience if we have only key and want to find place in array
                            Y.assert(gpostmile.projects[project.id] === project);
                        }
                    }

                    Y.fire('postmile:statusMessage', 'Project reordered');

                } else {

                    renderProjects(gpostmile.projects, false);

                    Y.fire('postmile:errorMessage', 'Project reorder failed');

                }
            };

            postJson("/project/" + dragProject.id + "?position=" + dropIndex, "", confirmOrder);
            // Y.log( "project/" + dragProject.id + "?position=" + dropIndex + "  (" + dragIndex + ")" ) ;
        }

    }


    // delete a project

    function deleteProject(projectId) {

        var sc, i, l;

        function confirmLeftProject(response, myarg) {

            if (response.status === "ok") {

                // remove project index from array
                for (sc = 0; sc < gpostmile.projects.length; sc++) {
                    if (gpostmile.projects[sc].id === projectId) {
                        gpostmile.projects.splice(sc, 1);
                    }
                }

                // remove project id from dictionary
                delete gpostmile.projects[projectId];

                // update index fields
                if (gpostmile.projects) {	// just update all indecies
                    for (i = 0, l = gpostmile.projects.length; i < l; ++i) {
                        var project = gpostmile.projects[i];
                        project.index = i; // for convenience if we have only key and want to find place in array
                        Y.assert(gpostmile.projects[project.id] === project);
                    }
                }


                // remove from menu, go to next in menu, create new project if needed

                var projectMenuNode = Y.one('#projects-list #projects .project[project="' + projectId + '"]');

                if (projectMenuNode) {

                    var nextNode = projectMenuNode.next();

                    if (!nextNode) {

                        // if menu item was last, make next menu cycle around wrap around to first
                        var firstNode = projectMenuNode.ancestor().one('*');
                        if (firstNode !== projectMenuNode) {
                            nextNode = firstNode;
                        }
                    }

                    if (!nextNode) {

                        // if no more projects, make another one
                        makeAndRenderNewProject();

                    } else {

                        // slect and render next project
                        var newProjectId = nextNode.getAttribute('project'); // get does not work
                        var sproject = gpostmile.projects[newProjectId];

                        Y.fire('postmile:renderProject', sproject);

                    }

                    // remove originally selected project menu item
                    projectMenuNode.remove();

                }

            } else {

                Y.log('error deleting project ' + JSON.stringify(response));
                Y.fire('postmile:inform', 'Error', 'Failed to delete project.');

            }

        }

        deleteJson("/project/" + projectId, null, confirmLeftProject);

    }


    // bind UI

    function bind() {

        // bind delete project menu item, and ask first
        var deleteProjectMenuItem = Y.one("#projects-list #delete-project");
        deleteProjectMenuItem.on('click', function (e) {
            Y.fire('postmile:confirm',
			'Delete list?',
			'Deleting the list will remove all the items and details. This change will delete the list for all participants and it is permanent.',
			deleteProject,
			gpostmile.project.id);
        });

        var leaveProjectMenuItem = Y.one(".leave-project");
        leaveProjectMenuItem.on('click', function (e) {
            var pm = Y.one('#project-participants-menu');
            pm.addClass('menu-hidden');
            Y.fire('postmile:confirm',
			'Leave this Project?',
			'You will not be able to join unless invited back by another participant.',
			deleteProject,
			gpostmile.project.id);
        });

        // bind join project menu item, and ask first
        var joinProjectMenuItem = Y.one("#projects-list #join-project");
        joinProjectMenuItem.on('click', function (e) {
            Y.fire('postmile:askJoinCurrentProject', true); // if false, don't ask, just do it
        });

        // bind create new project menu item
        var newProject = Y.one("#projects-list #new-project");
        newProject.on('click', makeAndRenderNewProject);

        // allow user to switch projects via menu
        var projectsMenu = Y.one("#projects-list #projects");
        projectsMenu.delegate('click', function (e) {

            var projectId = e.currentTarget.getAttribute('project'); // get does not always work
            var sproject = gpostmile.projects[projectId];

            // if project does not have details, this will get them
            Y.fire('postmile:renderProject', sproject);


            // remove project from menu, as it shows in the menu label on top
            removeProjectFromMenu(sproject.id);

            // show menus once bound
            Y.one("#projects-menu").addClass('menu-hidden');
            Y.one("#projects-menu").previous().removeClass('menu-label-menuvisible');
            Y.one("#projects-menu").previous().removeClass('menu-label-active');

        }, '.project');

        // event handlers
        Y.on("postmile:renderProjects", function (projects, renderMostRecentProject) {
            renderProjects(projects, renderMostRecentProject);
        });

        Y.on("postmile:projectReorder", function (node) {
            reorder(node);
        });

    }

    Y.namespace('postmile').projectslist = {
};

bind();

}, "1.0.0", { requires: ["postmile-global", 'postmile-network', "'postmile-projects-list'", 'node'] });
