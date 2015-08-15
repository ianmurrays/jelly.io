'use strict';

var sign = require('../lib/sign');
var Promise = require('bluebird');
var debug = require('debug')('jelly:socket');
var extend = require('extend');

module.exports = Socket;

function Socket(socket, nsp, store, secret) {
  debug('setting up socket %s', socket.id);
  this.socket = socket;
  this.nsp = nsp;
  this.store = store;
  this.secret = secret;

  socket.on('disconnect', this.disconnect.bind(this));
  socket.on('jelly:subscribe', this.subscribe.bind(this));
  socket.on('jelly:unsubscribe', this.unsubscribe.bind(this));
}

extend(Socket.prototype, {
  subscribe: function (data) {
    var isPrivate = data.room.match(/^private-/);
    var isPresence = data.room.match(/^presence-/);
    var that = this;

    // Require authorization
    if (isPrivate) {
      if (data.signature === sign(that.secret, data.room, that.socket.id)) {
        that.socket
          .join(data.room, function () {
            that.socket
              .emit('jelly:' + data.room + ':subscription_succeeded');

            that.store.hset(that.socket.id, data.room, true);
          });
      }
      else {
        that.socket.emit('jelly:subscription_error', {
          status: 401,
        });
      }
    }
    else if (isPresence) {
      if (data.signature === sign(that.secret, data.room, that.socket.id, data.userInfo)) {
        that.socket
          .join(data.room, function () {
            // Store presence info and subscription info
            Promise
              .join(that.store.hsetAsync(data.room, that.socket.id, JSON.stringify(data.userInfo)),
                    that.store.hsetAsync(that.socket.id, data.room, true))
              .then(function () {
                return that.store.hgetallAsync(data.room);
              })
              .then(function (hash) {
                var members = [];

                for (var member in hash) {
                  if (hash.hasOwnProperty(member)) {
                    members.push(JSON.parse(hash[member]));
                  }
                }

                return members;
              })
              .then(function (members) {
                that.socket
                  .emit('jelly:' + data.room + ':subscription_succeeded', {
                    members: members,
                  });
              })
              .then(function () {
                that.socket
                  .broadcast
                  .to(data.room)
                  .emit('jelly:' + data.room + ':member_added', data.userInfo);
              });
          });

      }
      else {
        that.socket.emit('jelly:subscription_error', {
          status: 401,
        });
      }
    }
    else {
      that.socket.join(data.room, function () {
        that.socket
          .emit('jelly:' + data.room + ':subscription_succeeded');

        that.store.hset(that.socket.id, data.room, true);
      });
    }
  },
  disconnect: function () {
    debug('client disconnecting %s', this.socket.id);

    var that = this;

    this.store
      .hgetallAsync(this.socket.id)
      .then(function (rooms) {
        return Object.keys(rooms);
      })
      .each(function (room) {
        return that.unsubscribe({ room: room });
      })
      .then(function () {
        debug('removing all info from socket %s', that.socket.id);
        return that.store
          .delAsync(that.socket.id);
      });
  },
  unsubscribe: function (data) {
    debug('removing %s from room %s', this.socket.id, data.room);

    var that = this;

    return that.store
      .hgetAsync(data.room, that.socket.id)
      .then(function (userInfo) {
        that.nsp
          .in(data.room)
          .emit('jelly:' + data.room + ':member_removed', userInfo);

        return that.store
          .hdelAsync(data.room, that.socket.id);
      });
  },
});
