'use strict';

module.exports = function (app, io) {
  app
    .post('/apps/:app/events', function (req, res) {
      // Params name, data, rooms, room
      // TODO: support socket_id

      if (req.body.room) {
        req.body.rooms = [req.body.room];
      }

      req.body.rooms.forEach(function (room) {
        io
          .of('/' + req.params.app)
          .in(room)
          .emit('jelly:' + room + ':' + req.body.name, req.body.data);
      });

      res.sendStatus(204);
    });
};
