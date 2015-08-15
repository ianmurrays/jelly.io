'use strict';

var sign = require('../lib/sign');
var Promise = require('bluebird');
var debug = require('debug')('jelly:nsp');
var Socket = require('./socket');

module.exports = function (io, store, app, options) {
  debug('setting up /%s namespace', app);
  var nsp = io
    .of('/' + app);

  nsp
    .on('connection', function (socket) {
      debug('%s connected', socket.id);

      new Socket(socket, nsp, store, options.secret);
    });
};
