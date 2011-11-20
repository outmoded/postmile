/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/*
* Base functionality
*/

// Active overlay

var activeOverlay = null;
var overlayDialogs = {};


// Close overlay and active dialog

function closeOverlay() {

    if (activeOverlay) {

        document.getElementById('overlay').style.visibility = 'hidden';
        document.getElementById(activeOverlay).style.visibility = 'hidden';
        var onClose = overlayDialogs[activeOverlay].onClose;
        activeOverlay = null;

        if (onClose) {

            onClose();
        }
    }
}


function openOverlay(id) {

    closeOverlay();

    activeOverlay = id;
    document.getElementById('overlay').style.visibility = 'visible';
    document.getElementById(id).style.visibility = 'visible';

    if (overlayDialogs[id].focus) {

        document.getElementById(overlayDialogs[id].focus).focus();
    }
}


// Switch focus on enter

function enterNext(event, id, otherwise) {

    if (event.which === 13) {

        document.getElementById(id).focus();
    }
    else if (otherwise) {

        otherwise();
    }
}


// Execute on enter

function enterCall(event, func, otherwise) {

    if (event.which === 13) {

        func();
    }
    else if (otherwise) {

        otherwise();
    }
}


// Display message scrolling from top

var postmileYUI = (typeof YUI !== 'undefined') ? new YUI() : null;
var notifyNode;
var showAnimation;
var hideAnimation;

function refreshNotifyNode() {

    if (postmileYUI) {

        postmileYUI.use('node-base', 'anim-base', function (Y) {	// called immediately/synchronously if already loaded

            notifyNode = postmileYUI.one('#notify'); // presume DOM ready

            showAnimation = new Y.Anim({
                node: notifyNode,
                to: { opacity: 1, height: '50px' },
                duration: 0.5
            });

            hideAnimation = new Y.Anim({
                node: notifyNode,
                to: { opacity: 0, height: '0px' },
                duration: 0.5
            });

            hideAnimation.on('end', function () {

                document.getElementById('notify').style.top = '-200px';
            });
        });
    }
}

refreshNotifyNode(); // prime the load of 'node' module as well as the data

function notify() {

    if (postmileYUI &&
        env &&
        env.message) {

        document.getElementById('notify').innerHTML = env.message;
        document.getElementById('notify').style.top = '0px';

        refreshNotifyNode(); // just in case DOM changed

        showAnimation.run();
        setTimeout(function () {
            hideAnimation.run();
        }, 7000);
    }
}


/*
 * Account menu
 */

function toggleAccountMenu() {
    var accountMenu = document.getElementById('account-menu').style;
    accountMenu.display = (accountMenu.display === 'block' ? 'none' : 'block');
}


/*
* Lookup input validation
*/

var lookupTimer = {};


function lookupValue(name, currentValue) {

    if (document.getElementById(name).value.length > 20) {

        document.getElementById(name).value = document.getElementById(name).value.slice(0, 19);
    }

    if (lookupTimer[name]) {

        clearTimeout(lookupTimer[name]);
    }

    var value = document.getElementById(name).value;

    if (value === '') {

        document.getElementById(name + '-status').innerHTML = '&nbsp;';
        document.getElementById(name + '-loading').style.visibility = 'hidden';
        return;
    }

    if (value.toLowerCase() === currentValue) {

        document.getElementById(name + '-status').style.color = '#bababa';
        document.getElementById(name + '-status').innerHTML = 'That\'s you!';
        document.getElementById(name + '-loading').style.visibility = 'hidden';
        return;
    }

    lookupTimer[name] = setTimeout("lookupValueRequest('" + name + "')", 1000);

    document.getElementById(name + '-loading').style.visibility = 'visible';
    document.getElementById(name + '-status').style.color = '#bababa';
    document.getElementById(name + '-status').innerHTML = 'Checking...';

    return;
}


function lookupValueRequest(name) {

    var value = document.getElementById(name).value;

    var request = new XMLHttpRequest();

    request.onreadystatechange = function () {

        switch (request.readyState) {

            case 4:

                document.getElementById(name + '-loading').style.visibility = 'hidden';

                if (request.status === 404) {

                    document.getElementById(name + '-status').style.color = '#70b1d4';
                    document.getElementById(name + '-status').innerHTML = 'Available!';
                }
                else {

                    var response = request.responseText;
                    var msg;

                    try {

                        msg = JSON.parse(response);
                    }
                    catch (e) {
                    }

                    document.getElementById(name + '-status').style.color = '#ed145b';
                    document.getElementById(name + '-status').innerHTML = (msg ? (msg.user ? 'Already taken' : (msg.message ? msg.message : 'Unknown error')) : 'Service unavailable');
                }

                break;
        }
    };

    var uri = apiURI + '/user/lookup/' + name + '/' + value;

    request.open('GET', uri);
    request.send();
}


function cancelLookupCheck(name) {

    if (lookupTimer[name]) {

        clearTimeout(lookupTimer[name]);
        document.getElementById(name + '-status').innerHTML = '&nbsp;';
        document.getElementById(name + '-loading').style.visibility = 'hidden';
    }
}


function onUsernameKey(event) {

    if (event) {

        switch (event.which) {

            case 13: return;
            case 27: document.getElementById('username').value = env.currentUsername; break;
        }
    }

    lookupValue('username', env.currentUsername);
}


function checkEmailAddress(address) {

    if (address.length < 6) {

        return 'Address too short';
    }
    else if (address.length > 64) {

        return 'Address too long';
    }
    else if (address.match(/^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/) === null) {

        return 'Invalid email address format';
    }

    return '';
}


/*
* Sign-in
*/

function clearReminder() {

    document.getElementById('lookup-account').value = '';
    document.getElementById('reminder-status').innerHTML = '&nbsp;';
    document.getElementById('reminder-status').style.color = '#ed145b';
    document.getElementById('reminder-main').style.visibility = 'inherit';
    document.getElementById('reminder-post').style.visibility = 'hidden';
}


function reminder() {

    if (document.getElementById('lookup-account').value) {

        var request = new XMLHttpRequest();

        request.onreadystatechange = function () {

            switch (request.readyState) {

                case 2:

                    document.getElementById('reminder-status').style.color = '#ffffff';
                    document.getElementById('reminder-status').innerHTML = 'Please wait...';
                    break;

                case 4:

                    if (request.status === 200) {

                        document.getElementById('reminder-main').style.visibility = 'hidden';
                        document.getElementById('reminder-post').style.visibility = 'visible';
                        document.getElementById('reminder-status').innerHTML = '&nbsp;';
                    }
                    else if (request.status === 400) {

                        document.getElementById('reminder-status').style.color = '#ed145b';
                        document.getElementById('reminder-status').innerHTML = 'Invalid email address';
                    }
                    else if (request.status === 404) {

                        document.getElementById('reminder-status').style.color = '#ed145b';
                        document.getElementById('reminder-status').innerHTML = 'Account not found';
                    }
                    else {

                        document.getElementById('reminder-status').style.color = '#ed145b';
                        document.getElementById('reminder-status').innerHTML = 'Service temporarily unavailable';
                    }

                    break;
            }
        };

        var uri = apiURI + '/account/reminder';
        var body = '{ "account":' + JSON.stringify(document.getElementById('lookup-account').value) + ' }';

        request.open('POST', uri);
        request.setRequestHeader('Content-Type', 'application/json');
        request.send(body);
    }
}

overlayDialogs.reminder = { focus: 'lookup-account', onClose: clearReminder };


/*
* Account Profile
*/

function updateProfile() {

    cancelLookupCheck('username');
    openOverlay('profile-sure');
}


function submitProfile() {

    document.forms['profile-form'].submit();
}


function clearProfile() {

    document.getElementById('username').value = env.username || '';
    document.getElementById('name').value = env.name || '';
}


overlayDialogs['profile-sure'] = { onClose: clearProfile };


/*
* Linked accounts
*/

function unlink(network) {

    document.getElementById('unlink-name').value = network;
    document.forms.unlink.submit();
}


function emailAction(action, address) {

    document.getElementById('emails-form-action').value = action;
    document.getElementById('emails-form-address').value = address;
    document.forms['emails-form'].submit();
}


/*
* Account emails
*/

function addEmail() {

    var address = document.getElementById('add-email').value;

    if (address === '') {

        document.getElementById('add-email-status').innerHTML = 'Please enter a valid email address';
        return;
    }

    var error = checkEmailAddress(address);

    if (error) {

        document.getElementById('add-email-status').innerHTML = error;
        return;
    }

    document.getElementById('add-email-status').innerHTML = '';
    document.getElementById('emails-form-action').value = 'add';
    document.getElementById('emails-form-address').value = address;
    document.forms['emails-form'].submit();
}


/*
* Register
*/

function register() {

    var code = document.getElementById('code').value;

    if (code === '') {

        document.getElementById('register-status').innerHTML = 'Please enter a valid code';
        return;
    }

    if (code.match(/^\w+$/) === null) {

        document.getElementById('register-status').innerHTML = 'Invalid code';
        return;
    }

    var username = document.getElementById('username').value;

    if (username === '') {

        document.getElementById('register-status').innerHTML = 'Please choose a username';
        return;
    }

    var name = document.getElementById('name').value;

    if (name === '') {

        document.getElementById('register-status').innerHTML = 'Please enter your full name';
        return;
    }

    var address = document.getElementById('email').value;

    if (address === '') {

        document.getElementById('register-status').innerHTML = 'Please enter a valid email address';
        return;
    }

    var error = checkEmailAddress(address);

    if (error) {

        document.getElementById('register-status').innerHTML = error;
        return;
    }

    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {

        switch (request.readyState) {

            case 4:

                if (request.status === 200) {

                    document.getElementById('register-status').innerHTML = '&nbsp;';
                    document.forms['register-form'].submit();
                }
                else if (request.status === 400 ||
                         request.status === 404) {

                    var response = request.responseText;
                    var msg;

                    try {

                        msg = JSON.parse(response);
                    }
                    catch (e) {
                    }

                    document.getElementById('register-status').innerHTML = msg.message;
                }
                else {

                    document.getElementById('register-status').innerHTML = 'Service unavailable';
                }

                break;
        }
    };

    var uri = apiURI + '/invite/' + code;

    request.open('GET', uri);
    request.send();
}

function hideRegisterIntro() {

    document.getElementById('error').style.display = 'none';
    document.getElementById('two-columns').style.display = 'block';
    resizeListBox();
}


/*
 * Initialization
 */

function resizeListBox() {

    var mainBox = document.getElementById('main-box');
    var upperHeight = parseInt(mainBox.offsetHeight, 10) + 65;   // 45 + 20
    var height = upperHeight + 90;

    document.body.style.overflowY = (window.innerHeight < height || window.innerWidth < mainBox.offsetWidth ? 'auto' : 'hidden');

    mainBox.style.marginBottom = Math.max(0, window.innerHeight - height) + 'px';

    var footer = document.getElementById('footer').style;
    footer.position = 'static';
    footer.bottom = null;
}

function onPageReady(isRenderMenu) {

    if (isRenderMenu) {

        Y = YUI({ filter: 'raw' }).use("node-menunav", function (Y) {

            var menu = Y.one("#account");
            menu.plug(Y.Plugin.NodeMenuNav, { autoSubmenuDisplay: false });
            menu.get("ownerDocument").get("documentElement").removeClass("yui3-loading");
            var accountMenu = Y.one("#account-menu");
            if (accountMenu) {

                accountMenu.removeClass('hidden');
            }
        });
    }

    window.onresize = resizeListBox;

    resizeListBox();

    notify();
}

