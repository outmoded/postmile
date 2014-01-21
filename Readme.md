Postmile is a collaborative list making tool built using JS, Node.js, and MongoDB.

# Installation

Postmile consists of an api server and a web server, both running using Node.js. The two servers can run on the same machine or different machines.
The following is based on a shared machine.

```bash
$ git clone git://github.com/hueniverse/postmile.git
$ cd postmile
$ npm update
$ cd lib
$ cp config.js.example config.js
```

Edit postmile/lib/config.js with your preferences and configuration.

```bash
$ cd api
$ cp vault.js.example vault.js
```

Edit postmile/lib/api/vault.js and set the values of the 'aes256Key' and 'password' variables to different random secrets sufficiently long (e.g. 40 characters).

If your MongoDB requires authentication, set the values of the database 'username' and 'password' (otherwise leave empty).

```bash
$ node install

Database initialized
Initial dataset created successfully
>>>>> API client id: <id>
>>>>> API client key: <key>
>>>>> VIEW client id: <id>
>>>>> VIEW client key: (leave empty)
```

Copy the API client id and key, and VIEW client id, and save them for later.

```bash
$ cd ../web
$ cp vault.js.example vault.js
```

Edit postmile/web/vault.js and set the values of the 'password' variables to different random secrets sufficiently long (e.g. 40 characters).

Set the values of the postmileAPI 'clientId' and 'clientSecret' variables to the WEB client id and secret saved earlier.
Set the value of the 'viewClientId' variable to the VIEW client id saved earlier.

Enter at least one third-party API credentials (Twitter, Facebook, or Yahoo!) as received from each provider when you registered the application.
If asked, the callback URI is your web server configuration entered above with the path '/auth/twitter', '/auth/facebook', or '/auth/yahoo'.
For example, if you configured your web server to run on '127.0.0.1', port '8000', using the 'http' scheme, and you are using Twitter, your
callback URI is http://127.0.0.1:8000/auth/twitter.

```bash
$ cd ../..
```

Make sure to protect your vault.js files. If an attacker gets hold of them, you're screwed.
If you are going to run this in a production environment, you should use TLS (HTTPS) for the web server (otherwise it's cookies and Oz bits are
pretty open for attacks). To configure TLS, set the 'process.web.tls' variable in the postmile/config.js file to point to your TLS key and certificate.

# Startup

To start both servers at the same time in the same process (combined log output):

```bash
$ node .
```

To start each server individually:

```bash
$ node lib/api/index &
$ node lib/web/index &
```

Now point your browser at the web server address and start using Postmile. Register with invite code 'public'.

# Credits

[Eran Hammer](http://hueniverse.com) - Concept and server-side components

[Lance Welsh](https://github.com/lpw) - 'view' web client

Axel Albin-Lax, Josh Kamler, and Bryan Chen - UX/UI design, Snowy web client theme

[Emmanuel Crouvisier](https://github.com/emcro) - 'view' web client CSS/HTML

[Chris Carrasco](http://chriscarrasco.com/) - Original artwork

# History

Postmile is based on the discontinued experimental Yahoo! Sled project initially published at: https://github.com/yahoo/postmile.



