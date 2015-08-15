'use strict';

var sign = require('../lib/sign');
var Promise = require('bluebird');
var debug = require('debug')('jelly:nsp');

module.exports = function (io, store, app, options) {
  var nsp = io
    .of('/' + app);

  nsp
    .on('connection', function (socket) {
      socket
        .on('disconnect', function () {
          debug('client disconnecting %s', socket.id);

          store
            .hgetallAsync(socket.id)
            .then(function (rooms) {
              return Object.keys(rooms);
            })
            .each(function (room) {
              debug('removing %s from room %s', socket.id, room);

              store
                .hgetAsync(room, socket.id)
                .then(function (userInfo) {
                  nsp
                    .in(room)
                    .emit('jelly:' + room + ':member_removed', userInfo);

                  return store
                    .hdelAsync(room, socket.id);
                });
            })
            .then(function () {
              debug('removing all info from socket %s', socket.id);
              return store
                .delAsync(socket.id);
            });

          // store.hget(socket.id, function (err, rooms) {
          //   for (var room in rooms) {
          //     if (rooms.hasOwnProperty(room)) {
          //       if (room.match(/^presence-/)) {
          //         store.hget(room, socket.id, function (err, userInfo) {
          //           io
          //             .in(room)
          //             .emit('jelly:' + room + ':member_removed', userInfo);
          //
          //           store.hdel(room, socket.id);
          //         });
          //       }
          //     }
          //   }
          //
          //   store.del(socket.id);
          // });
        })
        .on('jelly:unsubscribe', function (data) {
          socket.leave(data.room);
        })
        .on('jelly:subscribe', function (data) {
          var isPrivate = data.room.match(/^private-/);
          var isPresence = data.room.match(/^presence-/);

          // Require authorization
          if (isPrivate) {
            if (data.signature === sign(options.secret, data.room, socket.id)) {
              socket
                .join(data.room, function () {
                  socket
                    .emit('jelly:' + data.room + ':subscription_succeeded');

                  store.hset(socket.id, data.room, true);
                });
            }
            else {
              socket.emit('jelly:subscription_error', {
                status: 401,
              });
            }
          }
          else if (isPresence) {
            if (data.signature === sign(options.secret, data.room, socket.id, data.userInfo)) {
              socket
                .join(data.room, function () {
                  // Store presence info and subscription info
                  Promise
                    .join(store.hsetAsync(data.room, socket.id, JSON.stringify(data.userInfo)),
                          store.hsetAsync(socket.id, data.room, true))
                    .then(function () {
                      return store.hgetallAsync(data.room);
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
                      socket
                        .emit('jelly:' + data.room + ':subscription_succeeded', {
                          members: members,
                        });
                    })
                    .then(function () {
                      socket
                        .broadcast
                        .to(data.room)
                        .emit('jelly:' + data.room + ':member_added', data.userInfo);
                    });
                });

            }
            else {
              socket.emit('jelly:subscription_error', {
                status: 401,
              });
            }
          }
          else {
            socket.join(data.room, function () {
              socket
                .emit('jelly:' + data.room + ':subscription_succeeded');

              store.hset(socket.id, data.room, true);
            });
          }
        });
    });
};
