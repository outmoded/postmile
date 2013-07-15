var credentials;

function htmlEscape(string) {
    
    return string.replace(/&/g,'&amp;').replace(/>/g,'&gt;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}

function fetchToken() {

    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {

        if (request.readyState === 4) {
            if (request.status === 200) {
                try {
                    credentials = JSON.parse(request.responseText);
                }
                catch (e) { }
            }

            if (!credentials) {
                window.location = '/login?next=%2Fdeveloper%2Fconsole';
                return;
            }

            // Socket.io

            var socket = io.connect(api.uri);
            socket.on('connect', function () {

                document.getElementById('session').innerHTML = 'authenticating...';
            });

            socket.on('message', function (message) {

                if (message.type == 'connect') {
                    document.getElementById('session').innerHTML = htmlEscape(message.session);
                    var auth = hawk.client.message(api.host, api.port, message.session, { credentials: credentials });
                    socket.json.send({ type: 'initialize', authorization: auth });
                }
                else if (message.type == 'initialize') {
                    document.getElementById('session').style.color = (message.status == 'ok' ? 'green' : 'red');
                    if (message.error) {
                        document.getElementById('stream').innerHTML += htmlEscape(JSON.stringify(message.error, null, 4)) + '<br />';
                        resizeListBox();
                    }
                }
                else {
                    document.getElementById('stream').innerHTML += htmlEscape(JSON.stringify(message, null, 4)) + '<br />';
                    resizeListBox();
                }
            });

            document.getElementById('session').innerHTML = 'connecting...';
        }
    };

    request.open('GET', web.uri + '/oz/session');
    request.send();
}

function sendRequest() {

    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {

        if (request.readyState == 4) {
            document.getElementById('response').innerHTML = htmlEscape(JSON.stringify(JSON.parse(request.responseText), null, 4));
            resizeListBox();
        }
    };

    // Prepare authorization attributes

    var uri = document.getElementById('uri').value;
    var method = document.getElementById('httpMethod').value;
    var content = document.getElementById('content').value;

    // Calculate Signature

    var authorization = hawk.client.header(uri, method, { credentials: credentials, app: credentials.app, dlg: credentials.dlg }).field;

    // Send request

    request.open(method, uri);
    request.setRequestHeader('Authorization', authorization);
    request.setRequestHeader('Content-Type', 'application/json');
    request.send(content);
    document.getElementById('response').innerHTML = 'Waiting...';
}
