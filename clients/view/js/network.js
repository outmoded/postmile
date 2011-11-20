/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

/**
*
* global network code and data
*
*	needed before YUI is loaded to start net req of project data
*	use Y.fire for misc when it become available
*
*
*/

var session;
var fragment;


// wow, even mentioning, uh, Voldemort_log here in the comments causes yui compressor to remove part of this func
// so what does yui compressor do with the hour it just stole from my life?

function xLog(m) {
    if (typeof Y === 'undefined') {
        console.log(m);
    } else {
        Y.log(m);
    }
}

function xFire(e, a1, a2, a3) {
    if ((typeof (Y) === 'undefined') || (typeof (Y.fire) === 'undefined')) {
        console.log('Y not available to fire ' + e);
    } else {
        Y.fire(e, a1, a2, a3);
    }
}

function loadCredentials(callback) {

    getCredentials(function (credentials) {

        // Set global credentials

        session = credentials;

        // Parse project fragment identifier

        var fragKVS = document.location.href.split("#")[1];
        var fragKVP = fragKVS ? fragKVS.split('project=') : null;
        fragment = fragKVP ? fragKVP[1] : null;

        callback();
    });
}

// get json data from server
function doJsonReq(method, uri, content, responseFunc, myarg) {

    if (!session) {
        return;
    }

    if (uri.indexOf('http://') !== 0 && uri.indexOf('https://') !== 0) {
        uri = postmile.api.uri + uri;
    }

    // Calculate Signature
    var authHeader = MAC.getAuthorizationHeader(method, uri, /**/session, (content !== '' || method === 'POST' || method === 'PUT' ? content : null), null); // DELETE?

    // Create the io callback/configuration
    var configuration = {

        headers: { 'Authorization': authHeader },

        // YUI won't to cross-domain even with native xdr
        xdr: { use: 'native' }, // required for YUI to allow processing of a cross-domain request (and not try to use flash) (but still does not work)

        timeout: 3000,

        method: method, // defaults to GET

        on: {

            success: function (x, o) {

                // Y.log("RAW JSON DATA: " + o.responseText);
                var jsonResponse = [];
                // Process the JSON data returned from the server

                if (o.responseText) {
                    try {
                        jsonResponse = /*Y.*/JSON.parse(o.responseText);
                        jsonResponse._networkRequestStatusCode = x.status;
                    }
                    catch (e) {
                        xLog("JSON Parse failed!");
                        return;
                    }
                } else {
                    xLog("JSON no data to parse!");
                    return;
                }

                if (jsonResponse.error) {	// different/lower/earlier than jsonResponse.status !== 'ok' )
                    xFire('postmile:networkError', jsonResponse);
                }

                // no permission, redirect/prompt for login
                if (jsonResponse.code === 401) {
                    refreshCredentials();
                }

                // confirm join, retry event if user joins, etc
                if (jsonResponse.code === 403) {
                    var retryRequest = function () {
                        doJsonReq(method, uri, content, responseFunc, myarg);
                    };
                    if (jsonResponse.message === 'Insufficient TOS accepted') {
                        // getCredentials(function () {}/*, true*/);	// not refreshCredentials();
                        window.location = postmile.api.uri + '/login';
                    } else {
                        xFire('postmile:askJoinCurrentProject', true, retryRequest);
                    }
                }

                if (responseFunc) {
                    responseFunc(jsonResponse, myarg);
                }
            },

            failure: function (x, o) {
                xLog("Async call failed!");
            }
        }
    };

    // YUI x-domain calls broken - may need this before YUI loaded now anyways
    // Y.io.header( 'Authorization', authHeader ) ; // try hardcoding default headers just for testing
    // set Content-Type and pass content
    // var transaction = Y.io(uri, configuration);	// YUI does not allow x-domain call, even use xdr use native

    var request = new XMLHttpRequest();

    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            // Y.log( "getJson's XMLHttpRequest: " + request.readyState + " " + request.responseText ) ;
            if (request.status !== 200 && request.status !== 201) {
                // alert( 'Request failed ' + JSON.stringify( request ) ) ;
                xLog('Request failed ' + JSON.stringify(request));
            }
            configuration.on.success(request, request);
        }
    };

    request.open(method, uri);
    request.uri = uri;
    request.setRequestHeader('Authorization', authHeader);
    request.setRequestHeader('Content-Type', 'application/json'); // or application/x-www-form-urlencoded if not json
    request.send(content);
}

// get json data from server
function getJson(uri, to, myarg) {
    doJsonReq("GET", uri, null, to, myarg);
}

// put json data to server - new stuff/resouces
function putJson(uri, content, to, myarg) {
    doJsonReq("PUT", uri, content, to, myarg);
}

// post json data to server - changing existing stuff
function postJson(uri, content, to, myarg) {
    if (content === null) {
        content = '';
    }
    doJsonReq("POST", uri, content, to, myarg);
}

// delete json data to server - delete existing stuff
function deleteJson(uri, content, to, myarg) {
    doJsonReq("DELETE", uri, content, to, myarg);
}

