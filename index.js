'use strict';

var app = require('express')();
var server = require('http').Server(app);
var io = require('./websockets')(server, {
  'app': {
    secret: '1234567890',
  },
});

require('./rest')(app, io);

server.listen(process.env.PORT || 8081);
