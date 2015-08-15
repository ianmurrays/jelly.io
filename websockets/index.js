var redis = require('redis');
var client = redis.createClient();

module.exports = function (server, apps) {
  var io = require('socket.io')(server);

  for (var app in apps) {
    if (!apps.hasOwnProperty(app)) {
      return;
    }

    var options = apps[app];

    var nsp = io
      .of('/' + app);

    nsp
      .on('connection', function (socket) {
        socket
          .on('disconnect', function () {
            client.hget(socket.id, function (err, rooms) {
              for (var room in rooms) {
                if (rooms.hasOwnProperty(room)) {
                  if (room.match(/^presence-/)) {
                    // TODO: Send socket presence info if needed
                    client.hget(room, socket.id, function (err, userInfo) {
                      io.sockets
                        .in(room)
                        .emit('jelly:' + data.room + ':member_removed', userInfo);

                      client.hdel(room, socket.id);
                    });
                  }
                }
              }

              client.del(socket.id);
            });
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
                    io.sockets
                      .in(socket.id)
                      .emit('jelly:' + data.room + ':subscription_succeeded');

                    client.hset(socket.id, data.room, true);
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
                    client.hgetall(data.room, function (err, members) {
                      io.sockets
                        .in(socket.id)
                        .emit('jelly:' + data.room + ':subscription_succeeded', {
                          members: members,
                        });
                    });

                    // Store presence info and subscription info
                    client.hset(data.room, socket.id, data.userInfo);
                    client.hset(socket.id, data.room, true);

                    // TODO: send presence event to room
                    socket
                      .broadcast
                      .to(data.room)
                      .emit('jelly:' + data.room + ':member_added', data.userInfo);
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
                io.sockets
                  .in(socket.id)
                  .emit('jelly:' + data.room + ':subscription_succeeded');

                client.hset(socket.id, data.room, true);
              });
            }
          });
      });
  }

  return io;
};

function sign(secret, room, socketId, userInfo) {
  var crypto = require('crypto');

  var string = [socketId, room];

  if (userInfo) {
    string.push(userInfo);
  }

  return crypto
    .createHmac('SHA256', secret)
    .update(string.join(':'))
    .digest('hex');
}
