/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* UI Utilities module
*
*
*/

YUI.add('postmile-ui-utils', function (Y) {

    var statusTimer;
    var statusCallback;
    var pointToOverlay;
    var pointToNode = Y.one('#pointTo');
    var currentVersion;


    // display a status message to the user, currently only:
    //
    //	changes by someone else, or same use in another session
    //	errors from network requests
    //
    //	message displayes in top center, color background, for just a few secs (by default)
    //
    //	we may want to queue them up, prioritize, etc
    //

    function statusMessage(m, t, c) {
        t = t || 3000;
        var sm = Y.one('#status');
        sm.removeClass('hide');
        sm.addClass('show');
        m = '<a>' + m + '</a>';
        sm.one('.middleStatus h1').set('innerHTML', m);
        if (statusTimer) {
            clearTimeout(statusTimer);
        }
        statusTimer = setTimeout(function () {
            sm.removeClass("show");
            sm.addClass('hide');
        }, t
	);
        if (statusCallback) {
            statusCallback.detach();
            statusCallback = null;
        }
        if (c) {
            statusCallback = sm.one('a').on('click', c);
        }
    }


    // function to ask user to confirm an operation - pass in lables, strings, callbacks, etc
    // might be better, more flexibly, to pass in an array of objects with text, func, and arg

    function confirm(title, text, okFunc, okArg, cancelFunc, cancelArg, okText, cancelText) {

        var overlay = Y.one('#confirm-overlay');
        var underlay = Y.one('#confirm-underlay');
        var ok = overlay.one('#confirm-ok');
        var cancel = overlay.one('#confirm-cancel');
        var close = overlay.one('#confirm-close');

        ok.setContent(okText || 'Ok');
        cancel.setContent(cancelText || 'Cancel');

        overlay.one('#confirm-title').setContent(title);
        overlay.one('#confirm-text').setContent(text);
        overlay.removeClass('hide');
        overlay.addClass('show');
        underlay.removeClass('hide');
        underlay.addClass('show');

        function dismiss() {
            overlay.addClass('hide');
            overlay.removeClass('show');
            underlay.addClass('hide');
            underlay.removeClass('show');

            Y.Event.purgeElement(ok);
            Y.Event.purgeElement(cancel);
            Y.Event.purgeElement(close);
        }

        function doOk(e2) {
            dismiss();
            if (okFunc) {
                okFunc(okArg);
            }
        }

        function doCancel(e2) {
            dismiss();
            if (cancelFunc) {
                cancelFunc(cancelArg);
            }
        }

        ok.on('click', doOk);
        cancel.on('click', doCancel);
        close.on('click', doCancel);
    }


    // function to ask user to confirm an operation - pass in lables, strings, callbacks, etc

    function inform(title, text, okFunc, okArg, okText) {

        var overlay = Y.one('#confirm-overlay');
        var underlay = Y.one('#confirm-underlay');
        var ok = overlay.one('#confirm-ok');
        var cancel = overlay.one('#confirm-cancel');
        var close = overlay.one('#confirm-close');

        ok.setContent(okText || 'Ok');
        cancel.addClass('hide');

        overlay.one('#confirm-title').setContent(title);
        overlay.one('#confirm-text').setContent(text);
        overlay.removeClass('hide');
        overlay.addClass('show');
        underlay.removeClass('hide');
        underlay.addClass('show');

        function dismiss() {
            overlay.addClass('hide');
            overlay.removeClass('show');
            underlay.addClass('hide');
            underlay.removeClass('show');
            cancel.removeClass('hide');

            Y.Event.purgeElement(ok);
            Y.Event.purgeElement(cancel);
            Y.Event.purgeElement(close);
        }

        function doOk(e2) {
            dismiss();
            if (okFunc) {
                okFunc(okArg);
            }
        }

        ok.on('click', doOk);
        close.on('click', doOk);
    }


    // function highlight a particular node
    // currently used to call attention to a node that was changed externally

    function highlight(node) {

        if (!node || node.hasClass('animating')) {	// node may be new
            return;
        }

        var prevBgColor = node.getStyle('backgroundColor');
        var pulseOn = new Y.Anim({
            node: node,
            to: { backgroundColor: '#ffe0b3' }, // '#71B8D0'  },
            duration: 0.300, // 1.6,
            // reverse: true, // direction: 'alternate',
            // iterations: 2,
            last: null
        });

        pulseOnEndHandler = pulseOn.on('end', function () {

            pulseOn = null;

            var pulseOff = new Y.Anim({
                node: node,
                to: { backgroundColor: prevBgColor },
                duration: 0.300
            });

            pulseOff.on('end', function () {
                pulseOff = null;
                node.removeClass('animating');
            });

            function runOff() {
                if (node.getStyle('display')) {	// is it still valid (perhaps has been replaced)
                    pulseOff.run();
                }
            }

            setTimeout(runOff, 2000);

        });

        node.addClass('animating');

        if (node.getStyle('display')) {	// is it still valid (perhaps has been replaced)
            pulseOn.run();
        }

    }


    // point to 

    function pointTo(startNode, targetNode, more, toggle) {

        if (pointToOverlay.get('visible') && toggle) {
            pointToOverlay.hide();
            return;
        }

        if (typeof startNode !== 'object') {	// === 'string') { 
            startNode = Y.one(startNode);
        }
        if (typeof targetNode !== 'object') {	// === 'string') { 
            targetNode = Y.one(targetNode);
        }

        if (!startNode || !targetNode) {
            return;
        }

        var moreX = 0;
        var moreY = 0;
        var moreW = 0;
        var moreH = 0;

        var destBorder = pointToNode.getStyle('border');

        var startXY = startNode.getXY();

        var targetXY = targetNode.getXY();

        var targetWidth = parseInt(targetNode.getStyle('width'), 10);
        var targetHeight = parseInt(targetNode.getStyle('height'), 10);

        var destBorderTW = parseInt(pointToNode.getStyle('border-top-width'), 10) || 0;
        // var destBorderRW = parseInt( pointToNode.getStyle( 'border-right-width' ), 10 ) || 0 ;
        // var destBorderBW = parseInt( pointToNode.getStyle( 'border-bottom-width' ), 10 ) || 0 ;
        var destBorderLW = parseInt(pointToNode.getStyle('border-left-width'), 10) || 0;

        if (more) {

            if (more instanceof Array && more.length >= 4) {

                moreX = more[0];
                moreY = more[1];
                moreW = more[2];
                moreH = more[3];

            } else {	// assume it's one num for padding

                moreX = -more;
                moreY = -more;
                moreW = 2 * more;
                moreH = 2 * more;

            }
        }

        targetXY[0] += moreX - destBorderLW;
        targetXY[1] += moreY - destBorderTW;
        targetWidth += moreW; // destBorderLW + destBorderRW ;
        targetHeight += moreH; // destBorderTW + destBorderBW ;

        // pointToNode.setXY( targetXY ) ;
        // pointToNode.setStyle( 'width', targetWidth + 'px' ) ;
        // pointToNode.setStyle( 'height', targetHeight + 'px' ) ;

        // so any flash of it is in start instead of old 
        pointToNode.setXY(startXY);
        pointToNode.setStyle('width', '0' + 'px');
        pointToNode.setStyle('height', '0' + 'px');


        var showMeAnim = new Y.Anim({
            node: pointToNode,
            from: {
                xy: startXY,
                width: 0,
                height: 0
            },
            to: {
                xy: targetXY,
                width: targetWidth,
                height: targetHeight
            },
            duration: 1.300, // 1.6,
            easing: Y.Easing.easeBoth
            // reverse the animation when hiding?
            // reverse: true, // direction: 'alternate',
            // iterations: 2
        });

        showMeEnd = showMeAnim.on('start', function () {
            pointToOverlay.show(); // show after run so we don't get an old flash of it
            pointToNode.focus(); // show after run so we don't get an old flash of it
        });

        showMeEnd = showMeAnim.on('end', function () {
        });

        showMeAnim.run();

    }


    // set text cursor (yui3 node should have this)

    function setCursor(node, pos) {

        // node = (typeof node == "string" || node instanceof String) ? document.getElementById(node) : node;
        node = (typeof node == "string" || node instanceof String) ? Y.one(node) : node;
        node = node._node;

        if (!node) {
            return false;
        } else if (node.createTextRange) {
            var textRange = node.createTextRange();
            textRange.collapse(true);
            textRange.moveEnd(pos);
            textRange.moveStart(pos);
            textRange.select();
            return true;
        } else if (node.setSelectionRange) {
            node.setSelectionRange(pos, pos);
            return true;
        }

        return false;
    }

    function setSelectionRange(input, selectionStart, selectionEnd) {
        // var input = (typeof input == "string" || input instanceof String) ? document.getElementById(input) : input;
        input = (typeof input == "string" || input instanceof String) ? Y.one(input) : input;
        input = input._node;

        if (input.setSelectionRange) {
            input.focus();
            input.setSelectionRange(selectionStart, selectionEnd);
        } else if (input.createTextRange) {
            var range = input.createTextRange();
            range.collapse(true);
            range.moveEnd('character', selectionEnd);
            range.moveStart('character', selectionStart);
            range.select();
        }
    }
    function setCaretToPos(input, pos) {
        setSelectionRange(input, pos, pos);
    }


    // attach handlers to UI

    function bind() {

        // overlay for pointing out node (highlighting with animation for tip context, whatever

        pointToOverlay = new Y.Overlay({
            srcNode: pointToNode,
            render: true, // .render()
            visible: false, // .hide()
            zIndex: 100,
            // centered	: true,
            // constrain   : true,
            plugins: [
			Y.Plugin.OverlayModal,
			Y.Plugin.OverlayKeepaligned,
			{ fn: Y.Plugin.OverlayAutohide, cfg: {
			    focusedOutside: true  // enables the Overlay from auto-hiding on losing focus
			}
			}
		]
        });

        pointToNode.removeClass('postmile-loading');

        // dismiss if cilcked-on
        pointToOverlay.on('click', function (e) {
            pointToOverlay.hide();
        });

        // dismiss if clicked outside - would be nice if the autohide worked
        pointToNode.ancestor('.yui3-overlay', true).on('blur', function (e) {
            pointToOverlay.hide();
        });


        // event handlers

        Y.on("postmile:pointToNode", function (startNode, targetNode, more) {
            pointTo(startNode, targetNode, more);
        });

        Y.on("postmile:networkError", function (jsonResponse) {
            // statusMessage(JSON.stringify(jsonResponse));
            Y.log(JSON.stringify(jsonResponse));
        });

        Y.on("postmile:statusMessage", function (m) {
            // statusMessage( m );
            Y.log(m);
        });

        Y.on("postmile:changedBy", function (what, by, node) {	// replaces project:updateNode

            var msg = what;

            var whom = Y.postmile.gpostmile.project.participants[by];
            if (whom) {
                msg += ' by ' + whom.display.split(' ')[0];
            }

            statusMessage(msg);
            Y.log(msg);

            if (typeof node !== 'object') {	// === 'string') { 
                node = Y.one(node);
            }

            highlight(node);
        });

        Y.on("postmile:confirm", function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
            confirm(a0, a1, a2, a3, a4, a5, a6, a7, a8);
        });

        Y.on("postmile:inform", function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
            inform(a0, a1, a2, a3, a4, a5, a6, a7, a8);
        });

    }


    // check to see if there's a new version available (minor) or required (major)

    function startVersionChecking() {
        var oneMinute = 1 * 60 * 1000;
        var timeInterval = oneMinute;
        function versionSet() {
            function thisIsTheInitialVersion(response, err) {
                if (response && response['version']) {
                    currentVersion = response.version;
                    Y.log('Project got initial version ' + currentVersion[0] + '.' + currentVersion[1]);
                }
            }
            getClientProfile(thisIsTheInitialVersion);
        }
        function versionCheck() {
            function thisIsTheLatestVersion(response, err) {
                if (response && response['version']) {
                    var version = response.version;
                    function reloadProject(arg) {
                        window.location.reload(true);
                    }
                    if (currentVersion[0] !== version[0]) {
                        // statusMessage( 'New version required - please reload', 2*timeInterval ) ;	// display twice as long
                        Y.fire('postmile:confirm', 'Reload?', 'A new version is available and required.', reloadProject, null);
                        Y.log('Project new major version required ' + version[0] + '.' + version[1]);
                    } else if (currentVersion[1] !== version[1]) {
                        // statusMessage( 'New version available' ) ;
                        // Y.fire( 'postmile:suggest', 'New version available: ' + 'Reload Now', reloadProject, null);
                        statusMessage('New version available - click this message to reload', 2 * 100 * timeInterval, reloadProject); // display twice as long
                        Y.log('Project new major version required ' + version[0] + '.' + version[1]);
                    }
                }
            }
            getClientProfile(thisIsTheLatestVersion);
        }
        versionSet();
        setInterval(versionCheck, timeInterval);
    }

    bind();
    startVersionChecking();


    Y.namespace('postmile').uiutils = {	// export it
        // now mostly event handlers rather than api
        setCursor: setCursor,
        last: null
    };

}, "1.0.0", { requires: ['anim', 'node', 'overlay', 'widget-anim', 'gallery-overlay-extras'] });
