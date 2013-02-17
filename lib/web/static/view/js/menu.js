/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Based on YUI 3 MenuNav Node Plugin
// http://developer.yahoo.com/yui/3/node-menunav/


//	Utility functions

var isAnchor = function (node) {

    return (node ? node.get('nodeName').toLowerCase() === 'a' : false);
};

var isMenuItem = function (node) {

    return node.hasClass('menuitem');
};

var isMenuLabel = function (node) {

    return node.hasClass('menu-label');
};

var hasVisibleSubmenu = function (menuLabel) {

    return menuLabel.hasClass('menu-label-menuvisible');

};

var getItemAnchor = function (node) {

    return isAnchor(node) ? node : node.one('a');
};

var getNodeWithClass = function (node, className, searchAncestors) {

    var oItem;

    if (node) {

        if (node.hasClass(className)) {
            oItem = node;
        }

        if (!oItem && searchAncestors) {
            oItem = node.ancestor(('.' + className));
        }
    }

    return oItem;
};

var getParentMenu = function (node) {

    return node.ancestor('.menu');
};

var getMenu = function (node, searchAncestors) {

    return getNodeWithClass(node, 'menu', searchAncestors);
};

var getMenuItem = function (node, searchAncestors) {

    var oItem;

    if (node) {
        oItem = getNodeWithClass(node, 'menuitem', searchAncestors);
    }

    return oItem;
};

var getMenuLabel = function (node, searchAncestors) {

    var oItem;

    if (node) {

        if (searchAncestors) {
            oItem = getNodeWithClass(node, 'menu-label', searchAncestors);
        }
        else {
            oItem = getNodeWithClass(node, 'menu-label') || node.one(('.' + 'menu-label'));
        }
    }

    return oItem;
};

var getItem = function (node, searchAncestors) {

    var oItem;

    if (node) {
        oItem = getMenuItem(node, searchAncestors) || getMenuLabel(node, searchAncestors);
    }

    return oItem;
};

var getFirstItem = function (menu) {

    return getItem(menu.one('li'));
};

var getActiveClass = function (node) {

    return isMenuItem(node) ? 'menuitem-active' : 'menu-label-active';
};

var handleMouseOverForNode = function (node, target) {

    return node && !node['handledMouseOver'] && (node.compareTo(target) || node.contains(target));
};

var handleMouseOutForNode = function (node, relatedTarget) {

    return node && !node['handledMouseOut'] && (!node.compareTo(relatedTarget) && !node.contains(relatedTarget));
};

var NodeMenuNav = function () {

    NodeMenuNav.superclass.constructor.apply(this, arguments);
};

NodeMenuNav.NAME = 'nodeMenuNav';
NodeMenuNav.NS = 'menuNav';

NodeMenuNav.ATTRS = {

    mouseOutHideDelay: {

        value: 250
    }
};


Y.extend(NodeMenuNav, Y.Plugin.Base, {

    //	Protected properties

    _rootMenu: null,            // Node instance representing the root menu in the menu
    _activeItem: null,          // Node instance representing the menu's active descendent: the menuitem or menu label the user is currently interacting with
    _activeMenu: null,          // Node instance representing the menu that is the parent of the menu's active descendent
    _hasFocus: false,           // Boolean indicating if the menu has focus
    _currentMouseX: 0,          // Number representing the current x coordinate of the mouse inside the menu
    _movingToSubmenu: false,    // Boolean indicating if the mouse is moving from a menu label to its corresponding submenu
    _hideAllSubmenusTimer: null, // Timer used to hide a all submenus
    _firstItem: null,           // Node instance representing the first item (menuitem or menu label) in the root menu of a menu

    //	Public methods

    initializer: function (config) {

        var menuNav = this,
			oRootMenu = this.get('host'),
			aHandlers = [],
			oDoc;

        if (oRootMenu) {

            menuNav._rootMenu = oRootMenu;

            //	Hide all visible submenus

            oRootMenu.all('.menu').addClass('menu-hidden');

            //	Wire up all event handlers

            aHandlers.push(oRootMenu.on('mouseover', menuNav._onMouseOver, menuNav));
            aHandlers.push(oRootMenu.on('mouseout', menuNav._onMouseOut, menuNav));
            aHandlers.push(oRootMenu.on('mousemove', menuNav._onMouseMove, menuNav));
            aHandlers.push(oRootMenu.on('mousedown', menuNav._toggleSubmenuDisplay, menuNav));
            aHandlers.push(oRootMenu.on('click', menuNav._toggleSubmenuDisplay, menuNav));
            oDoc = oRootMenu.get('ownerDocument');
            aHandlers.push(oDoc.on('mousedown', menuNav._onDocMouseDown, menuNav));
            aHandlers.push(oDoc.on('focus', menuNav._onDocFocus, menuNav));
            this._eventHandlers = aHandlers;
            menuNav._initFocusManager();
        }
    },

    destructor: function () {

        var aHandlers = this._eventHandlers;

        if (aHandlers) {

            Y.Array.each(aHandlers, function (handle) {
                handle.detach();
            });

            this._eventHandlers = null;
        }

        this.get('host').unplug('focusManager');
    },

    //	Protected methods

    /**
    * @method _isRoot
    * @description Returns a boolean indicating if the specified menu is the 
    * root menu in the menu.
    * @protected
    * @param {Node} menu Node instance representing a menu.
    * @return {Boolean} Boolean indicating if the specified menu is the root 
    * menu in the menu.
    */
    _isRoot: function (menu) {

        return this._rootMenu.compareTo(menu);
    },

    /**
    * @method _getTopmostSubmenu
    * @description Returns the topmost submenu of a submenu hierarchy.
    * @protected
    * @param {Node} menu Node instance representing a menu.
    * @return {Node} Node instance representing a menu.
    */
    _getTopmostSubmenu: function (menu) {

        var menuNav = this,
			oMenu = getParentMenu(menu),
			returnVal;


        if (!oMenu) {
            returnVal = menu;
        }
        else if (menuNav._isRoot(oMenu)) {
            returnVal = menu;
        }
        else {
            returnVal = menuNav._getTopmostSubmenu(oMenu);
        }

        return returnVal;
    },

    /**
    * @method _clearActiveItem
    * @description Clears the menu's active descendent.
    * @protected
    */
    _clearActiveItem: function () {

        var menuNav = this,
			oActiveItem = menuNav._activeItem;

        if (oActiveItem) {
            oActiveItem.removeClass(getActiveClass(oActiveItem));
        }

        menuNav._activeItem = null;
    },

    /**
    * @method _setActiveItem
    * @description Sets the specified menuitem or menu label as the menu's 
    * active descendent.
    * @protected
    * @param {Node} item Node instance representing a menuitem or menu label.
    */
    _setActiveItem: function (item) {

        var menuNav = this;

        if (item) {

            menuNav._clearActiveItem();
            item.addClass(getActiveClass(item));
            menuNav._activeItem = item;
        }
    },

    /**
    * @method _focusItem
    * @description Focuses the specified menuitem or menu label.
    * @protected
    * @param {Node} item Node instance representing a menuitem or menu label.
    */
    _focusItem: function (item) {

        var menuNav = this,
			oMenu,
			oItem;

        if (item && menuNav._hasFocus) {

            oMenu = getParentMenu(item);
            oItem = getItemAnchor(item);

            if (oMenu && !oMenu.compareTo(menuNav._activeMenu)) {
                menuNav._activeMenu = oMenu;
                menuNav._initFocusManager();
            }

            menuNav._focusManager.focus(oItem);
        }
    },

    /**
    * @method _showMenu
    * @description Shows the specified menu.
    * @protected
    * @param {Node} menu Node instance representing a menu.
    */
    _showMenu: function (menu) {

        var oParentMenu = getParentMenu(menu),
			oLI = menu.get('parentNode');

        menu.previous().addClass('menu-label-menuvisible');
        menu.removeClass('menu-hidden');
    },

    /**
    * @method _hideMenu 
    * @description Hides the specified menu.
    * @protected
    * @param {Node} menu Node instance representing a menu.
    * @param {Boolean} activateAndFocusLabel Boolean indicating if the label 
    * for the specified 
    * menu should be focused and set as active.
    */
    _hideMenu: function (menu, activateAndFocusLabel) {

        var menuNav = this,
			oLabel = menu.previous(),
			oActiveItem;

        oLabel.removeClass('menu-label-menuvisible');

        if (activateAndFocusLabel) {
            menuNav._focusItem(oLabel);
            menuNav._setActiveItem(oLabel);
        }

        oActiveItem = menu.one(('.' + 'menuitem-active'));

        if (oActiveItem) {
            oActiveItem.removeClass('menuitem-active');
        }

        menu.addClass('menu-hidden');
    },

    /**
    * @method _hideAllSubmenus
    * @description Hides all submenus of the specified menu.
    * @protected
    * @param {Node} menu Node instance representing a menu.
    */
    _hideAllSubmenus: function (menu) {

        var menuNav = this;

        menu.all('.menu').each(Y.bind(function (submenuNode) {

            menuNav._hideMenu(submenuNode);
        }, menuNav));
    },

    /**
    * @method _initFocusManager
    * @description Initializes and updates the Focus Manager so that is is 
    * always managing descendants of the active menu.
    * @protected
    */
    _initFocusManager: function () {

        var menuNav = this,
			oRootMenu = menuNav._rootMenu,
			oMenu = menuNav._activeMenu || oRootMenu,
			sSelectorBase =
				menuNav._isRoot(oMenu) ? '' : ('#' + oMenu.get('id')),
			oFocusManager = menuNav._focusManager,
			sKeysVal,
			sDescendantSelector,
			sQuery;

        sDescendantSelector = sSelectorBase + '>.menu-content>ul>li>a';
        sKeysVal = { next: 'down:40', previous: 'down:38' };

        if (!oFocusManager) {

            oRootMenu.plug(Y.Plugin.NodeFocusManager, {
                descendants: sDescendantSelector,
                keys: sKeysVal,
                circular: true
            });

            oFocusManager = oRootMenu.focusManager;

            sQuery = '#' + oRootMenu.get('id') + '.menu' + ' a,' + '.menu-toggle';

            oRootMenu.all(sQuery).set('tabIndex', -1);

            oFocusManager.after('activeDescendantChange', this._afterActiveDescendantChange, oFocusManager, this);
            menuNav._focusManager = oFocusManager;
        }
        else {

            oFocusManager.set('activeDescendant', -1);
            oFocusManager.set('descendants', sDescendantSelector);
            oFocusManager.set('keys', sKeysVal);
        }
    },

    //	Event handlers for discrete pieces of pieces of the menu

    /**
    * @method _afterActiveDescendantChange
    * @description "activeDescendantChange" event handler for menu's 
    * Focus Manager.
    * @protected
    * @param {Object} event Object representing the Attribute change event.
    * @param {NodeMenuNav} menuNav Object representing the NodeMenuNav instance.
    */
    _afterActiveDescendantChange: function (event, menuNav) {

        var oItem;

        if (event.src === 'UI') {
            oItem = getItem(this.get('descendants').item(event.newVal), true);
            menuNav._setActiveItem(oItem);
        }
    },

    /**
    * @method _onDocFocus
    * @description "focus" event handler for the owner document of the MenuNav.
    * @protected
    * @param {Object} event Object representing the DOM event.
    */
    _onDocFocus: function (event) {

        var menuNav = this,
			oActiveItem = menuNav._activeItem,
			oTarget = event.target,
			oMenu;

        if (menuNav._rootMenu.contains(oTarget)) {	//	The menu has focus

            if (menuNav._hasFocus) {

                oMenu = getParentMenu(oTarget);

                //	If the element that was focused is a descendant of the 
                //	root menu, but is in a submenu not currently being 
                //	managed by the Focus Manager, update the Focus Manager so 
                //	that it is now managing the submenu that is the parent of  
                //	the element that was focused.

                if (!menuNav._activeMenu.compareTo(oMenu)) {

                    menuNav._activeMenu = oMenu;
                    menuNav._initFocusManager();
                    menuNav._focusManager.set('activeDescendant', oTarget);
                    menuNav._setActiveItem(getItem(oTarget, true));
                }
            }
            else { //	Initial focus

                //	First time the menu has been focused, need to setup focused 
                //	state and established active active descendant

                menuNav._hasFocus = true;
                oActiveItem = getItem(oTarget, true);

                if (oActiveItem) {
                    menuNav._setActiveItem(oActiveItem);
                }
            }
        }
        else {	//	The menu has lost focus

            menuNav._clearActiveItem();
            menuNav._hideAllSubmenus(menuNav._rootMenu);
            menuNav._activeMenu = menuNav._rootMenu;
            menuNav._initFocusManager();
            menuNav._focusManager.set('activeDescendant', 0);
            menuNav._hasFocus = false;
        }
    },

    /**
    * @method _onMenuMouseOver
    * @description "mouseover" event handler for a menu.
    * @protected
    * @param {Node} menu Node instance representing a menu.
    * @param {Object} event Object representing the DOM event.
    */
    _onMenuMouseOver: function (menu, event) {

        var menuNav = this,
			oHideAllSubmenusTimer = menuNav._hideAllSubmenusTimer;

        if (oHideAllSubmenusTimer) {
            oHideAllSubmenusTimer.cancel();
            menuNav._hideAllSubmenusTimer = null;
        }

        //	Need to update the FocusManager in advance of focus a new 
        //	Menu in order to avoid the FocusManager thinking that 
        //	it has lost focus

        if (menu && !menu.compareTo(menuNav._activeMenu)) {
            menuNav._activeMenu = menu;

            if (menuNav._hasFocus) {
                menuNav._initFocusManager();
            }
        }
    },

    /**
    * @method _hideAndFocusLabel
    * @description Hides all of the submenus of the root menu and focuses the 
    * label of the topmost submenu
    * @protected
    */
    _hideAndFocusLabel: function () {

        var menuNav = this,
			oActiveMenu = menuNav._activeMenu,
			oSubmenu;

        menuNav._hideAllSubmenus(menuNav._rootMenu);

        if (oActiveMenu) {

            //	Focus the label element for the topmost submenu
            oSubmenu = menuNav._getTopmostSubmenu(oActiveMenu);
            menuNav._focusItem(oSubmenu.previous());
        }
    },

    /**
    * @method _onMenuMouseOut
    * @description "mouseout" event handler for a menu.
    * @protected
    * @param {Node} menu Node instance representing a menu.
    * @param {Object} event Object representing the DOM event.
    */
    _onMenuMouseOut: function (menu, event) {

        var menuNav = this,
			oActiveMenu = menuNav._activeMenu,
			oRelatedTarget = event.relatedTarget,
			oActiveItem = menuNav._activeItem,
			oParentMenu,
			oMenu;

        if (oActiveMenu && !oActiveMenu.contains(oRelatedTarget)) {

            oParentMenu = getParentMenu(oActiveMenu);

            if (oParentMenu && !oParentMenu.contains(oRelatedTarget)) {

                if (menuNav.get('mouseOutHideDelay') > 0) {

                    menuNav._hideAllSubmenusTimer = Y.later(menuNav.get('mouseOutHideDelay'), menuNav, menuNav._hideAndFocusLabel);
                }
            }
            else {

                if (oActiveItem) {

                    oMenu = getParentMenu(oActiveItem);

                    if (!menuNav._isRoot(oMenu)) {
                        menuNav._focusItem(oMenu.previous());
                    }
                }
            }
        }
    },

    /**
    * @method _onMenuLabelMouseOver
    * @description "mouseover" event handler for a menu label.
    * @protected
    * @param {Node} menuLabel Node instance representing a menu label.
    * @param {Object} event Object representing the DOM event.
    */
    _onMenuLabelMouseOver: function (menuLabel, event) {

        var menuNav = this,
			oActiveMenu = menuNav._activeMenu,
			bIsRoot = menuNav._isRoot(oActiveMenu),
			oSubmenu;

        menuNav._focusItem(menuLabel);
        menuNav._setActiveItem(menuLabel);
    },

    /**
    * @method _onMenuLabelMouseOut
    * @description "mouseout" event handler for a menu label.
    * @protected
    * @param {Node} menuLabel Node instance representing a menu label.
    * @param {Object} event Object representing the DOM event.
    */
    _onMenuLabelMouseOut: function (menuLabel, event) {

        var menuNav = this,
			bIsRoot = menuNav._isRoot(menuNav._activeMenu);

        oRelatedTarget = event.relatedTarget,
			oSubmenu = menuLabel.next(),
			hoverTimer = menuNav._hoverTimer;

        if (hoverTimer) {
            hoverTimer.cancel();
        }

        menuNav._clearActiveItem();
    },

    /**
    * @method _onMenuItemMouseOver
    * @description "mouseover" event handler for a menuitem.
    * @protected
    * @param {Node} menuItem Node instance representing a menuitem.
    * @param {Object} event Object representing the DOM event.
    */
    _onMenuItemMouseOver: function (menuItem, event) {

        var menuNav = this,
			oActiveMenu = menuNav._activeMenu,
			bIsRoot = menuNav._isRoot(oActiveMenu);

        menuNav._focusItem(menuItem);
        menuNav._setActiveItem(menuItem);
    },

    /**
    * @method _onMenuItemMouseOut
    * @description "mouseout" event handler for a menuitem.
    * @protected
    * @param {Node} menuItem Node instance representing a menuitem.
    * @param {Object} event Object representing the DOM event.
    */
    _onMenuItemMouseOut: function (menuItem, event) {

        this._clearActiveItem();
    },

    //	Generic DOM Event handlers

    /**
    * @method _onMouseMove
    * @description "mousemove" event handler for the menu.
    * @protected
    * @param {Object} event Object representing the DOM event.
    */
    _onMouseMove: function (event) {

        var menuNav = this;

        //	Using a timer to set the value of the "_currentMouseX" property 
        //	helps improve the reliability of the calculation used to set the 
        //	value of the "_movingToSubmenu" property - especially in Opera.

        Y.later(10, menuNav, function () {

            menuNav._currentMouseX = event.pageX;
        });
    },

    /**
    * @method _onMouseOver
    * @description "mouseover" event handler for the menu.
    * @protected
    * @param {Object} event Object representing the DOM event.
    */
    _onMouseOver: function (event) {

        var menuNav = this,
			oTarget,
			oMenu,
			oMenuLabel,
			oParentMenu,
			oMenuItem;

        oTarget = event.target;
        oMenu = getMenu(oTarget, true);
        oMenuLabel = getMenuLabel(oTarget, true);
        oMenuItem = getMenuItem(oTarget, true);

        if (handleMouseOverForNode(oMenu, oTarget)) {

            menuNav._onMenuMouseOver(oMenu, event);

            oMenu['handledMouseOver'] = true;
            oMenu['handledMouseOut'] = false;

            oParentMenu = getParentMenu(oMenu);

            if (oParentMenu) {

                oParentMenu['handledMouseOut'] = true;
                oParentMenu['handledMouseOver'] = false;
            }
        }

        if (handleMouseOverForNode(oMenuLabel, oTarget)) {

            menuNav._onMenuLabelMouseOver(oMenuLabel, event);

            oMenuLabel['handledMouseOver'] = true;
            oMenuLabel['handledMouseOut'] = false;
        }

        if (handleMouseOverForNode(oMenuItem, oTarget)) {

            menuNav._onMenuItemMouseOver(oMenuItem, event);

            oMenuItem['handledMouseOver'] = true;
            oMenuItem['handledMouseOut'] = false;
        }
    },

    /**
    * @method _onMouseOut
    * @description "mouseout" event handler for the menu.
    * @protected
    * @param {Object} event Object representing the DOM event.
    */
    _onMouseOut: function (event) {

        var menuNav = this,
			oActiveMenu = menuNav._activeMenu,
			bMovingToSubmenu = false,
			oTarget,
			oRelatedTarget,
			oMenu,
			oMenuLabel,
			oSubmenu,
			oMenuItem;

        menuNav._movingToSubmenu = (oActiveMenu && ((event.pageX - 5) > menuNav._currentMouseX));

        oTarget = event.target;
        oRelatedTarget = event.relatedTarget;
        oMenu = getMenu(oTarget, true);
        oMenuLabel = getMenuLabel(oTarget, true);
        oMenuItem = getMenuItem(oTarget, true);

        if (handleMouseOutForNode(oMenuLabel, oRelatedTarget)) {

            menuNav._onMenuLabelMouseOut(oMenuLabel, event);

            oMenuLabel['handledMouseOut'] = true;
            oMenuLabel['handledMouseOver'] = false;
        }

        if (handleMouseOutForNode(oMenuItem, oRelatedTarget)) {

            menuNav._onMenuItemMouseOut(oMenuItem, event);

            oMenuItem['handledMouseOut'] = true;
            oMenuItem['handledMouseOver'] = false;
        }

        if (oMenuLabel) {

            oSubmenu = oMenuLabel.next();

            if (oSubmenu && oRelatedTarget &&
				(oRelatedTarget.compareTo(oSubmenu) ||
					oSubmenu.contains(oRelatedTarget))) {

                bMovingToSubmenu = true;
            }
        }

        if (handleMouseOutForNode(oMenu, oRelatedTarget) || bMovingToSubmenu) {

            menuNav._onMenuMouseOut(oMenu, event);

            oMenu['handledMouseOut'] = true;
            oMenu['handledMouseOver'] = false;
        }
    },

    /**
    * @method _toggleSubmenuDisplay
    * @description "mousedown," "keydown," and "click" event handler for the 
    * menu used to toggle the display of a submenu.
    * @protected
    * @param {Object} event Object representing the DOM event.
    */
    _toggleSubmenuDisplay: function (event) {

        var menuNav = this,
			oTarget = event.target,
			oMenuLabel = getMenuLabel(oTarget, true),
			sType = event.type,
			oAnchor,
			oSubmenu,
			sHref,
			nHashPos,
			nLen,
			sId;

        if (oMenuLabel) {

            oAnchor = isAnchor(oTarget) ? oTarget : oTarget.ancestor(isAnchor);

            if (oAnchor) {

                sHref = oAnchor.getAttribute('href', 2);
                nHashPos = sHref.indexOf('#');
                nLen = sHref.length;

                if (nHashPos === 0 && nLen > 1) {

                    sId = sHref.substr(1, nLen);
                    oSubmenu = oMenuLabel.next();

                    if (oSubmenu && (oSubmenu.get('id') === sId)) {

                        if (sType === 'mousedown' || sType === 'keydown') {

                            if (sType == 'mousedown') {

                                //	Prevent the target from getting focused by 
                                //	default, since the element to be focused will
                                //	be determined by weather or not the submenu
                                //	is visible.
                                event.preventDefault();

                                //	FocusManager will attempt to focus any 
                                //	descendant that is the target of the mousedown
                                //	event.  Since we want to explicitly control 
                                //	where focus is going, we need to call 
                                //	"stopImmediatePropagation" to stop the 
                                //	FocusManager from doing its thing.
                                event.stopImmediatePropagation();

                                //	The "_focusItem" method relies on the 
                                //	"_hasFocus" property being set to true.  The
                                //	"_hasFocus" property is normally set via a 
                                //	"focus" event listener, but since we've 
                                //	blocked focus from happening, we need to set 
                                //	this property manually.
                                menuNav._hasFocus = true;
                            }

                            if (menuNav._isRoot(getParentMenu(oTarget))) {	//	Event target is a submenu label in the root menu

                                //	Menu label toggle functionality

                                if (hasVisibleSubmenu(oMenuLabel)) {

                                    menuNav._hideMenu(oSubmenu);
                                    menuNav._focusItem(oMenuLabel);
                                    menuNav._setActiveItem(oMenuLabel);
                                }
                                else {

                                    menuNav._hideAllSubmenus(menuNav._rootMenu);
                                    menuNav._showMenu(oSubmenu);

                                    menuNav._focusItem(getFirstItem(oSubmenu));
                                    menuNav._setActiveItem(getFirstItem(oSubmenu));
                                }
                            }
                            else {	//	Event target is a submenu label within a submenu

                                if (menuNav._activeItem == oMenuLabel) {

                                    menuNav._showMenu(oSubmenu);
                                    menuNav._focusItem(getFirstItem(oSubmenu));
                                    menuNav._setActiveItem(getFirstItem(oSubmenu));
                                }
                                else {

                                    if (!oMenuLabel._clickHandle) {

                                        oMenuLabel._clickHandle = oMenuLabel.on('click', function () {

                                            menuNav._hideAllSubmenus(menuNav._rootMenu);
                                            menuNav._hasFocus = false;
                                            menuNav._clearActiveItem();
                                            oMenuLabel._clickHandle.detach();
                                            oMenuLabel._clickHandle = null;
                                        });
                                    }
                                }
                            }
                        }

                        if (sType === 'click') {

                            //	Prevent the browser from following the URL of 
                            //	the anchor element

                            event.preventDefault();
                        }
                    }
                }
            }
        }
    },

    /**
    * @method _onDocMouseDown
    * @description "mousedown" event handler for the owner document of 
    * the menu.
    * @protected
    * @param {Object} event Object representing the DOM event.
    */
    _onDocMouseDown: function (event) {

        var menuNav = this,
			oRoot = menuNav._rootMenu,
			oTarget = event.target;

        if (!(oRoot.compareTo(oTarget) || oRoot.contains(oTarget))) {

            menuNav._hideAllSubmenus(oRoot);
        }
    }
});

Y.namespace('Plugin');
Y.Plugin.NodeMenuNav = NodeMenuNav;
