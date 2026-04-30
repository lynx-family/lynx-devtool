/* global globalThis */
(function (root) {
  if (root.__LDT_COMPAT_POLYFILLS__) {
    return;
  }
  root.__LDT_COMPAT_POLYFILLS__ = true;

  var ArrayCtor = root.Array;
  var MapCtor = root.Map;
  var ObjectCtor = root.Object;
  var PromiseCtor = root.Promise;
  var RangeErrorCtor = root.RangeError;
  var SetCtor = root.Set;
  var SymbolCtor = root.Symbol;
  var TypeErrorCtor = root.TypeError;
  var URLCtor = root.URL;
  var EventCtor = root.Event;
  var ElementCtor = root.Element;
  var HTMLElementCtor = root.HTMLElement;
  var IteratorPrototype = null;
  var IteratorCtor = root.Iterator;

  function defineArrayMethod(name, implementation) {
    if (!ArrayCtor.prototype[name]) {
      ObjectCtor.defineProperty(ArrayCtor.prototype, name, {
        configurable: true,
        writable: true,
        value: implementation,
      });
    }
  }

  function toArrayCopy(value) {
    return ArrayCtor.prototype.slice.call(value);
  }

  function toSet(other) {
    if (other instanceof SetCtor) {
      return other;
    }
    return new SetCtor(other);
  }

  function defineSetMethod(name, implementation) {
    if (!SetCtor.prototype[name]) {
      ObjectCtor.defineProperty(SetCtor.prototype, name, {
        configurable: true,
        writable: true,
        value: implementation,
      });
    }
  }

  function resolveIteratorPrototype() {
    if (!SymbolCtor || !SymbolCtor.iterator) {
      return null;
    }

    var candidates = [];
    try {
      candidates.push([][SymbolCtor.iterator]());
    } catch (error) {}
    try {
      candidates.push(new MapCtor()[SymbolCtor.iterator]());
    } catch (error) {}
    try {
      candidates.push(new SetCtor()[SymbolCtor.iterator]());
    } catch (error) {}

    for (var index = 0; index < candidates.length; ++index) {
      var iterator = candidates[index];
      if (!iterator) {
        continue;
      }
      var directPrototype = ObjectCtor.getPrototypeOf(iterator);
      if (!directPrototype) {
        continue;
      }
      var sharedPrototype = ObjectCtor.getPrototypeOf(directPrototype);
      if (sharedPrototype && sharedPrototype !== ObjectCtor.prototype) {
        return sharedPrototype;
      }
      if (directPrototype !== ObjectCtor.prototype && typeof directPrototype.next === 'function') {
        return directPrototype;
      }
    }

    return null;
  }

  function defineIteratorMethod(name, implementation) {
    if (IteratorPrototype && !IteratorPrototype[name]) {
      ObjectCtor.defineProperty(IteratorPrototype, name, {
        configurable: true,
        writable: true,
        value: implementation,
      });
    }
  }

  function defineConstructorMethod(constructor, name, implementation) {
    if (constructor && !constructor[name]) {
      ObjectCtor.defineProperty(constructor, name, {
        configurable: true,
        writable: true,
        value: implementation,
      });
    }
  }

  function createToggleEvent(type, oldState, newState, cancelable) {
    var event = new EventCtor(type, {bubbles: false, cancelable: cancelable});
    ObjectCtor.defineProperty(event, 'oldState', {
      configurable: true,
      enumerable: true,
      value: oldState,
    });
    ObjectCtor.defineProperty(event, 'newState', {
      configurable: true,
      enumerable: true,
      value: newState,
    });
    return event;
  }

  function isPopoverOpen(element) {
    return Boolean(element && element.getAttribute && element.getAttribute('data-ldt-popover-open') === 'true');
  }

  function setPopoverOpen(element, nextState) {
    if (!element || !element.setAttribute || !element.removeAttribute) {
      return;
    }
    if (nextState) {
      element.setAttribute('data-ldt-popover-open', 'true');
    } else {
      element.removeAttribute('data-ldt-popover-open');
    }
  }

  function iteratorResult(value, done) {
    return {value: value, done: done};
  }

  function getIteratorRecord(iterator) {
    if (!iterator || typeof iterator.next !== 'function') {
      throw new TypeErrorCtor('Object is not an iterator');
    }
    return iterator;
  }

  function iteratorFromValue(value) {
    if (value && typeof value.next === 'function') {
      return value;
    }
    if (SymbolCtor && SymbolCtor.iterator && value && typeof value[SymbolCtor.iterator] === 'function') {
      return value[SymbolCtor.iterator]();
    }
    return null;
  }

  function createIterator(nextImplementation) {
    var iterator = ObjectCtor.create(IteratorPrototype || ObjectCtor.prototype);
    ObjectCtor.defineProperty(iterator, 'next', {
      configurable: true,
      writable: true,
      value: nextImplementation,
    });
    if (SymbolCtor && SymbolCtor.iterator) {
      ObjectCtor.defineProperty(iterator, SymbolCtor.iterator, {
        configurable: true,
        writable: true,
        value: function iteratorFactory() {
          return this;
        },
      });
    }
    return iterator;
  }

  IteratorPrototype = resolveIteratorPrototype();

  if (!IteratorCtor && IteratorPrototype) {
    IteratorCtor = function Iterator() {
      throw new TypeErrorCtor('Iterator cannot be constructed directly');
    };
    IteratorCtor.prototype = IteratorPrototype;
    ObjectCtor.defineProperty(root, 'Iterator', {
      configurable: true,
      writable: true,
      value: IteratorCtor,
    });
  }

  if (IteratorPrototype && SymbolCtor && SymbolCtor.iterator && !IteratorPrototype[SymbolCtor.iterator]) {
    ObjectCtor.defineProperty(IteratorPrototype, SymbolCtor.iterator, {
      configurable: true,
      writable: true,
      value: function iteratorFactory() {
        return this;
      },
    });
  }

  if (!PromiseCtor.withResolvers) {
    ObjectCtor.defineProperty(PromiseCtor, 'withResolvers', {
      configurable: true,
      writable: true,
      value: function withResolvers() {
        var resolve;
        var reject;
        var PromiseClass = typeof this === 'function' ? this : PromiseCtor;
        var promise = new PromiseClass(function (resolveCallback, rejectCallback) {
          resolve = resolveCallback;
          reject = rejectCallback;
        });
        return {promise: promise, resolve: resolve, reject: reject};
      },
    });
  }

  defineConstructorMethod(URLCtor, 'canParse', function canParse(url, base) {
    try {
      if (typeof base === 'undefined') {
        new URLCtor(url);
      } else {
        new URLCtor(url, base);
      }
      return true;
    } catch (error) {
      return false;
    }
  });

  if (ElementCtor && ElementCtor.prototype && !ElementCtor.prototype.__ldtPopoverSelectorCompat) {
    var nativeMatches = ElementCtor.prototype.matches;
    if (typeof nativeMatches === 'function') {
      ObjectCtor.defineProperty(ElementCtor.prototype, 'matches', {
        configurable: true,
        writable: true,
        value: function matches(selector) {
          if (selector === ':popover-open') {
            try {
              return nativeMatches.call(this, selector);
            } catch (error) {
              return isPopoverOpen(this);
            }
          }
          return nativeMatches.call(this, selector);
        },
      });
      ObjectCtor.defineProperty(ElementCtor.prototype, '__ldtPopoverSelectorCompat', {
        configurable: true,
        writable: true,
        value: true,
      });
    }
  }

  if (HTMLElementCtor && HTMLElementCtor.prototype && typeof HTMLElementCtor.prototype.showPopover !== 'function' &&
      EventCtor) {
    ObjectCtor.defineProperty(HTMLElementCtor.prototype, 'showPopover', {
      configurable: true,
      writable: true,
      value: function showPopover() {
        if (isPopoverOpen(this)) {
          return;
        }
        var beforeToggleEvent = createToggleEvent('beforetoggle', 'closed', 'open', true);
        if (!this.dispatchEvent(beforeToggleEvent)) {
          return;
        }
        setPopoverOpen(this, true);
        this.dispatchEvent(createToggleEvent('toggle', 'closed', 'open', false));
      },
    });

    ObjectCtor.defineProperty(HTMLElementCtor.prototype, 'hidePopover', {
      configurable: true,
      writable: true,
      value: function hidePopover() {
        if (!isPopoverOpen(this)) {
          return;
        }
        var beforeToggleEvent = createToggleEvent('beforetoggle', 'open', 'closed', true);
        if (!this.dispatchEvent(beforeToggleEvent)) {
          return;
        }
        setPopoverOpen(this, false);
        this.dispatchEvent(createToggleEvent('toggle', 'open', 'closed', false));
      },
    });

    ObjectCtor.defineProperty(HTMLElementCtor.prototype, 'togglePopover', {
      configurable: true,
      writable: true,
      value: function togglePopover() {
        if (isPopoverOpen(this)) {
          this.hidePopover();
        } else {
          this.showPopover();
        }
      },
    });
  }

  defineArrayMethod('findLast', function findLast(predicate, thisArg) {
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    for (var index = this.length - 1; index >= 0; --index) {
      var value = this[index];
      if (predicate.call(thisArg, value, index, this)) {
        return value;
      }
    }
    return undefined;
  });

  defineArrayMethod('findLastIndex', function findLastIndex(predicate, thisArg) {
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    for (var index = this.length - 1; index >= 0; --index) {
      if (predicate.call(thisArg, this[index], index, this)) {
        return index;
      }
    }
    return -1;
  });

  defineArrayMethod('toSorted', function toSorted(compareFn) {
    var copy = toArrayCopy(this);
    copy.sort(compareFn);
    return copy;
  });

  defineArrayMethod('toReversed', function toReversed() {
    var copy = toArrayCopy(this);
    copy.reverse();
    return copy;
  });

  defineArrayMethod('toSpliced', function toSpliced(start, deleteCount) {
    var copy = toArrayCopy(this);
    var items = ArrayCtor.prototype.slice.call(arguments, 2);
    ArrayCtor.prototype.splice.apply(copy, [start, deleteCount].concat(items));
    return copy;
  });

  defineArrayMethod('with', function withValue(index, value) {
    var copy = toArrayCopy(this);
    var normalizedIndex = index < 0 ? copy.length + index : index;
    if (normalizedIndex < 0 || normalizedIndex >= copy.length) {
      throw new RangeErrorCtor('Index out of range');
    }
    copy[normalizedIndex] = value;
    return copy;
  });

  if (!MapCtor.groupBy) {
    ObjectCtor.defineProperty(MapCtor, 'groupBy', {
      configurable: true,
      writable: true,
      value: function groupBy(items, callback) {
        var result = new MapCtor();
        var index = 0;
        for (var item of items) {
          var key = callback(item, index++);
          var values = result.get(key);
          if (values) {
            values.push(item);
          } else {
            result.set(key, [item]);
          }
        }
        return result;
      },
    });
  }

  if (!ObjectCtor.groupBy) {
    ObjectCtor.defineProperty(ObjectCtor, 'groupBy', {
      configurable: true,
      writable: true,
      value: function groupBy(items, callback) {
        var result = ObjectCtor.create(null);
        var index = 0;
        for (var item of items) {
          var key = callback(item, index++);
          if (!ObjectCtor.prototype.hasOwnProperty.call(result, key)) {
            result[key] = [];
          }
          result[key].push(item);
        }
        return result;
      },
    });
  }

  if (!ArrayCtor.fromAsync) {
    ObjectCtor.defineProperty(ArrayCtor, 'fromAsync', {
      configurable: true,
      writable: true,
      value: async function fromAsync(items, mapFn, thisArg) {
        var result = [];
        var index = 0;
        for await (var item of items) {
          var nextValue = mapFn ? await mapFn.call(thisArg, item, index) : item;
          result.push(nextValue);
          index += 1;
        }
        return result;
      },
    });
  }

  defineSetMethod('union', function union(other) {
    var result = new SetCtor(this);
    for (var value of toSet(other)) {
      result.add(value);
    }
    return result;
  });

  defineSetMethod('intersection', function intersection(other) {
    var otherSet = toSet(other);
    var result = new SetCtor();
    for (var value of this) {
      if (otherSet.has(value)) {
        result.add(value);
      }
    }
    return result;
  });

  defineSetMethod('difference', function difference(other) {
    var otherSet = toSet(other);
    var result = new SetCtor();
    for (var value of this) {
      if (!otherSet.has(value)) {
        result.add(value);
      }
    }
    return result;
  });

  defineSetMethod('symmetricDifference', function symmetricDifference(other) {
    var otherSet = toSet(other);
    var result = new SetCtor();
    for (var value of this) {
      if (!otherSet.has(value)) {
        result.add(value);
      }
    }
    for (var otherValue of otherSet) {
      if (!this.has(otherValue)) {
        result.add(otherValue);
      }
    }
    return result;
  });

  defineSetMethod('isSubsetOf', function isSubsetOf(other) {
    var otherSet = toSet(other);
    for (var value of this) {
      if (!otherSet.has(value)) {
        return false;
      }
    }
    return true;
  });

  defineSetMethod('isSupersetOf', function isSupersetOf(other) {
    var otherSet = toSet(other);
    for (var value of otherSet) {
      if (!this.has(value)) {
        return false;
      }
    }
    return true;
  });

  defineSetMethod('isDisjointFrom', function isDisjointFrom(other) {
    var otherSet = toSet(other);
    for (var value of this) {
      if (otherSet.has(value)) {
        return false;
      }
    }
    return true;
  });

  defineIteratorMethod('map', function map(callback, thisArg) {
    if (typeof callback !== 'function') {
      throw new TypeErrorCtor('callback must be a function');
    }
    var iterator = getIteratorRecord(this);
    var index = 0;
    return createIterator(function next() {
      var step = iterator.next();
      if (!step || step.done) {
        return iteratorResult(undefined, true);
      }
      return iteratorResult(callback.call(thisArg, step.value, index++, iterator), false);
    });
  });

  defineIteratorMethod('filter', function filter(callback, thisArg) {
    if (typeof callback !== 'function') {
      throw new TypeErrorCtor('callback must be a function');
    }
    var iterator = getIteratorRecord(this);
    var index = 0;
    return createIterator(function next() {
      while (true) {
        var step = iterator.next();
        if (!step || step.done) {
          return iteratorResult(undefined, true);
        }
        if (callback.call(thisArg, step.value, index++, iterator)) {
          return iteratorResult(step.value, false);
        }
      }
    });
  });

  defineIteratorMethod('flatMap', function flatMap(callback, thisArg) {
    if (typeof callback !== 'function') {
      throw new TypeErrorCtor('callback must be a function');
    }
    var iterator = getIteratorRecord(this);
    var innerIterator = null;
    var index = 0;
    return createIterator(function next() {
      while (true) {
        if (innerIterator) {
          var innerStep = innerIterator.next();
          if (innerStep && !innerStep.done) {
            return iteratorResult(innerStep.value, false);
          }
          innerIterator = null;
        }

        var outerStep = iterator.next();
        if (!outerStep || outerStep.done) {
          return iteratorResult(undefined, true);
        }

        var mapped = callback.call(thisArg, outerStep.value, index++, iterator);
        innerIterator = iteratorFromValue(mapped);
        if (!innerIterator) {
          return iteratorResult(mapped, false);
        }
      }
    });
  });

  defineIteratorMethod('take', function take(limit) {
    var iterator = getIteratorRecord(this);
    var remaining = Number(limit);
    if (isNaN(remaining) || remaining < 0) {
      throw new RangeErrorCtor('limit must be a non-negative number');
    }
    remaining = Math.floor(remaining);
    return createIterator(function next() {
      if (remaining <= 0) {
        return iteratorResult(undefined, true);
      }
      remaining -= 1;
      var step = iterator.next();
      if (!step || step.done) {
        remaining = 0;
        return iteratorResult(undefined, true);
      }
      return iteratorResult(step.value, false);
    });
  });

  defineIteratorMethod('drop', function drop(limit) {
    var iterator = getIteratorRecord(this);
    var remaining = Number(limit);
    if (isNaN(remaining) || remaining < 0) {
      throw new RangeErrorCtor('limit must be a non-negative number');
    }
    remaining = Math.floor(remaining);
    return createIterator(function next() {
      while (remaining > 0) {
        var skipped = iterator.next();
        if (!skipped || skipped.done) {
          remaining = 0;
          return iteratorResult(undefined, true);
        }
        remaining -= 1;
      }
      var step = iterator.next();
      if (!step || step.done) {
        return iteratorResult(undefined, true);
      }
      return iteratorResult(step.value, false);
    });
  });

  defineIteratorMethod('find', function find(callback, thisArg) {
    if (typeof callback !== 'function') {
      throw new TypeErrorCtor('callback must be a function');
    }
    var iterator = getIteratorRecord(this);
    var index = 0;
    while (true) {
      var step = iterator.next();
      if (!step || step.done) {
        return undefined;
      }
      if (callback.call(thisArg, step.value, index++, iterator)) {
        return step.value;
      }
    }
  });

  defineIteratorMethod('some', function some(callback, thisArg) {
    if (typeof callback !== 'function') {
      throw new TypeErrorCtor('callback must be a function');
    }
    var iterator = getIteratorRecord(this);
    var index = 0;
    while (true) {
      var step = iterator.next();
      if (!step || step.done) {
        return false;
      }
      if (callback.call(thisArg, step.value, index++, iterator)) {
        return true;
      }
    }
  });

  defineIteratorMethod('every', function every(callback, thisArg) {
    if (typeof callback !== 'function') {
      throw new TypeErrorCtor('callback must be a function');
    }
    var iterator = getIteratorRecord(this);
    var index = 0;
    while (true) {
      var step = iterator.next();
      if (!step || step.done) {
        return true;
      }
      if (!callback.call(thisArg, step.value, index++, iterator)) {
        return false;
      }
    }
  });

  defineIteratorMethod('reduce', function reduce(callback, initialValue) {
    if (typeof callback !== 'function') {
      throw new TypeErrorCtor('callback must be a function');
    }
    var iterator = getIteratorRecord(this);
    var hasAccumulator = arguments.length > 1;
    var accumulator = initialValue;
    var index = 0;

    while (true) {
      var step = iterator.next();
      if (!step || step.done) {
        if (!hasAccumulator) {
          throw new TypeErrorCtor('Reduce of empty iterator with no initial value');
        }
        return accumulator;
      }
      if (!hasAccumulator) {
        accumulator = step.value;
        hasAccumulator = true;
      } else {
        accumulator = callback(accumulator, step.value, index, iterator);
      }
      index += 1;
    }
  });

  defineIteratorMethod('forEach', function forEach(callback, thisArg) {
    if (typeof callback !== 'function') {
      throw new TypeErrorCtor('callback must be a function');
    }
    var iterator = getIteratorRecord(this);
    var index = 0;
    while (true) {
      var step = iterator.next();
      if (!step || step.done) {
        return;
      }
      callback.call(thisArg, step.value, index++, iterator);
    }
  });

  defineIteratorMethod('toArray', function toArray() {
    var iterator = getIteratorRecord(this);
    var result = [];
    while (true) {
      var step = iterator.next();
      if (!step || step.done) {
        return result;
      }
      result.push(step.value);
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* global define */
(function (root, factory) {
  /* istanbul ignore next */
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.compareVersions = factory();
  }
})(this, function () {
  var semver =
    /^[v^~<>=]*?(\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+))?(?:-([\da-z\-]+(?:\.[\da-z\-]+)*))?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?)?)?$/i;

  function indexOrEnd(str, q) {
    return str.indexOf(q) === -1 ? str.length : str.indexOf(q);
  }

  function split(v) {
    var c = v.replace(/^v/, '').replace(/\+.*$/, '');
    var patchIndex = indexOrEnd(c, '-');
    var arr = c.substring(0, patchIndex).split('.');
    arr.push(c.substring(patchIndex + 1));
    return arr;
  }

  function tryParse(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? v : n;
  }

  function validateAndParse(v) {
    if (typeof v !== 'string') {
      throw new TypeError('Invalid argument expected string');
    }
    var match = v.match(semver);
    if (!match) {
      throw new Error(
        "Invalid argument not valid semver ('" + v + "' received)"
      );
    }
    match.shift();
    return match;
  }

  function forceType(a, b) {
    return typeof a !== typeof b ? [String(a), String(b)] : [a, b];
  }

  function compareStrings(a, b) {
    var [ap, bp] = forceType(tryParse(a), tryParse(b));
    if (ap > bp) return 1;
    if (ap < bp) return -1;
    return 0;
  }

  function compareSegments(a, b) {
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var r = compareStrings(a[i] || 0, b[i] || 0);
      if (r !== 0) return r;
    }
    return 0;
  }

  function compareVersions(v1, v2) {
    [v1, v2].forEach(validateAndParse);

    var s1 = split(v1);
    var s2 = split(v2);

    for (var i = 0; i < Math.max(s1.length - 1, s2.length - 1); i++) {
      var n1 = parseInt(s1[i] || 0, 10);
      var n2 = parseInt(s2[i] || 0, 10);

      if (n1 > n2) return 1;
      if (n2 > n1) return -1;
    }

    var sp1 = s1[s1.length - 1];
    var sp2 = s2[s2.length - 1];

    if (sp1 && sp2) {
      var p1 = sp1.split('.').map(tryParse);
      var p2 = sp2.split('.').map(tryParse);

      for (i = 0; i < Math.max(p1.length, p2.length); i++) {
        if (
          p1[i] === undefined ||
          (typeof p2[i] === 'string' && typeof p1[i] === 'number')
        )
          return -1;
        if (
          p2[i] === undefined ||
          (typeof p1[i] === 'string' && typeof p2[i] === 'number')
        )
          return 1;

        if (p1[i] > p2[i]) return 1;
        if (p2[i] > p1[i]) return -1;
      }
    } else if (sp1 || sp2) {
      return sp1 ? -1 : 1;
    }

    return 0;
  }

  var allowedOperators = ['>', '>=', '=', '<', '<='];

  var operatorResMap = {
    '>': [1],
    '>=': [0, 1],
    '=': [0],
    '<=': [-1, 0],
    '<': [-1],
  };

  function validateOperator(op) {
    if (typeof op !== 'string') {
      throw new TypeError(
        'Invalid operator type, expected string but got ' + typeof op
      );
    }
    if (allowedOperators.indexOf(op) === -1) {
      throw new TypeError(
        'Invalid operator, expected one of ' + allowedOperators.join('|')
      );
    }
  }

  compareVersions.validate = function (version) {
    return typeof version === 'string' && semver.test(version);
  };

  compareVersions.compare = function (v1, v2, operator) {
    // Validate operator
    validateOperator(operator);

    // since result of compareVersions can only be -1 or 0 or 1
    // a simple map can be used to replace switch
    var res = compareVersions(v1, v2);
    return operatorResMap[operator].indexOf(res) > -1;
  };

  compareVersions.satisfies = function (v, r) {
    // if no range operator then "="
    var match = r.match(/^([<>=~^]+)/);
    var op = match ? match[1] : '=';

    // if gt/lt/eq then operator compare
    if (op !== '^' && op !== '~') return compareVersions.compare(v, r, op);

    // else range of either "~" or "^" is assumed
    var [v1, v2, v3] = validateAndParse(v);
    var [m1, m2, m3] = validateAndParse(r);
    if (compareStrings(v1, m1) !== 0) return false;
    if (op === '^') {
      return compareSegments([v2, v3], [m2, m3]) >= 0;
    }
    if (compareStrings(v2, m2) !== 0) return false;
    return compareStrings(v3, m3) >= 0;
  };

  return compareVersions;
});
