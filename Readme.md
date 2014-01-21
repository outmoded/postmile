Postmile is a collaborative list making tool built using hapi.js, Node.js, and MongoDB.

# Installation

Postmile consists of an api server and a web server, both running using Node.js. The two servers can run on the same machine or different machines.
The following is based on a shared machine.

```bash
$ git clone git://github.com/hueniverse/postmile.git
$ cd postmile
$ npm update
$ cp config.js.example config.js
```

Edit postmile/config.js with your preferences and configuration.

Enter at least one third-party API credentials (Twitter, Facebook, or Yahoo!) as received from each provider when you registered the application.
If asked, the callback URI is your web server configuration entered above with the path '/auth/twitter', '/auth/facebook', or '/auth/yahoo'.
For example, if you configured your web server to run on '127.0.0.1', port '8000', using the 'http' scheme, and you are using Twitter, your
callback URI is http://127.0.0.1:8000/auth/twitter.

```bash
$ node install
```

Make sure to protect your vault.json file. If an attacker gets hold of them, you're screwed.
If you are going to run this in a production environment, you should use TLS (HTTPS) for the web server (otherwise it's cookies and Oz bits are
pretty open for attacks). To configure TLS, set the 'process.web.tls' variable in the postmile/config.js file to point to your TLS key and certificate.

# Startup

To start the API and web servers:

```bash
$ node .
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



