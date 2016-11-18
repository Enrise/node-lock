'use strict';

const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
chai.use(require('sinon-chai'));

describe('Lock', () => {
  const esClientStub = {};
  const Lock = require('../index.js');
  const lock = new Lock({
    esClient: esClientStub,
    index: 'lock-index',
    type: 'lock-type'
  });

  beforeEach(() => {
    esClientStub.create = sinon.stub();
    esClientStub.create.callsArgWith(1, null, {created: true});
    esClientStub.delete = sinon.stub();
    esClientStub.delete.callsArgWith(1, null, {found: true});
  });

  it('initializes correctly', () => {
    expect(Lock).to.be.a.function;
  });

  describe('acquire and release functionality', () => {
    it('returns true when a lock for a resource is requested', (done) => {
      lock.acquire('testresource', 'unittest', (err, result) => {
        expect(result).to.be.true;
        expect(esClientStub.create).to.have.been.calledOnce;
        expect(esClientStub.create).to.have.been.calledWith({
          body: {
            owner: 'unittest'
          },
          index: 'lock-index',
          type: 'lock-type',
          id: 'testresource',
          refresh: true
        });
        expect(esClientStub.delete).to.not.have.been.called;
        done(err);
      });
    });

    it('succesfully acquires and releases a lock for a resource', (done) => {
      lock.acquire('testresource', 'unittest', (acquireError, result) => {
        expect(result).to.be.true;
        expect(esClientStub.create).to.have.been.calledOnce;
        expect(esClientStub.create).to.have.been.calledWithMatch({body: {owner: 'unittest'}, id: 'testresource'});
        expect(esClientStub.delete).to.not.have.been.called;
        lock.release('testresource', 'unittest', (releaseError) => {
          expect(esClientStub.create).to.have.been.calledOnce;
          expect(esClientStub.delete).to.have.been.calledOnce;
          expect(esClientStub.delete).to.have.been.calledWith({
            index: 'lock-index',
            type: 'lock-type',
            id: 'testresource',
            refresh: true
          });
          done(acquireError || releaseError);
        });
      });
    });

    it('succesfully acquires and releases locks for different resources in incorrect order', (done) => {
      lock.acquire('testresource1', 'unittest', (acquireError1, result1) => {
        expect(result1).to.be.true;
        expect(esClientStub.create).to.have.been.calledOnce;
        expect(esClientStub.create).to.have.been.calledWithMatch({body: {owner: 'unittest'}, id: 'testresource1'});
        expect(esClientStub.delete).to.not.have.been.called;
        lock.acquire('testresource2', 'unittest', (acquireError2, result2) => {
          expect(result2).to.be.true;
          expect(esClientStub.create).to.have.been.calledTwice;
          expect(esClientStub.create).to.have.been.calledWithMatch({body: {owner: 'unittest'}, id: 'testresource2'});
          expect(esClientStub.delete).to.not.have.been.called;
          lock.release('testresource1', 'unittest', (releaseError1) => {
            expect(esClientStub.create).to.have.been.calledTwice;
            expect(esClientStub.delete).to.have.been.calledOnce;
            expect(esClientStub.delete).to.have.been.calledWithMatch({id: 'testresource1'});
            lock.release('testresource2', 'unittest', (releaseError2) => {
              expect(esClientStub.create).to.have.been.calledTwice;
              expect(esClientStub.delete).to.have.been.calledTwice;
              expect(esClientStub.delete).to.have.been.calledWithMatch({id: 'testresource2'});
              done(acquireError1 || acquireError2 || releaseError1 || releaseError2);
            });
          });
        });
      });
    });

    it('fails to acquire a second lock on a resource', (done) => {
      lock.acquire('testresource', 'unittest', (acquireError1, result1) => {
        expect(result1).to.be.true;
        expect(esClientStub.create).to.have.been.calledOnce;
        expect(esClientStub.create).to.have.been.calledWithMatch({body: {owner: 'unittest'}, id: 'testresource'});
        expect(esClientStub.delete).to.not.have.been.called;

        esClientStub.create.onCall(1).callsArgWith(1, {status: 409});
        lock.acquire('testresource', 'unittest', (acquireError2, result2) => {
          expect(result2).to.be.false;
          expect(esClientStub.create).to.have.been.calledTwice;
          expect(esClientStub.delete).to.not.have.been.called;
          done(acquireError1 || acquireError2);
        });
      });
    });

    it('throws an error when a parameter is missing when acquiring a lock', (done) => {
      expect(() => {lock.acquire('justone', () => {});}).to.throw(Error);
      done();
    });

    it('returns false when there is no lock to release', (done) => {
      esClientStub.delete = sinon.stub();
      esClientStub.delete.callsArgWith(1, null, {found: false});
      lock.release('testresource', 'unittest', (error, result) => {
        expect(result).to.be.undefined;
        expect(error).to.be.an('Error');
        expect(esClientStub.delete).to.have.been.calledOnce;
        expect(esClientStub.delete).to.have.been.calledWithMatch({id: 'testresource'});
        expect(esClientStub.create).to.not.have.been.called;
        done();
      });
    });
    it('returns false when resource about to acquire is already locked', (done) => {
      esClientStub.create = sinon.stub();
      esClientStub.create.callsArgWith(1, {status: 409});
      lock.acquire('testresource', 'unittest', (error) => {
        expect(esClientStub.create).to.have.been.calledOnce;
        expect(esClientStub.create).to.have.been.calledWithMatch({id: 'testresource'});
        expect(esClientStub.delete).to.not.have.been.called;
        done(error);
      });
    });
    it('passes on Elasticsearch-error', (done) => {
      esClientStub.create = sinon.stub();
      esClientStub.create.callsArgWith(1, new Error('testCreate'));
      esClientStub.delete = sinon.stub();
      esClientStub.delete.callsArgWith(1, new Error('testDelete'));
      lock.acquire('testresource', 'unittest', (acquireError, acquireResult) => {
        expect(acquireError).to.be.an('Error');
        expect(acquireResult).to.be.undefined;
        lock.release('testresource', 'unittest', (releaseError) => {
          expect(releaseError).to.be.an('Error');
          done();
        });
      });
    });
  });

  describe('status functionality', () => {
    it('correctly reports a resource as available when no lock exists', (done) => {
      esClientStub.get = sinon.stub();
      esClientStub.get.callsArgWith(1, new Error('Not Found'), null, 404);
      lock.isLocked('testresource', (lockError, locked) => {
        expect(esClientStub.get).to.have.been.calledOnce;
        expect(esClientStub.get).to.have.been.calledWithMatch({
          index: 'lock-index',
          type: 'lock-type',
          id: 'testresource'
        });
        expect(locked).to.be.false;
        done(lockError);
      });
    });
    it('correctly reports a resource as unavailable with the owner when a lock exists', (done) => {
      esClientStub.get = sinon.stub();
      esClientStub.get.callsArgWith(1, null, {
        _source: {
          owner: 'unittest'
        }
      }, 202);
      lock.isLocked('testresource', (lockError, locked, owner) => {
        expect(esClientStub.get).to.have.been.calledOnce;
        expect(esClientStub.get).to.have.been.calledWithMatch({id: 'testresource'});
        expect(locked).to.be.true;
        expect(owner).to.equal('unittest');
        done(lockError);
      });
    });
    it('passes on ES errors', (done) => {
      esClientStub.get = sinon.stub();
      esClientStub.get.callsArgWith(1, new Error('Timeout'), null, 408);
      lock.isLocked('testresource', (lockError, locked) => {
        expect(esClientStub.get).to.have.been.calledOnce;
        expect(esClientStub.get).to.have.been.calledWithMatch({id: 'testresource'});
        expect(locked).to.be.true;
        expect(lockError).to.exists;
        done();
      });
    });

    it('correctly lists no locks when no documents are available', (done) => {
      esClientStub.search = sinon.stub();
      esClientStub.search.callsArgWith(1, null, {
        hits: {
          hits: []
        }
      }, 408);
      lock.list((lockError, locks) => {
        expect(esClientStub.search).to.have.been.calledOnce;
        expect(esClientStub.search).to.have.been.calledWith({
          index: 'lock-index',
          type: 'lock-type'
        });
        expect(locks).to.deep.equal({});
        done(lockError);
      });
    });
    it('passes on ES errors', (done) => {
      esClientStub.search = sinon.stub();
      esClientStub.search.callsArgWith(1, new Error('Timeout'), null, 408);
      lock.list((lockError) => {
        expect(esClientStub.search).to.have.been.calledOnce;
        expect(lockError).to.exists;
        done();
      });
    });
    it('correctly transforms lock documents into a lock object', (done) => {
      esClientStub.search = sinon.stub();
      const searchResponse = {
        hits: {
          hits: [
            {
              _id: 'testresource1',
              _source: {
                owner: 'unittestA'
              }
            },
            {
              _id: 'testresource2',
              _source: {
                owner: 'unittestB'
              }
            }
          ]
        }
      };
      esClientStub.search.callsArgWith(1, null, searchResponse);
      lock.list((lockError, locks) => {
        expect(esClientStub.search).to.have.been.calledOnce;
        expect(locks).to.deep.equal({
          testresource1: {
            owner: 'unittestA'
          },
          testresource2: {
            owner: 'unittestB'
          }
        });
        done(lockError);
      });
    });
    it('finishes with false when nothing is found', (done) => {
      esClientStub.search = sinon.stub();
      esClientStub.search.callsArgWith(1, null, null, 404);
      lock.list((lockError, locks) => {
        expect(locks).to.equal(false);
        done(lockError);
      });
    });
  });
  describe('delete lock index functionality', () => {
    it('makes a delete call on the lock index', (done) => {
      esClientStub.indices = sinon.stub();
      esClientStub.indices.delete = sinon.stub();
      esClientStub.indices.delete.callsArgWith(1, null, {acknowledged: true});

      lock.delete((deleteError) => {
        expect(esClientStub.indices.delete).to.have.been.calledOnce;
        expect(esClientStub.indices.delete).to.have.been.calledWith({index: 'lock-index'});
        done(deleteError);
      });
    });
    it('passes on Elasticsearch-error', (done) => {
      esClientStub.indices = sinon.stub();
      esClientStub.indices.delete = sinon.stub();
      esClientStub.indices.delete.callsArgWith(1, new Error('Timeout'));

      lock.delete((deleteError) => {
        expect(esClientStub.indices.delete).to.have.been.calledOnce;
        expect(deleteError).to.exists;
        done();
      });
    });
  });
});
