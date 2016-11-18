# Node.js lock module

[![build:?](https://img.shields.io/travis/Enrise/node-lock.svg?style=flat-square)](https://travis-ci.org/Enrise/node-lock)
[![Coverage Status](https://img.shields.io/coveralls/Enrise/node-lock/master.svg?style=flat-square)](https://coveralls.io/github/Enrise/node-lock?branch=master)
[![dependencies:?](https://img.shields.io/david/Enrise/node-lock.svg?style=flat-square)](https://david-dm.org/Enrise/node-lock)
[![devDependencies:?](https://img.shields.io/david/dev/Enrise/node-lock.svg?style=flat-square)](https://david-dm.org/Enrise/node-lock)

> An elasticsearch based lock mechanism.

### Installation
NPM: `npm install enrise-lock --save`  
Yarn: `yarn add enrise-lock`

### Initialization
Require and instantiate the locker.
`const lock = new require('enrise-lock')(config: Object);`

Where `config` is an object with three required options.

- `esClient: elasticsearch`: An elasticsearch client for the lock module to use. This can either be an [elasticsearch](https://www.npmjs.com/package/elasticsearch) or an [enrise-esclient](https://www.npmjs.com/package/enrise-esclient) instance.
- `index: String`: The elasticsearch index that will be used to store all lock-documents.
- `type: String`: The index-type that will be used to store all lock-documents.

### Usage and API methods

#### `lock.acquire(resource: String, owner: String, callback: function)`
Set a lock for resource: `resource` and owner: `owner`. Callback will be called with parameters `[err, success: boolean]`.

#### `lock.release(resource: String, owner: String, callback: function)`
Release a lock for resource: `resource` and owner: `owner`. Callback will be called with parameter `[err]`.

#### `lock.isLocked(resource: String, callback: function)`
Check if a resource is locked. Callback will be called with parameters `[err, isLocked: boolean]`.

#### `lock.list(callback: function)`
Retrieve a list of all current locks. Callback will be called with parameters `[err, locks: Object]`. Where the key in locks represents the resource and the value an object with the owner.

#### `lock.delete(callback: function)`
Delete the entire lock-index. Callback will be called with parameter `[err]`.

### Example
```js
const lock = new require('enrise-lock')({
  esClient: new require('elasticsearch').Client(),
  index: 'globallock',
  type: 'lockdocument'
});

// Set lock
lock.acquire('my-resource', 'owner', (err, success) => {
  // Do some asynchronous operation
  // ...

  // Release lock
  lock.release('my-resource', 'owner', (err, success) => {
  	// ...
  });
});

```