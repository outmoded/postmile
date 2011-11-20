/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* tooltips module - lifted from example, with some mods:
*
*	don't set content in public triggerEnter - gets called too often as user moves mouse over tasks
*	instead, because it requires some processing, set content in showContent - then should make it public
*	also, we have to hack in an attr change to force any wrap to occur correctly on the first showing
*
*/

YUI.add('postmile-tooltips', function (Y) {

    var Lang = Y.Lang,
		Node = Y.Node,
		OX = -10000,
		OY = -10000;
    var mouseMoved; // igore mouse out events from tooltip node appearig under mouse

    var Tooltip = Y.Base.create("tooltip", Y.Widget, [Y.WidgetPosition, Y.WidgetStack], {

        // PROTOTYPE METHODS/PROPERTIES

        /*
        * Initialization Code: Sets up privately used state
        * properties, and publishes the events Tooltip introduces
        */
        initializer: function (config) {

            this._triggerClassName = this.getClassName("trigger");

            // Currently bound trigger node information
            this._currTrigger = {
                node: null,
                title: null,
                mouseX: Tooltip.OFFSCREEN_X,
                mouseY: Tooltip.OFFSCREEN_Y
            };

            // Event handles - mouse over is set on the delegate
            // element, mousemove and mouseleave are set on the trigger node
            this._eventHandles = {
                delegate: null,
                trigger: {
                    mouseMove: null,
                    mouseOut: null
                }
            };

            // Show/hide timers
            this._timers = {
                show: null,
                hide: null
            };

            // Publish events introduced by Tooltip. Note the trigFerEnter event is preventable,
            // with the default behavior defined in the _defTriggerEnterFn method 
            this.publish("triggerEnter", { defaultFn: this._defTriggerEnterFn, preventable: true });
            this.publish("triggerLeave", { preventable: false });
        },

        /*
        * Destruction Code: Clears event handles, timers,
        * and current trigger information
        */
        destructor: function () {
            this._clearCurrentTrigger();
            this._clearTimers();
            this._clearHandles();
        },

        /*
        * bindUI is used to bind attribute change and dom event
        * listeners
        */
        bindUI: function () {
            this.after("delegateChange", this._afterSetDelegate);
            this.after("nodesChange", this._afterSetNodes);

            this._bindDelegate();
        },

        /*
        * syncUI is used to update the rendered DOM, based on the current
        * Tooltip state
        */
        syncUI: function () {
            this._uiSetNodes(this.get("triggerNodes"));
        },

        /*
        * Public method, which can be used by triggerEvent event listeners
        * to set the content of the tooltip for the current trigger node
        */
        setTriggerContent: function (content, fontWeight) {
            var contentBox = this.get("contentBox");
            contentBox.set("innerHTML", "");

            if (content) {
                if (content instanceof Node) {
                    var i, l;
                    for (/*var*/i = 0, l = content.size(); i < l; ++i) {
                        contentBox.appendChild(content.item(i));
                    }
                } else if (Lang.isString(content)) {
                    contentBox.set("innerHTML", content);
                }

                // total hack to provoke chrome into redisplaying the tooltip correctly with wrap
                // (otherwise the first time chrome displays the tooltip it is not correctly wrapped)
                // contentBox.setStyle("font-weight", "lighter");
                // setTimeout( function(){ contentBox.setStyle("font-weight", fontWeight || 'normal'); }, 1 ) ;
            }
        },

        /*
        * Default attribute change listener for 
        * the triggerNodes attribute
        */
        _afterSetNodes: function (e) {
            this._uiSetNodes(e.newVal);
        },

        /*
        * Default attribute change listener for 
        * the delegate attribute
        */
        _afterSetDelegate: function (e) {
            this._bindDelegate(e.newVal);
        },

        /*
        * Updates the rendered DOM to reflect the
        * set of trigger nodes passed in
        */
        _uiSetNodes: function (nodes) {
            if (this._triggerNodes) {
                this._triggerNodes.removeClass(this._triggerClassName);
            }

            if (nodes) {
                this._triggerNodes = nodes;
                this._triggerNodes.addClass(this._triggerClassName);
            }
        },

        /*
        * Attaches the default mouseover DOM listener to the 
        * current delegate node
        */
        _bindDelegate: function () {
            var eventHandles = this._eventHandles;

            if (eventHandles.delegate) {
                eventHandles.delegate.detach();
                eventHandles.delegate = null;
            }
            eventHandles.delegate = Y.delegate("mouseenter", Y.bind(this._onNodeMouseEnter, this), this.get("delegate"), "." + this._triggerClassName);
        },

        /*
        * Default mouse enter DOM event listener.
        * 
        * Delegates to the _enterTrigger method,
        * if the mouseover enters a trigger node.
        */
        _onNodeMouseEnter: function (e) {
            mouseMoved = false;
            var node = e.currentTarget;
            if (node && (!this._currTrigger.node || !node.compareTo(this._currTrigger.node))) {
                this._enterTrigger(node, e.pageX, e.pageY);
            }
        },

        /*
        * Default mouse leave DOM event listener
        * 
        * Delegates to _leaveTrigger if the mouse
        * leaves the current trigger node
        */
        _onNodeMouseLeave: function (e) {
            mouseMoved = false;
            this._leaveTrigger(e.currentTarget);
        },

        /*
        * Default mouse move DOM event listener
        */
        _onNodeMouseMove: function (e) {
            mouseMoved = true;
            this._overTrigger(e.pageX, e.pageY);
        },

        /*
        * Default handler invoked when the mouse enters
        itrigger node. Fires the triggerEnter
        * event which can be prevented by listeners to 
        * show the tooltip from being displayed.
        */
        _enterTrigger: function (node, x, y) {
            this._setCurrentTrigger(node, x, y);
            this.fire("triggerEnter", { node: node, pageX: x, pageY: y });
        },

        /*
        * Default handler for the triggerEvent event,
        * which will setup the timer to display the tooltip,
        * if the default handler has not been prevented.
        */
        _defTriggerEnterFn: function (e) {
            var node = e.node;
            if (!this.get("disabled")) {
                this._clearTimers();
                var delay = (this.get("visible")) ? 0 : this.get("showDelay");
                this._timers.show = Y.later(delay, this, this._showTooltip, [node]);
            }
        },

        /*
        * Default handler invoked when the mouse leaves
        * the current trigger node. Fires the triggerLeave
        * event and sets up the hide timer
        */
        _leaveTrigger: function (node) {
            if (!mouseMoved) {
                // return ;
            }

            this.fire("triggerLeave");

            this._clearCurrentTrigger();
            this._clearTimers();

            this._timers.hide = Y.later(this.get("hideDelay"), this, this._hideTooltip);
        },

        /*
        * Default handler invoked for mousemove events
        * on the trigger node. Stores the current mouse 
        * x, y positions
        */
        _overTrigger: function (x, y) {
            this._currTrigger.mouseX = x;
            this._currTrigger.mouseY = y;
        },

        /*
        * Shows the tooltip, after moving it to the current mouse
        * position.
        */
        _showTooltip: function (node) {

            // todo: refactor this out of base tooltip
            // var detailsClosed = node.ancestor( 'li' ).one( '.taskdetails' ).getStyle( 'display' ) === 'none' ;
            var detailsOpen = node.ancestor('li').hasClass('open');
            if (detailsOpen) {
                return;
            }

            // from setTriggerContent
            var taskNode = node; // trigger is not the anchor, not the li
            var liNode = node.ancestor('li'); // to compare widths
            // careful, this is hackish, comparing pixels from css to see if under 80% size
            nw = parseInt(taskNode.getStyle('width'), 10);
            anw = parseInt(liNode.getStyle('width'), 10);
            var sel = window.getSelection().toString();
            var editing = liNode.hasClass('editing');
            if (taskNode._node.scrollWidth > taskNode._node.clientWidth && !sel && !editing) {
                this.setTriggerContent(taskNode.get('text'), taskNode.getStyle('font-weight'));
            } else {
                this.setTriggerContent('');
                return;
            }

            // var x = this._currTrigger.mouseX;
            // var y = this._currTrigger.mouseY;
            var x = node.getX();
            var y = node.getY();

            this.move(x + Tooltip.OFFSET_X, y + Tooltip.OFFSET_Y);

            this.show();
            this._clearTimers();

            this._timers.hide = Y.later(this.get("autoHideDelay"), this, this._hideTooltip);
        },

        /*
        * Hides the tooltip, after clearing existing timers.
        */
        _hideTooltip: function () {
            this._clearTimers();
            this.hide();
        },

        /*
        * Set the rendered content of the tooltip for the current
        * trigger, based on (in order of precedence):
        * 
        * a). The string/node content attribute value
        * b). From the content lookup map if it is set, or 
        * c). From the title attribute if set.
        */
        _setTriggerContent: function (node) {
            var content = this.get("content");
            if (content && !(content instanceof Node || Lang.isString(content))) {
                content = content[node.get("id")] || node.getAttribute("title");
            }
            this.setTriggerContent(content);
        },

        /*
        * Set the currently bound trigger node information, clearing 
        * out the title attribute if set and setting up mousemove/out 
        * listeners.
        */
        _setCurrentTrigger: function (node, x, y) {

            var currTrigger = this._currTrigger,
				triggerHandles = this._eventHandles.trigger;

            this._setTriggerContent(node);

            triggerHandles.mouseMove = Y.on("mousemove", Y.bind(this._onNodeMouseMove, this), node);
            triggerHandles.mouseOut = Y.on("mouseleave", Y.bind(this._onNodeMouseLeave, this), node);

            var title = node.getAttribute("title");
            node.setAttribute("title", "");

            currTrigger.mouseX = x;
            currTrigger.mouseY = y;
            currTrigger.node = node;
            currTrigger.title = title;
        },

        /*
        * Clear out the current trigger state, restoring
        * the title attribute on the trigger node, 
        * if it was originally set.
        */
        _clearCurrentTrigger: function () {

            var currTrigger = this._currTrigger,
				triggerHandles = this._eventHandles.trigger;

            if (currTrigger.node) {
                var node = currTrigger.node;
                var title = currTrigger.title || "";

                currTrigger.node = null;
                currTrigger.title = "";

                triggerHandles.mouseMove.detach();
                triggerHandles.mouseOut.detach();
                triggerHandles.mouseMove = null;
                triggerHandles.mouseOut = null;

                node.setAttribute("title", title);
            }
        },

        /*
        * Cancel any existing show/hide timers
        */
        _clearTimers: function () {
            var timers = this._timers;
            if (timers.hide) {
                timers.hide.cancel();
                timers.hide = null;
            }
            if (timers.show) {
                timers.show.cancel();
                timers.show = null;
            }
        },

        /*
        * Detach any stored event handles
        */
        _clearHandles: function () {
            var eventHandles = this._eventHandles;

            if (eventHandles.delegate) {
                this._eventHandles.delegate.detach();
            }
            if (eventHandles.trigger.mouseOut) {
                eventHandles.trigger.mouseOut.detach();
            }
            if (eventHandles.trigger.mouseMove) {
                eventHandles.trigger.mouseMove.detach();
            }
        }
    }, {

        // STATIC METHODS/PROPERTIES

        // OFFSET_X : 15,
        // OFFSET_Y : 15,
        OFFSET_X: 0,
        OFFSET_Y: 0,
        OFFSCREEN_X: OX,
        OFFSCREEN_Y: OY,

        ATTRS: {

            /* 
            * The tooltip content. This can either be a fixed content value, 
            * or a map of id-to-values, designed to be used when a single
            * tooltip is mapped to multiple trigger elements.
            */
            content: {
                value: null
            },

            /* 
            * The set of nodes to bind to the tooltip instance. Can be a string, 
            * or a node instance.
            */
            triggerNodes: {
                value: null,
                setter: function (val) {
                    if (val && Lang.isString(val)) {
                        val = Node.all(val);
                    }
                    return val;
                }
            },

            /*
            * The delegate node to which event listeners should be attached.
            * This node should be an ancestor of all trigger nodes bound
            * to the instance. By default the document is used.
            */
            delegate: {
                value: null,
                setter: function (val) {
                    return Y.one(val) || Y.one("document");
                }
            },

            /*
            * The time to wait, after the mouse enters the trigger node,
            * to display the tooltip
            */
            showDelay: {
                value: 1250
            },

            /*
            * The time to wait, after the mouse leaves the trigger node,
            * to hide the tooltip
            */
            hideDelay: {
                value: 10
            },

            /*
            * The time to wait, after the tooltip is first displayed for 
            * a trigger node, to hide it, if the mouse has not left the 
            * trigger node
            */
            autoHideDelay: {
                value: 20000
            },

            /*
            * Override the default visibility set by the widget base class
            */
            visible: {
                value: false
            },

            /*
            * Override the default XY value set by the widget base class,
            * to position the tooltip offscreen
            */
            xy: {
                value: [OX, OY]
            }
        }
    });

    var tasktip = new Tooltip({
        triggerNodes: ".yui3-hastooltip",
        delegate: "#tasks",
        content: {
            tt3: "Tooltip 3 (from lookup)"
        },
        shim: false,
        zIndex: 2
    });
    tasktip.render();

    tasktip.on("triggerEnter", function (e) {
        // var node = e.node;	// get('id')...
        // this has moved out of trigger and into render (trigger/mouseenter happens to frequently)
    });

    /*
    var prevent = Y.one("#prevent");
    tasktip.on("triggerEnter", function(e) {
    var node = e.node;
    if (prevent && prevent.get("checked")) {
    if (node && node.get("id") == "tt4") {
    e.preventDefault();
    }
    }
    });
    */

    Y.namespace('postmile').tooltips = {	// export it
        Tooltip: Tooltip,
        tasktip: tasktip,
        last: null
    };

}, "1.0.0", { requires: ['event-mouseenter', 'widget', 'widget-position', 'widget-stack'] });
