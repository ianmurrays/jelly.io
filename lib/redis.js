'use strict';

var Promise = require('bluebird');
// TODO: set auth credentials in case they're needed
var redis = require('redis');
var client = redis.createClient();

Promise.promisifyAll(client);

module.exports = client;
