Postmile is a collaborative list making tool built using JS, Node.js, and MongoDB.

# Installation

Postmile consists of an api server and a web server, both running using Node.js. The two servers can run on the same machine or different machines.
The following is based on a shared machine.

```bash
$ git clone git@github.com:hueniverse/postmile.git
$ cd postmile
$ cp config.js.example config.js
```

Edit postmile/config.js with your preferences and configuration.

```bash
$ cd api
$ cp cp vault.js.example vault.js
```

Edit postmile/api/vault.js and set the values of the 'aes256Key' variables to different random secrets sufficiently long (e.g. 40 characters).

If your MongoDB requires authentication, set the values of the database 'username' and 'password' (otherwise leave empty).

```bash
$ npm update
$ node install

110827/005720.948, info, Database initialized
110827/005720.952, info, Initial dataset created successfully
110827/005720.952, info, >>>>> postmile.web client secret: __some__secret__
```

Copy the postmile.web client secret and save it for later.

```bash
$ cd ../web
$ npm update
$ cp cp vault.js.example vault.js
```

Edit postmile/web/vault.js and set the values of the 'aes256Key' variables to different random secrets sufficiently long (e.g. 40 characters).

Set the value of the postmileAPI 'clientSecret' variable to the client secret saved earlier.

Enter at least one third-party API credentials (Twitter, Facebook, or Yahoo!) as received from each provider when you registered the application.
If asked, the callback URI is your web server configuration entered above with the path '/auth/twitter', '/auth/facebook', or '/auth/yahoo'.
For example, if you configured your web server to run on 'localhost', port '8000', using the 'http' scheme, and you are using Twitter, your
callback URI is http://localhost:8000/auth/twitter.

```bash
$ cd ..
```

Make sure to protect your vault.js files. If an attacker gets hold of them, you're screwed.
If you are going to run this in a production environment, you should use TLS (HTTPS) for the web server (otherwise it's cookies and OAuth 2.0 bits are
pretty open for attacks). To configure TLS, set the 'process.web.tls' variable in the postmile/config.js file to point to your TLS key and certificate.

# Startup

To start both servers at the same time in the same process (combined log output):

```bash
$ node postmile
```

To start each server individually:

```bash
$ node api/index &
$ node web/index &
```

Now point your browser at the web server address and start using Postmile.

# To Do

 * Unify the two servers (api, web) to allow them to run inside the same process for single server setup
 
# History

Postmile is based on the discontinued experimental Yahoo! Sled project initially published at: https://github.com/yahoo/postmile.



