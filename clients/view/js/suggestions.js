/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* suggestions module
*
*
*/


YUI.add('postmile-suggestions-list', function (Y) {

    var gpostmile = Y.postmile.gpostmile;
    var suggestions = Y.one("#suggestions");


    // render

    function renderSuggestions(suggestions, projectId) {

        if (!suggestions || (suggestions._networkRequestStatusCode && suggestions._networkRequestStatusCode !== 200)) {
            // it's okay for thre to be no suggestions
            // tho if it's a net err, perhaps could retry (but that'd be at a lower level)
        }

        var project = gpostmile.projects[projectId];
        project.suggestions = suggestions;

        var html = "";

        if (suggestions) {

            var i, l;
            for (/*var*/i = 0, l = suggestions.length; i < l; ++i) {

                var suggestion = suggestions[i];
                suggestion.index = i; // for convenience if we have only key and want to find place in array
                suggestions[suggestion.id] = suggestion;
                html += Y.postmile.templates.suggestionListHtml(suggestion);

            }

        }

        html += "";

        var target = Y.one('#suggestions'); // or #suggestionlist ul
        if (target) {
            target.setContent(html);
        }

        var suggestionpane = Y.one("#suggestionpane");
        suggestionpane.removeClass("postmile-loading");
        hideSuggestionsLoading();

        Y.fire('postmile:checkUncover');
    }


    // click on suggestion

    function suggestionSingleClick(e) {
        document.activeElement.blur();

        // var liTarget = e.currentTarget.ancestor("li", true ) ;	// true == scans/tests self
        // var x = (e.clientX -liTarget.getXY()[0] ;

        // suggestionAdd(e);		
    }


    // local delete from data

    function suggestionDelete(e) {

        var project = gpostmile.project;

        var liTarget = e.currentTarget.ancestor("li", true); // true == scans/tests self
        var suggestionId = liTarget.getAttribute('suggestion');
        var suggestion = project.suggestions[suggestionId];

        project.suggestions.splice(suggestion.index, 1); // remove from task sequence
        delete project.suggestions[suggestion.id];

        renderSuggestions(project.suggestions, project.id);

    }


    // click on x - local delete then remove via API

    function suggestionRemove(e) {

        var project = gpostmile.project;

        // delete in UI
        var liTarget = e.currentTarget.ancestor("li", true); // true == scans/tests self
        var suggestionId = liTarget.getAttribute('suggestion');
        var suggestion = project.suggestions[suggestionId];

        function confirmRemovedSuggestion(response, myarg) { // response has id, rev, status
            // todo: put back suggestion in UI
        }

        // delete on server
        deleteJson("/project/" + project.id + '/suggestion/' + suggestion.id, null, confirmRemovedSuggestion);

        // local delete in data
        suggestionDelete(e);
    }


    // click on left-arrow, local delete, API add will do right thing

    function suggestionAdd(e) {

        var project = gpostmile.project;

        var liTarget = e.currentTarget.ancestor("li", true); // true == scans/tests self
        var suggestionId = liTarget.getAttribute('suggestion');
        var suggestion = project.suggestions[suggestionId];

        Y.fire('postmile:addSuggestion', suggestion);

        suggestionDelete(e);

    }


    // bind UI

    function bind() {

        if (suggestions) {
            suggestions.delegate('click', suggestionSingleClick, 'li');
            suggestions.delegate('click', suggestionRemove, '.removeSuggestion');
            suggestions.delegate('click', suggestionAdd, '.clickableArrow');
        }

        // event handlers

        Y.on("postmile:renderSuggestions", function (suggestions, projectId) {
            renderSuggestions(suggestions, projectId);
        });

    }

    bind();


    Y.namespace('postmile').suggestionlist = {
};


}, "1.0.0", { requires: ['postmile-global', 'tasklist', 'node'] });

