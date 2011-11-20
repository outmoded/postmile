/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Globals

var options = {

    nativeDomain: postmile.web.domain,
    nativeClientId: 'postmile.view',
    clientProfileURI: 'client.json',
    loginURI: postmile.web.uri + '/login',
    authorizationEndpointURI: postmile.web.uri + '/oauth/authorize',
    issueEndpointURI: postmile.web.uri + '/oauth/issue'
};


// Obtain credentials

getCredentials = function (callback, isRefresh) {

    isRefresh = isRefresh || false;
    var isValid = false;
    var credentials;

    // Clean up if refresh

    if (isRefresh) {

        localStorage.removeItem('oauth');
    }

    // Lookup credentials in local storage

    var storage = localStorage.getItem('oauth');
    if (storage) {

        try {
            credentials = JSON.parse(storage);
        }
        catch (e) { }

        if (credentials &&
			credentials.id &&
			credentials.key &&
			credentials.algorithm) {

            callback(credentials);
            isValid = true;
        }
        else {

            localStorage.removeItem('oauth');
        }
    }

    if (isValid === false) {

        // Lookup credentials in fragment

        var uriBits = document.location.href.split("#");
        if (uriBits &&
			uriBits.length > 1) {

            // Based on: parseURI 1.2.2
            // http://blog.stevenlevithan.com/archives/parseuri
            // (c) Steven Levithan <stevenlevithan.com>
            // MIT License

            var localParseQuery = function (query) {

                result = {};
                var queryRegex = /(?:^|&)([^&=]*)=?([^&]*)/g;
                query.replace(queryRegex, function ($0, $1, $2) {
                    if ($1) {

                        var key = decodeURIComponent($1.replace(/\+/g, ' '));
                        var value = ($2 ? decodeURIComponent($2.replace(/\+/g, ' ')) : '');

                        if (result[key] == null) {

                            result[key] = value;
                        }
                        else {

                            if (typeof result[key] == 'string') {

                                result[key] = [result[key], value];
                            }
                            else {

                                result[key].push(value);
                            }
                        }
                    }
                });

                return result;
            }

            var parameters = localParseQuery(uriBits[1]);
            if (parameters.access_token &&
				parameters.mac_key &&
				parameters.mac_algorithm) {

                credentials = {

                    id: parameters.access_token,
                    key: parameters.mac_key,
                    algorithm: parameters.mac_algorithm
                };

                localStorage.setItem('oauth', JSON.stringify(credentials));

                parent.location.hash = (parameters.state ? '#' + parameters.state : '');
                callback(credentials);
                isValid = true;
            }
        }
    }

    if (isValid === false) {

        // Lookup client credentials based on client identifier

        getClientProfile(function (client, err) {

            if (client) {

                if (client.id === options.nativeClientId) {

                    // Get native (cookie) credentials

                    getNativeCredentials();
                }
                else {

                    // Third-party OAuth 2.0 flow

                    var state;
                    var uriBits = document.location.href.split("#");
                    if (uriBits &&
						uriBits[1]) {

                        state = uriBits[1];
                    }

                    window.location = options.authorizationEndpointURI
										+ '?client_id=' + encodeURIComponent(client.id)
										+ '&response_type=token'
										+ (client.callback ? '&redirect_uri=' + encodeURIComponent(client.callback) : '')
										+ (state ? '&state=' + encodeURIComponent(state) : '');
                }
            }
            else {

                // Continue as native client

                getNativeCredentials();
            }
        });
    }

    function getNativeCredentials() {

        if (isRefresh) {

            credentials = null;
            loginRedirect();
        }
        else if (credentials) {

            callback(credentials);
        }
        else {

            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {

                if (request.readyState === 4) {

                    if (request.status === 200) {

                        try {

                            credentials = JSON.parse(request.responseText);
                        }
                        catch (e) { }
                    }

                    if (credentials) {

                        callback(credentials);
                    }
                    else {

                        loginRedirect();
                    }
                }
            };

            request.open('GET', options.issueEndpointURI);
            request.send();
        }
    }

    function loginRedirect() {

        // Redirect to login page
        var s = document.location.href.split(options.nativeDomain);
        window.location = options.loginURI + (s.length > 1 ? '?next=' + encodeURIComponent(s[1]) : '');
    }
}


// Purge old credentials and obtain new one

refreshCredentials = function () {

    getCredentials(function () { }, true);
}


// Get client profile (client.json)

getClientProfile = function (callback) {	// make this gloabl for ext ref - not a func decl, not a var

    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {

        if (request.readyState === 4) {

            if (request.status === 200) {

                var msg;

                try {

                    msg = JSON.parse(request.responseText);
                }
                catch (e) { }

                if (msg &&
					msg.id) {

                    callback(msg, null);
                }
                else {

                    callback(null, 'Received invalid client.json');
                }
            }
            else {

                callback(null, 'Failed obtaining client.json: ' + request.status);
            }
        }
    };

    request.open('GET', options.clientProfileURI);
    request.send();
}


