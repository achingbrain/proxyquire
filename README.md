# proxyquire [![Build Status](https://secure.travis-ci.org/thlorenz/proxyquire.png)](http://travis-ci.org/thlorenz/proxyquire)

[![NPM](https://nodei.co/npm/proxyquire.png?downloads=true&stars=true)](https://nodei.co/npm/proxyquire/)

Proxies nodejs's require in order to make overriding dependencies during testing easy while staying **totally unobstrusive**.

If you want to stub dependencies for your client side modules, try
[proxyquireify](https://github.com/thlorenz/proxyquireify), a proxyquire for [browserify
v2](https://github.com/substack/browserify).

# Features

- **no changes to your code** are necessary
- non overriden methods of a module behave like the original
- mocking framework agnostic, if it can stub a function then it works with proxyquire
- "use strict" compliant

# Example

**foo.js:**

```javascript
var path = require('path');

module.exports.extnameAllCaps = function (file) {
  return path.extname(file).toUpperCase();
};

module.exports.basenameAllCaps = function (file) {
  return path.basename(file).toUpperCase();
};
```

**foo.test.js:**

```javascript
var proxyquire =  require('proxyquire')
  , assert     =  require('assert')
  , pathStub   =  { };

// when no overrides are specified, path.extname behaves normally
var foo = proxyquire('./foo', { 'path': pathStub });
assert.equal(foo.extnameAllCaps('file.txt'), '.TXT');

// override path.extname
pathStub.extname = function (file) { return 'Exterminate, exterminate the ' + file; };

// path.extname now behaves as we told it to
assert.equal(foo.extnameAllCaps('file.txt'), 'EXTERMINATE, EXTERMINATE THE FILE.TXT');

// path.basename and all other path module methods still function as before
assert.equal(foo.basenameAllCaps('/a/b/file.txt'), 'FILE.TXT');
```

**Table of Contents**  *generated with [DocToc](http://doctoc.herokuapp.com/)*

- [Usage](#usage)
- [API](#api)
	- [Preventing call thru to original dependency](#preventing-call-thru-to-original-dependency)
		- [Prevent call thru for all future stubs resolved by a proxyquire instance](#prevent-call-thru-for-all-future-stubs-resolved-by-a-proxyquire-instance)
		- [Re-enable call thru for all future stubs resolved by a proxyquire instance](#re-enable-call-thru-for-all-future-stubs-resolved-by-a-proxyquire-instance)
		- [All together, now](#all-together-now)
	- [Forcing proxyquire to reload modules](#forcing-proxyquire-to-reload-modules)
	- [Examples](#examples)
- [Backwards Compatibility for proxyquire v0.3.x](#backwards-compatibility-for-proxyquire-v03x)
- [More Examples](#more-examples)

# Usage

Two simple steps to override require in your tests:

- add `var proxyquire = require('proxyquire');` to top level of your test file
- `proxyquire(...)` the module you want to test and pass along stubs for modules you want to override

# API

***proxyquire({string} request, {Object} stubs)***

- **request**: path to the module to be tested e.g., `../lib/foo`
- **stubs**: key/value pairs of the form `{ modulePath: stub, ... }`
    - module paths are relative to the tested module **not** the test file
    - therefore specify it exactly as in the require statement inside the tested file
    - values themselves are key/value pairs of functions/properties and the appropriate override

## Preventing call thru to original dependency

By default proxyquire calls the function defined on the *original* dependency whenever it is not found on the stub.

If you prefer a more strict behavior you can prevent *callThru* on a per module or contextual basis.

If *callThru* is disabled, you can stub out modules that don't even exist on the machine that your tests are running on.
While I wouldn't recommend this in general, I have seen cases where it is legitimately useful (e.g., when requiring
global environment configs in json format that may not be available on all machines).

**Prevent call thru on path stub:**

```javascript
var foo = proxyquire('./foo', {
  path: {
      extname: function (file) { ... }
    , '@noCallThru': true
  }
});
```

### Prevent call thru for all future stubs resolved by a proxyquire instance

```javascript
// all stubs resolved by proxyquireStrict will not call through by default
var proxyquireStrict = require('proxyquire').noCallThru();

// all stubs resolved by proxyquireNonStrict will call through by default
var proxyquireNonStrict = require('proxyquire');
```

### Re-enable call thru for all future stubs resolved by a proxyquire instance

```javascript
proxyquire.callThru();
```

**Call thru config per module wins:**

```javascript
var foo = proxyquire
    .noCallThru()
    .load('./foo', {

        // no calls to original './bar' methods will be made
        './bar' : { toAtm: function (val) { ... } }

        // for 'path' module they will be made
      , path: {
          extname: function (file) { ... }
        , '@noCallThru': false
        }
    });
```

### Globally override require

Use the `@global` property to override every `require` of a module, even transitively.

```javascript
// foo.js
var bar = require('bar');

module.exports = function() {
  bar();
}

// bar.js
var baz = require('baz');

module.exports = function() {
  baz.method();
}

// baz.js
module.exports = {
  method: function() {
    console.info('hello');
  }
}

// test.js
var stubs = {
  'baz': {
    method: function(val) {
      console.info('goodbye');
    },
    '@global': true
  }
};

var proxyquire = require('proxyquire');

var foo = proxyquire('foo', stubs);
foo();  // 'goodbye' is printed to stdout
```

There is one important caveat with global overrides:

*Any module setup code will be re-executed.*

This is because node.js caches the return value of `require`

Say you have a module, C, that you wish to stub.  You require module A which contains `require('B')`.  Module B in turn contains `require('C')`. If module B has already been required elsewhere then when module A receives the cached version of module B and proxyquire has no opportunity to inject the stub for C.

Proxyquire works around this problem by ignoring the module cache when any module stubs are specified as `@global`.

This can cause unexpected behaviour. If module B looked like this:

```javascript
var fs = require('fs')
  , C = require('C');

// will get executed twice
var file = fs.openSync('/tmp/foo.txt', 'w');

module.exports = function() {
  return new C(file);
};
```

The file at `/tmp/foo.txt` could be created and/or truncated more than once.

### Globally overriding require at runtime

Say you have a module that looks like this:

```javascript
module.exports = function() {
  var d = require('d');
  d.method();
};
```
The invocation of `require('d')` will happen at runtime and not when the containing module is requested via `require`.  If you want to globally override `d` above, use the `@runtimeGlobal` property:

```javascript
var stubs = {
  'd': {
    method: function(val) {
      console.info('hello world');
    },
    '@runtimeGlobal': true
  }
};
```

This will cause module setup code to be re-excuted just like `@global`, but with the difference that it will happen every time the module is requested via `require` at runtime as no module will ever be cached.

This can cause subtle bugs so if you can guarantee that your modules will not vary their `require` behaviour at runtime, use `@global` instead.

### All together, now

```javascript
var proxyquire = require('proxyquire').noCallThru();

// all methods for foo's dependencies will have to be stubbed out since proxyquire will not call through
var foo = proxyquire('./foo', stubs);

proxyquire.callThru();

// only some methods for foo's dependencies will have to be stubbed out here since proxyquire will now call through
var foo2 = proxyquire('./foo', stubs);
```

### Forcing proxyquire to reload modules

In most situations it is fine to have proxyquire behave exactly like nodejs `require`, i.e. modules that are loaded once
get pulled from the cache the next time.

For some tests however you need to ensure that the module gets loaded fresh everytime, i.e. if that causes initializing
some dependency or some module state.

For this purpose proxyquire exposes the `noPreserveCache` function.

```js
// ensure we don't get any module from the cache, but to load it fresh every time
var proxyquire = require('proxyquire').noPreserveCache();

var foo1 = proxyquire('./foo', stubs);
var foo2 = proxyquire('./foo', stubs);
var foo3 = require('./foo');

// foo1, foo2 and foo3 are different instances of the same module
assert.notEqual(foo1, foo2);
assert.notEqual(foo1, foo3);
```

`require.preserveCache` allows you to restore the behavior to match nodejs's `require` again.

```js
proxyquire.preserveCache();

var foo1 = proxyquire('./foo', stubs);
var foo2 = proxyquire('./foo', stubs);
var foo3 = require('./foo');

// foo1, foo2 and foo3 are the same instance
ssert.equal(foo1, foo2);
ssert.equal(foo1, foo3);
```

## Examples

**We are testing foo which depends on bar:**

```javascript
// bar.js module
module.exports = {
    toAtm: function (val) { return  0.986923267 * val; }
};

// foo.js module
// requires bar which we will stub out in tests
var bar = require('./bar');
[ ... ]

```

**Tests:**

```javascript
// foo-test.js module which is one folder below foo.js (e.g., in ./tests/)

/*
 *   Option a) Resolve and override in one step:
 */
var foo = proxyquire('../foo', {
  './bar': { toAtm: function (val) { return 0; /* wonder what happens now */ } }
});

// [ .. run some tests .. ]

/*
 *   Option b) Resolve with empty stub and add overrides later
 */
var barStub = { };

var foo =  proxyquire('../foo', { './bar': barStub });

// Add override
barStub.toAtm = function (val) { return 0; /* wonder what happens now */ };

[ .. run some tests .. ]

// Change override
barStub.toAtm = function (val) { return -1 * val; /* or now */ };

[ .. run some tests .. ]

// Resolve foo and override multiple of its dependencies in one step - oh my!
var foo = proxyquire('./foo', {
    './bar' : {
      toAtm: function (val) { return 0; /* wonder what happens now */ }
    }
  , path    : {
      extname: function (file) { return 'exterminate the name of ' + file; }
    }
});
```

# Backwards Compatibility for proxyquire v0.3.x

To upgrade your project from v0.3.x to v0.4.x, a nifty compat function has been included.

Simply do a global find and replace for `require('proxyquire')` and change them to `require('proxyquire').compat()`.

This returns an object that wraps the result of `proxyquire()` that provides exactly the same API as v0.3.x.

If your test scripts relied on the fact that v0.3.x stored `noCallThru` in the module scope, you can use
`require('proxyquire').compat(true)` to use a global compat object, instead.

# More Examples

For more examples look inside the [examples folder](https://github.com/thlorenz/proxyquire/tree/master/examples/) or
look through the [tests](https://github.com/thlorenz/proxyquire/blob/master/test/proxyquire.js)

**Specific Examples:**

- test async APIs synchronously: [examples/async](https://github.com/thlorenz/proxyquire/tree/master/examples/async).
- using proxyquire with [Sinon.JS](http://sinonjs.org/): [examples/sinon](https://github.com/thlorenz/proxyquire/tree/master/examples/sinon).
