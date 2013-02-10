// Load modules

var Chai = require('chai');
var Hapi = require('hapi');
var Crumb = process.env.TEST_COV ? require('../lib-cov') : require('../lib');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Crumb', function () {

    // Wrapper is required for coverage

    var plugin = {
        name: 'crumb',
        version: Hapi.utils.loadPackage().version,
        hapi: {
            plugin: '1.x.x'
        },
        register: Crumb.register
    };

    it('returns view with crumb', function (done) {

        var options = {
            views: {
                path: __dirname + '/templates',
                engine: {
                    module: 'handlebars'
                }
            }
        };

        var server = new Hapi.Server(options);

        server.route([
            {
                method: 'GET', path: '/1', handler: function () {

                    expect(this.plugins.crumb).to.exist;
                    expect(this.server.plugins.crumb.generate).to.exist;

                    return this.reply.view('index', {
                        title: 'test',
                        message: 'hi'
                    }).send();
                }
            },
            {
                method: 'POST', path: '/2', config: { plugins: { crumb: true } }, handler: function () {

                    expect(this.payload).to.deep.equal({ key: 'value' });
                    return this.reply('valid');
                }
            }
        ]);


        var pluginOptions = {
            permissions: {
                ext: true
            },
            plugin: {
                options: {
                    isSecure: true
                }
            }
        };

        server.plugin().register(plugin, pluginOptions, function (err) {

            expect(err).to.not.exist;
            server.inject({ method: 'GET', url: '/1' }, function (res) {

                var header = res.headers['Set-Cookie'];
                expect(header.length).to.equal(1);
                expect(header[0]).to.contain('Secure');

                var cookie = header[0].match(/crumb=([^\x00-\x20\"\,\;\\\x7F]*)/);
                expect(res.result).to.equal('<!DOCTYPE html><html><head><title>test</title></head><body><div><h1>hi</h1><h2>' + cookie[1] + '</h2></div></body></html>');

                server.inject({ method: 'POST', url: '/2', payload: '{ "key": "value", "crumb": "' + cookie[1] + '" }', headers: { cookie: 'crumb=' + cookie[1] } }, function (res) {

                    expect(res.result).to.equal('valid');

                    server.inject({ method: 'POST', url: '/2', payload: '{ "key": "value", "crumb": "x' + cookie[1] + '" }', headers: { cookie: 'crumb=' + cookie[1] } }, function (res) {

                        expect(res.statusCode).to.equal(403);
                        done();
                    });
                });
            });
        });
    });
});


