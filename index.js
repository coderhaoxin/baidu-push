'use strict';

var assert = require('assert'),
  crypto = require('crypto'),
  http = require('http');

/**
 * Push
 */
function Push(options) {
  this.apiKey = options.apiKey;
  this.secretKey = options.secretKey;
  this.host = options.host || 'channel.api.duapp.com';
  this.path = options.path || '/rest/2.0/channel/';
  this.timeout = options.timeout || 5000; // 5s

  if (options.hasOwnProperty('agent')) {
    this.agent = options.agent;
  } else {
    var agent = new http.Agent();
    agent.maxSockets = 20;
    this.agent = agent;
  }
}

Push.prototype.request = function(path, bodyParams, callback) {
  var secretKey = this.secretKey,
    timeout = this.timeout,
    host = this.host;

  bodyParams.apikey = this.apiKey;
  bodyParams.sign = generateSign('POST', 'http://' + host + path, bodyParams, secretKey);

  var bodyArgsArray = [];

  for (var i in bodyParams) {
    bodyArgsArray.push(i + '=' + urlencode(bodyParams[i]));
  }

  var bodyString = bodyArgsArray.join('&');
  var options = {
    host: host,
    path: path,
    method: 'POST',
    headers: {
      'Content-Length': bodyString.length,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  var req = http.request(options, function(res) {
    var chunks = [],
      size = 0;

    res.on('data', function(chunk) {
      chunks.push(chunk);
      size += chunk.length;
    });

    res.on('end', function() {
      var data;

      try {
        data = JSON.parse(Buffer.concat(chunks, size));
      } catch (e) {
        e.status = res.statusCode;
        e.code = 'JSON Parse Error';

        return callback(e);
      }

      if (res.statusCode !== 200) {
        var err = new Error();

        err.code = data.error_code;
        err.status = res.statusCode;
        err.message = data.error_msg;
        err.request_id = data.request_id;

        return callback(err);
      }

      callback(null, data);
    });
  });

  req.on('socket', function (socket) {
      socket.setTimeout(timeout);
      socket.on('timeout', function () {
          req.abort();
      });
  });
  
  req.on('error', function(e) {
    callback(e);
  });

  req.end(bodyString);
};

Push.prototype.queryBindList = function(options, callback) {
  options = options || {};
  callback = callback || noop;

  var path = this.path + (options.channel_id || 'channel');

  options.method = 'query_bindlist';
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

Push.prototype.pushMsg = function(options, callback) {
  options = options || {};
  callback = callback || noop;
  var path = this.path + 'channel';

  options.method = 'push_msg';
  options.messages = JSON.stringify(options.messages);
  options.msg_keys = JSON.stringify(options.msg_keys);
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

Push.prototype.verifyBind = function(options, callback) {
  options = options || {};
  callback = callback || noop;
  var path = this.path + (options.channel_id || 'channel');

  options.method = 'verify_bind';
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

Push.prototype.fetchMsg = function(options, callback) {
  options = options || {};
  callback = callback || noop;
  var path = this.path + (options.channel_id || 'channel');

  options.method = 'fetch_msg';
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

Push.prototype.fetchMsgCount = function(options, callback) {
  options = options || {};
  callback = callback || noop;
  var path = this.path + (options.channel_id || 'channel');

  options.method = 'fetch_msgcount';
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

Push.prototype.deleteMsg = function(options, callback) {
  options = options || {};
  callback = callback || noop;
  var path = this.path + (options.channel_id || 'channel');

  options.method = 'delete_msg';
  options.msg_ids = JSON.stringify(options.msg_ids);
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

Push.prototype.setTag = function(options, callback) {
  options = options || {};
  callback = callback || noop;
  var path = this.path + 'channel';

  options.method = 'set_tag';
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

Push.prototype.fetchTag = function(options, callback) {
  options = options || {};
  callback = callback || noop;
  var path = this.path + 'channel';

  options.method = 'fetch_tag';
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

Push.prototype.deleteTag = function(options, callback) {
  options = options || {};
  callback = callback || noop;
  var path = this.path + 'channel';

  options.method = 'delete_tag';
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

Push.prototype.queryUserTags = function(options, callback) {
  options = options || {};
  callback = callback || noop;
  var path = this.path + 'channel';

  options.method = 'query_user_tags';
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

Push.prototype.queryDeviceType = function(options, callback) {
  options = options || {};
  callback = callback || noop;
  var path = this.path + (options.channel_id || 'channel');

  options.method = 'query_device_type';
  options.timestamp = getTimestamp();

  this.request(path, options, callback);
};

/**
 * exports
 */
exports.createClient = function(options) {
  assert(typeof options === 'object', 'invalid options');

  var client = new Push(options);

  var wrapper = options.wrapper;
  if (wrapper) {
    require('thunkify-or-promisify')(client, wrapper, ['request']);
  }

  return client;
};

/**
 * utils
 */
function noop() {}

function urlencode(string) {
  string += '';
  return encodeURIComponent(string)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/%20/g, '+');
}

function getTimestamp() {
  return Math.floor(new Date().getTime() / 1000);
}

function generateSign(method, url, params, secretKey) {
  var baseString = method + url;

  var keys = Object.keys(params).sort();
  for (var i = 0; i < keys.length; i++) {
    baseString += (keys[i] + '=' + params[keys[i]]);
  }

  baseString += secretKey;
  var encodeString = urlencode(baseString);
  var md5sum = crypto.createHash('md5');
  md5sum.update(encodeString);

  var sign = md5sum.digest('hex');

  return sign;
}
