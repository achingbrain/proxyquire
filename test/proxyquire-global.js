/*jshint asi:true*/
/*global describe, before, beforeEach, it */
'use strict';

var assert = require('assert')
  , realFoo = require('./samples/global/foo');

var proxyquire = require('..');

describe('global', function () {
  it('should override require globally', function () {
    var stubs = {
      './baz': {
        method: function() {
          return true;
        },
        '@global': true
      }
    };

    var proxiedFoo = proxyquire('./samples/global/foo', stubs);

    assert.equal(realFoo(), false);
    assert.equal(proxiedFoo(), true);
  });

  it('should override require globally even when require\'s execution is deferred', function () {
    var stubs = {
      './baz': {
        method: function() {
          return true;
        },
        '@runtimeGlobal': true
      }
    };

    var proxiedFoo = proxyquire('./samples/global/foo-deferred', stubs);

    assert.equal(realFoo(), false);
    assert.equal(proxiedFoo(), true);
  });
});
