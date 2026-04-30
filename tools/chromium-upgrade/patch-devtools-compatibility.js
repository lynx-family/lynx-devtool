#!/usr/bin/env node

const fs = require('fs');

const targetFile = process.argv[2];

if (!targetFile) {
  console.error('Usage: patch-devtools-compatibility.js <path-to-devtools_compatibility.js>');
  process.exit(1);
}

const source = fs.readFileSync(targetFile, 'utf8');

const compatAnchor = `(window => {\n`;
const reattachPatch = `    reattachMainTarget() {
      this._dispatchOnInspectorFrontendAPI('reattachMainTarget', []);
    }
`;

let patched = source;

if (!patched.includes(`window.__LDT_COMPAT_POLYFILLS__`)) {
  if (!patched.includes(compatAnchor)) {
    console.error(`Patch anchor not found in ${targetFile}: ${compatAnchor}`);
    process.exit(1);
  }

  patched = patched.replace(
      compatAnchor,
      `(window => {
  if (!window.__LDT_COMPAT_POLYFILLS__) {
    window.__LDT_COMPAT_POLYFILLS__ = true;

    const ArrayCtor = window.Array;
    const MapCtor = window.Map;
    const ObjectCtor = window.Object;
    const PromiseCtor = window.Promise;
    const RangeErrorCtor = window.RangeError;

    const defineArrayMethod = (name, implementation) => {
      if (!ArrayCtor.prototype[name]) {
        ObjectCtor.defineProperty(ArrayCtor.prototype, name, {
          configurable: true,
          writable: true,
          value: implementation,
        });
      }
    };

    const toArrayCopy = value => ArrayCtor.prototype.slice.call(value);

    if (!PromiseCtor.withResolvers) {
      ObjectCtor.defineProperty(PromiseCtor, 'withResolvers', {
        configurable: true,
        writable: true,
        value: function withResolvers() {
          let resolve;
          let reject;
          const PromiseClass = typeof this === 'function' ? this : PromiseCtor;
          const promise = new PromiseClass((resolveCallback, rejectCallback) => {
            resolve = resolveCallback;
            reject = rejectCallback;
          });
          return {promise, resolve, reject};
        },
      });
    }

    defineArrayMethod('findLast', function findLast(predicate, thisArg) {
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }
      for (let index = this.length - 1; index >= 0; --index) {
        const value = this[index];
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
      for (let index = this.length - 1; index >= 0; --index) {
        if (predicate.call(thisArg, this[index], index, this)) {
          return index;
        }
      }
      return -1;
    });

    defineArrayMethod('toSorted', function toSorted(compareFn) {
      const copy = toArrayCopy(this);
      copy.sort(compareFn);
      return copy;
    });

    defineArrayMethod('toReversed', function toReversed() {
      const copy = toArrayCopy(this);
      copy.reverse();
      return copy;
    });

    defineArrayMethod('toSpliced', function toSpliced(start, deleteCount, ...items) {
      const copy = toArrayCopy(this);
      ArrayCtor.prototype.splice.call(copy, start, deleteCount, ...items);
      return copy;
    });

    defineArrayMethod('with', function withValue(index, value) {
      const copy = toArrayCopy(this);
      const normalizedIndex = index < 0 ? copy.length + index : index;
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
          const result = new MapCtor();
          let index = 0;
          for (const item of items) {
            const key = callback(item, index++);
            const values = result.get(key);
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
          const result = ObjectCtor.create(null);
          let index = 0;
          for (const item of items) {
            const key = callback(item, index++);
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
          const result = [];
          let index = 0;
          for await (const item of items) {
            const nextValue = mapFn ? await mapFn.call(thisArg, item, index) : item;
            result.push(nextValue);
            index += 1;
          }
          return result;
        },
      });
    }
  }

`,
  );
}

const anchor = `    /**
     * @param {boolean} hard
     */
    reloadInspectedPage(hard) {`;

if (!patched.includes(anchor)) {
  console.error(`Patch anchor not found in ${targetFile}`);
  process.exit(1);
}

if (!patched.includes(reattachPatch)) {
  patched = patched.replace(
      anchor,
      `${reattachPatch}
${anchor}`,
  );
}

if (patched === source) {
  console.log(`Already patched: ${targetFile}`);
  process.exit(0);
}

fs.writeFileSync(targetFile, patched);
console.log(`Patched: ${targetFile}`);
