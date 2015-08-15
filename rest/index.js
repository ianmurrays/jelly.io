'use strict';

var bodyParser = require('body-parser');

module.exports = function (app, io) {
  app.use(bodyParser.json());
  app.use(require('./auth'));

  require('./events')(app, io);  
};
