'use strict';

var store = require('../lib/redis');
var adapter = require('socket.io-redis');
var namespace = require('./namespace');

module.exports = function (server, apps) {
  var io = require('socket.io')(server);

  // TODO: set auth credentials in case they're needed
  io.adapter(adapter({ host: 'localhost', port: 6379 }));

  for (var app in apps) {
    if (!apps.hasOwnProperty(app)) {
      return;
    }

    // Setup this namespace
    namespace(io, store, app, apps[app]);
  }

  return io;
};
