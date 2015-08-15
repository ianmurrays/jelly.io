'use strict';

var crypto = require('crypto');

module.exports = function (secret, room, socketId, userInfo) {
  var string = [socketId, room];

  if (userInfo) {
    string.push(JSON.stringify(userInfo));
  }

  console.log(string.join(':'));

  return crypto
    .createHmac('SHA256', secret)
    .update(string.join(':'))
    .digest('hex');
};
