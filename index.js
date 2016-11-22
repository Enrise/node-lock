'use strict';

const _ = require('lodash');
const defaultType = 'lockdocument';

// verifyParameters just verifies the three provided parameters so the callback will only be inspected, not used
function verifyParameters(resource, cb) {

  // Callback might be one of the incorrect parameters, so can't use the callback
  if (!(_.isString(resource) && _.isFunction(cb) && resource.length && cb)) {
    throw new Error('Incorrect parameter(s)');
  }
}

function Lock(settings) {
  if (!(this instanceof Lock)) {
    return new Lock(settings);
  }

  if (!_.isString(settings.owner) || !settings.owner) {
    throw new Error('Owner must a string');
  }

  this.esClient = settings.esClient;
  this.index = settings.index;
  this.type = settings.type || defaultType;
  this.owner = settings.owner;
}

Lock.prototype.acquire = function (resource, cb) {
  verifyParameters(resource, cb);
  this._acquireLock(resource, cb);
};

Lock.prototype.release = function (resource, cb) {
  verifyParameters(resource, cb);
  this._releaseLock(resource, cb);
};

Lock.prototype.isLocked = function (resource, cb) {
  this.esClient.get({
    index: this.index,
    type: this.type,
    id: resource
  }, (lockErr, lockRes, statusCode) => {
    if (statusCode === 404) {
      return cb(null, false);
    }

    cb(lockErr, true, _.get(lockRes, '_source.owner'));
  });
};

Lock.prototype.list = function (cb) {
  this.esClient.search({
    index: this.index,
    type: this.type
  }, (lockErr, locksRes, statusCode) => {
    if (statusCode === 404) {
      return cb(null, false);
    }

    cb(lockErr, _.reduce(_.get(locksRes, 'hits.hits'), (locks, lockDocument) => {
      locks[lockDocument._id] = lockDocument._source;
      return locks;
    }, {}));
  });
};

Lock.prototype.delete = function (cb) {
  this.esClient.indices.delete({
    index: this.index
  }, (deleteError) => {
    cb(deleteError);
  });
};

// 'Private' methods
Lock.prototype._acquireLock = function (resource, cb) {
  const lockDocument = {
    body: {
      owner: this.owner
    },
    index: this.index,
    type: this.type,
    id: resource,
    refresh: true
  };

  this.esClient.create(lockDocument, (err, res) => {
    // Lock (document) already exists
    if (err && err.status === 409) {
      return cb(null, false);
    }

    cb(err, res && res.created);
  });
};

Lock.prototype._releaseLock = function (resource, cb) {
  this.esClient.delete({
    index: this.index,
    type: this.type,
    id: resource,
    refresh: true
  }, (deleteError, response) => {
    cb(deleteError || (response.found ? null : new Error('Missing lockdocument for resource', resource)));
  });
};

module.exports = Lock;
