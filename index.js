'use strict';

const _ = require('lodash');

// verifyParameters just verifies the three provided parameters so the callback will only be inspected, not used
function verifyParameters(resource, owner, cb) {

  // Callback might be one of the incorrect parameters, so can't use the callback
  if (!(_.isString(resource) && _.isString(owner) && _.isFunction(cb) && resource.length && owner.length && cb)) {
    throw new Error('Incorrect parameter(s)');
  }
}

class Lock {
  constructor(settings) {
    this.esClient = settings.esClient;
    this.index = settings.index;
    this.type = settings.type;
  }

  acquire(resource, owner, cb) {
    verifyParameters(resource, owner, cb);
    this._acquireLock({
      resource: resource,
      owner: owner
    }, cb);
  }

  release(resource, owner, cb) {
    verifyParameters(resource, owner, cb);
    this._releaseLock({
      resource: resource,
      owner: owner
    }, cb);
  }

  isLocked(resource, cb) {
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
  }

  list(cb) {
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
  }

  delete(cb) {
    this.esClient.indices.delete({
      index: this.index
    }, (deleteError) => {
      cb(deleteError);
    });
  }

  // 'Private' methods
  _acquireLock(req, cb) {
    const lockDocument = {
      body: _.omit(req, 'resource'),
      index: this.index,
      type: this.type,
      id: req.resource,
      refresh: true
    };

    this.esClient.create(lockDocument, (err, res) => {
      // Lock (document) already exists
      if (err && err.status === 409) {
        return cb(null, false);
      }

      cb(err, res && res.created);
    });
  }

  _releaseLock(req, cb) {
    this.esClient.delete({
      index: this.index,
      type: this.type,
      id: req.resource,
      refresh: true
    }, (deleteError, response) => {
      cb(deleteError || (response.found ? null : new Error('Missing lockdocument for request', req)));
    });
  }
}

module.exports = Lock;
