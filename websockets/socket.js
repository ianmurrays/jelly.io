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
      if (data.signature === sign(that.secret, data.room, that.socket.id, data.presence)) {
        // Validate presence, it must contain a user_id
        if (!data.presence.user_id) {
          that.socket.emit('jelly:subscription_error', {
            status: 400,
            error: 'missing_user_id',
          });

          return;
        }

        that.socket
          .join(data.room, function () {
            var currentMembers = that.store
              .hgetallAsync(data.room)
              .then(function (hash) {
                var members = {};

                for (var socketId in hash) {
                  if (hash.hasOwnProperty(socketId)) {
                    var parsed = JSON.parse(hash[socketId]);
                    members[parsed.user_id] = true;

                  }
                }

                return Object.keys(members);
              });

            var addedMember = Promise
              .join(that.store.hsetAsync(data.room, that.socket.id, JSON.stringify(data.presence)),
                    that.store.hsetAsync(that.socket.id, data.room, true));

            var newMembers = addedMember
              .then(function () {
                return that.store
                  .hgetallAsync(data.room)
                  .then(function (hash) {
                    // Make sure we remove duplicate members (for example members
                    // that have multiple sockets open)
                    var members = {};
                    var presence = [];

                    for (var socketId in hash) {
                      if (hash.hasOwnProperty(socketId)) {
                        var parsed = JSON.parse(hash[socketId]);

                        if (!members[parsed.user_id]) {
                          members[parsed.user_id] = true;
                          presence.push(parsed);
                        }
                      }
                    }

                    return presence;
                  });
              });

            Promise
              .join(currentMembers, addedMember, newMembers)
              .spread(function (currentMembers, addedMember, newMembers) {
                that.socket
                  .emit('jelly:' + data.room + ':subscription_succeeded', {
                    members: newMembers,
                  });

                if (currentMembers.indexOf(data.presence.user_id) === -1) {
                  that.socket
                    .broadcast
                    .to(data.room)
                    .emit('jelly:' + data.room + ':member_added', data.presence);
                }
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
        if (!rooms) {
          // Race condition? sometimes this is null
          return [];
        }

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
      .then(JSON.parse)
      .then(function (presence) {
        return that.store
          .hdelAsync(data.room, that.socket.id)
          .then(function () {
            that.store
              .hgetallAsync(data.room)
              .then(function (hash) {
                var user_ids = [];

                for (var socketId in hash) {
                  if (hash.hasOwnProperty(socketId)) {
                    var parsed = JSON.parse(hash[socketId]);
                    user_ids.push(parsed.user_id);
                  }
                }

                return user_ids;
              })
              .then(function (user_ids) {
                debug(user_ids);
                if (user_ids.indexOf(presence.user_id) === -1) {
                  // This id is no longer in the roster, send the notification
                  that.nsp
                    .in(data.room)
                    .emit('jelly:' + data.room + ':member_removed', presence);
                }
              });
          });
      });
  },
});
