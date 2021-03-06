describe('server status', function() {

    this.timeout(10000)
    var path = require('path');
    // override config.json with test one
    process.env['TEST_CONFIG'] = path.join(__dirname, '/config.json');

    var supertest = require('supertest');
    var _app = require('./../lib/express_app')
    var app = supertest(_app)
    var ws = require('ws');
    var ee = require('events').EventEmitter;
    var lib = require('./_fixtures.js')
    var utils = require('./utils')
    var assert = require('assert');

  var rippled;
  var route = new ee;
  var orderlist = new utils.orderlist;
  before(function(done) {
    console.log("\n\n\n\n\n\n_serverinfo-test.js BEFORE!!!!!!!!!!!\n\n\n\n")
    if (_app.remote._servers[0]._url != 'ws://localhost:5150')
        orderlist.isMock = false
    rippled = new ws.Server({port: 5150});

    route.on('ping', lib.ping)
    route.on('subscribe', lib.subscribe)
    route.on('server_info',lib.server_info)

    rippled.on('connection', lib.connection.bind({route:route}));
    rippled.on('close',function(){
      console.log("WS closed")
    })

    _app.remote.once('connect', function() {
      _app.remote.getServer().once('ledger_closed', function() {
        console.log("got server's ledger_closed")
        // proceed to the tests, api is ready
        done();
      });
    });

//    _app.remote._servers = [ ];
//    _app.remote.addServer('ws://localhost:5150');
    console.log("Connecting remote")
    _app.remote.connect();

  });

  after(function(done) {
    console.log("Cleanup: closing down")
    _app.remote.once('disconnect', function() {
      lib.clearInterval()
      rippled.close();
      done()
    });
    _app.remote.disconnect();
/*
      app.get('/v1/server')
        .end(function(err, resp) {
          console.log("testing /v1/server after disconnected")
          console.log(resp.body)
          var keys = Object.keys(lib.nominal_server_status_response_disconnect);
          var keyresp = utils.hasKeys(resp.body, keys)
          assert.equal(keyresp.hasAllKeys, true)
          done()
        })
*/
    });

    it('/v1/server/connected',function(done) {
        app.get('/v1/server/connected')
        .end(function(err, resp) {
            // check that we have a success
            assert.strictEqual(resp.body.success, true);
            var keys = Object.keys(lib.nominal_server_state_response);
            // check that our keys match
            assert.deepEqual(Object.keys(resp.body), keys)
            done();
        });
    })
    it('/v1/server while connected',function(done) {
        var incoming = function(data,ws) {
            delete data.id
            assert.deepEqual(data,{"command":"server_info"})
            orderlist.mark('server_info') 
        }
        orderlist.create([{command:'server_info'}])
        route.once('server_info',incoming)
        app.get('/v1/server')
        .end(function(err, resp) {
            var keys = Object.keys(lib.nominal_server_status_response);
            var keyresp = utils.hasKeys(resp.body, keys)
            assert.equal(keyresp.hasAllKeys, true) 
            assert.equal(orderlist.test(), true)
            done()
        })
    })
})

