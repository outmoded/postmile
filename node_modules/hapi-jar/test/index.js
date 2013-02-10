// Load modules

var Chai = require('chai');
var Hapi = require('hapi');
var Jar = process.env.TEST_COV ? require('../lib-cov') : require('../lib');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Jar', function () {

    // Wrapper is required for coverage

    var plugin = {
        name: 'jar',
        version: Hapi.utils.loadPackage().version,
        hapi: {
            plugin: '1.x.x'
        },
        register: Jar.register
    };

    it('sets jar then gets it back', function (done) {

        var options = {
            permissions: {
                ext: true
            },
            plugin: {
                name: 'jarx',
                isSingleUse: true,
                options: {
                    password: 'password',
                    isSecure: true
                }
            }
        };

        var server = new Hapi.Server();

        server.route([
            {
                method: 'GET', path: '/1', handler: function () {

                    expect(this.state.jarx).to.not.exist;
                    expect(this.plugins.jar).to.deep.equal({});
                    this.plugins.jar.some = { value: 123 };
                    return this.reply('1');
                }
            },
            {
                method: 'GET', path: '/2', handler: function () {

                    expect(this.state.jarx).to.deep.equal({ some: { value: 123 } });
                    expect(this.plugins.jar).to.deep.equal({});
                    return this.reply('2');
                }
            }
        ]);

        server.plugin().register(plugin, options, function (err) {

            expect(err).to.not.exist;
            server.inject({ method: 'GET', url: '/1' }, function (res) {

                expect(res.result).to.equal('1');
                var header = res.headers['Set-Cookie'];
                expect(header.length).to.equal(1);
                expect(header[0]).to.contain('Secure');

                var cookie = header[0].match(/(jarx=[^\x00-\x20\"\,\;\\\x7F]*)/);

                server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, function (res) {

                    expect(res.result).to.equal('2');
                    var header = res.headers['Set-Cookie'];
                    expect(header.length).to.equal(1);
                    expect(header[0]).to.equal('jarx=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; Path=/');
                    done();
                });
            });
        });
    });
});


