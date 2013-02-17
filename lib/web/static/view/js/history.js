/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* 'postmile-history' module
*
*	for now, just catch when user changes the URL fragment
*	eventually keep track of what the user may be doing (back, forward, etc)
*
*
*/

YUI.add('postmile-history', function (Y) {

    var gpostmile = Y.postmile.gpostmile;
    var hash;

    function setHash() {
        history.setHash(hash);
    }

    function bind() {

        // var history = new Y.History({
        hash = new Y.HistoryHash({
        // initialState: { }
    });

    Y.on('history:change', function (e) {

        var changed = e.changed; // removed = e.removed;

        if (changed.project && e.src !== 'replace' && Y.postmile.project) {
            var sproject = gpostmile.projects[changed.project.newVal];
            Y.fire('postmile:renderProject', sproject);
        }

    });

}

bind();

Y.namespace('postmile').history = {	// export it
    hash: hash,
    last: null
};

}, "1.0.0", { requires: ['history'] });
