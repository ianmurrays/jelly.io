var app = require('./rest');
var server = require('http').Server(app);
var io = require('./websockets')(server, {
  'app': {
    secret: '1234567890',
  },
});

server.listen(process.env.PORT || 8081);
