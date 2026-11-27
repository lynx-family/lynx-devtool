// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  createPageEnvironmentManager,
  SimulatorErrorCodes,
  toSimulatorErrorInfo,
} from '../dist/index.js';

let tempDirectory;
let runtime;
let manager;
const target = 'https://example.com/main.lynx.bundle';

beforeEach(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-simulator-page-env-runtime-'));
  configure();
});

afterEach(() => {
  manager.dispose();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('page environment', () => {
  test('loads template data and global props from options', async () => {
    const page = await openEnvironment({
      templateData: { userId: '123' },
      globalProps: { theme: 'dark' },
    });
    assert.deepEqual(runtime.windows.get(page.id).options.lynxOptions, {
      data: { userId: '123' },
      globalProps: { theme: 'dark' },
    });
    const withoutEnvironment = await manager.open({ target });
    assert.equal(runtime.windows.get(withoutEnvironment.id).options.lynxOptions, undefined);
    const empty = await openEnvironment({});
    assert.equal(runtime.windows.get(empty.id).options.lynxOptions?.data, undefined);
    assert.equal(runtime.windows.get(empty.id).options.lynxOptions?.globalProps, undefined);
  });

  test('registers one JSB handler per name and matches mocks by params', async () => {
    const logs = [];
    configure({ onDispatch: (_event, payload) => logs.push(payload) });
    const page = await openEnvironment({
      jsb: {
        bridge: [
          {
            name: 'x.request',
            params: { url: '/cards', data: { tab: 'ApplyList' } },
            result: { data: { cards: ['a'] } },
          },
          { name: 'x.request', result: { data: { fallback: true } } },
          {
            name: 'x.getSettings',
            params: { keys: ['flag'] },
            result: { data: { flag: true } },
          },
        ],
      },
    });
    assert.equal(runtime.handlers.size, 2);
    assert.deepEqual(
      await runtime.callJSB(
        'x.request',
        { url: '/cards', data: { tab: 'ApplyList', extra: true } },
        page
      ),
      { data: { cards: ['a'] } }
    );
    assert.deepEqual(await runtime.callJSB('x.request', { url: '/other' }, page), {
      data: { fallback: true },
    });
    assert.equal(await runtime.callJSB('x.getSettings', { keys: ['other'] }, page), undefined);
    assert.deepEqual(
      logs.map(({ name, matched }) => ({ name, matched })),
      [
        { name: 'x.request', matched: true },
        { name: 'x.request', matched: true },
        { name: 'x.getSettings', matched: false },
      ]
    );
    assert.equal(logs[1].matchedParams, undefined);
  });

  test('releases page environment when its window is closed', async () => {
    const page = await openEnvironment({
      jsb: { bridge: [{ name: 'x.request', result: { ok: true } }] },
    });
    await page.close();
    assert.equal(await runtime.callJSB('x.request', {}, page), undefined);
  });

  test('keeps same-name JSB mocks scoped by page environment context', async () => {
    const first = await openEnvironment({
      jsb: { bridge: [{ name: 'x.request', result: { data: 'first' } }] },
    });
    const second = await openEnvironment({
      jsb: { bridge: [{ name: 'x.request', result: { data: 'second' } }] },
    });
    assert.equal(runtime.handlers.size, 1);
    assert.deepEqual(await runtime.callJSB('x.request', {}, first), { data: 'first' });
    assert.deepEqual(await runtime.callJSB('x.request', {}, second), { data: 'second' });
  });

  test('matches array params strictly before using fallback mocks', async () => {
    const page = await openEnvironment({
      jsb: {
        bridge: [
          {
            name: 'x.getSettings',
            params: { keys: ['a', 'b'] },
            result: { data: { exact: true } },
          },
          { name: 'x.getSettings', result: { data: { fallback: true } } },
        ],
      },
    });
    assert.deepEqual(await runtime.callJSB('x.getSettings', { keys: ['a', 'b'] }, page), {
      data: { exact: true },
    });
    assert.deepEqual(await runtime.callJSB('x.getSettings', { keys: ['b', 'a'] }, page), {
      data: { fallback: true },
    });
    assert.deepEqual(await runtime.callJSB('x.getSettings', { keys: ['a'] }, page), {
      data: { fallback: true },
    });
  });

  test('delays matched JSB mock results', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const logs = [];
    configure({ onDispatch: (_event, payload) => logs.push(payload) });
    const page = await openEnvironment({
      jsb: {
        bridge: [{ name: 'x.request', delayMs: 1_000, result: { data: { delayed: true } } }],
      },
    });
    const onResult = t.mock.fn();
    const result = runtime.callJSB('x.request', {}, page).then(onResult);
    t.mock.timers.tick(999);
    await Promise.resolve();
    assert.equal(onResult.mock.calls.length, 0);
    t.mock.timers.tick(1);
    await result;
    assert.equal(onResult.mock.calls.length, 1);
    assert.deepEqual(onResult.mock.calls[0].arguments, [{ data: { delayed: true } }]);
    assert.deepEqual(
      logs.map(({ name, matched, delayMs }) => ({ name, matched, delayMs })),
      [{ name: 'x.request', matched: true, delayMs: 1_000 }]
    );
  });

  test('prefers matching mocks and falls back to real handlers', async (t) => {
    const logs = [];
    const realHandler = t.mock.fn((params) => ({ source: 'real', params }));
    configure({
      realHandlers: [{ name: 'x.getStorageItem', handler: realHandler }],
      onDispatch: (event, payload) => logs.push({ event, payload }),
    });
    const page = await openEnvironment({
      jsb: {
        bridge: [
          {
            name: 'x.getStorageItem',
            params: { data: { key: 'mocked' } },
            result: { code: 1, data: { data: 'mock-value' }, msg: '' },
          },
        ],
      },
    });
    const mockedParams = { data: { key: 'mocked' } };
    assert.deepEqual(await runtime.callJSB('x.getStorageItem', mockedParams, page), {
      code: 1,
      data: { data: 'mock-value' },
      msg: '',
    });
    assert.equal(realHandler.mock.calls.length, 0);
    const realParams = { data: { key: 'stored' } };
    assert.deepEqual(await runtime.callJSB('x.getStorageItem', realParams, page), {
      source: 'real',
      params: realParams,
    });
    assert.deepEqual(realHandler.mock.calls[0].arguments[0], realParams);
    assert.equal(typeof realHandler.mock.calls[0].arguments[1], 'object');
    assert.deepEqual(await runtime.callJSB('x.getStorageItem', mockedParams), {
      source: 'real',
      params: mockedParams,
    });
    assert.deepEqual(realHandler.mock.calls[1].arguments[0], mockedParams);
    assert.equal(typeof realHandler.mock.calls[1].arguments[1], 'object');
    assert.deepEqual(
      logs.map(({ event, payload }) => ({ event, name: payload.name, matched: payload.matched })),
      [
        { event: 'jsb-mock', name: 'x.getStorageItem', matched: true },
        { event: 'jsb-mock', name: 'x.getStorageItem', matched: false },
        { event: 'jsb-real', name: 'x.getStorageItem', matched: undefined },
        { event: 'jsb-real', name: 'x.getStorageItem', matched: undefined },
      ]
    );
    assert.deepEqual(logs[2].payload.params, realParams);
    assert.deepEqual(logs[3].payload.params, mockedParams);
  });

  test('registers real handlers without a page environment', async (t) => {
    const realHandler = t.mock.fn(() => ({ source: 'real' }));
    configure({ realHandlers: [{ name: 'x.getStorageItem', handler: realHandler }] });
    assert.deepEqual(await runtime.callJSB('x.getStorageItem', {}), { source: 'real' });
    assert.equal(realHandler.mock.calls.length, 1);
  });

  test('loads page environments from HTTP URLs', async () => {
    const server = http.createServer((request, response) => {
      if (request.url === '/missing.json') {
        response.statusCode = 404;
        response.end();
        return;
      }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ templateData: { source: 'http' } }));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      assert.notEqual(address, null);
      assert.notEqual(typeof address, 'string');
      const source = `http://127.0.0.1:${address.port}`;
      const page = await manager.open({ target, pageEnvironment: `${source}/page-env.json` });
      assert.deepEqual(runtime.windows.get(page.id).options.lynxOptions, {
        data: { source: 'http' },
      });
      await assert.rejects(
        () => manager.open({ target, pageEnvironment: `${source}/missing.json` }),
        (error) =>
          error.message.includes(`Failed to download ${source}/missing.json: 404 Not Found`)
      );
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  test('loads page environments from file URLs', async () => {
    const filePath = path.join(tempDirectory, 'file-url.json');
    fs.writeFileSync(filePath, JSON.stringify({ templateData: { source: 'file-url' } }));
    const page = await manager.open({ target, pageEnvironment: pathToFileURL(filePath).href });
    assert.deepEqual(runtime.windows.get(page.id).options.lynxOptions, {
      data: { source: 'file-url' },
    });
  });

  test('throws a readable error for invalid environment files', async () => {
    const filePath = path.join(tempDirectory, 'invalid.json');
    fs.writeFileSync(filePath, JSON.stringify({ jsb: { bridge: {} } }));
    await assert.rejects(
      () => manager.open({ target, pageEnvironment: filePath }),
      /pageEnvironment\.jsb\.bridge must be an array/
    );
  });

  test('validates template data and global props shape', async () => {
    await assert.rejects(
      () => openEnvironment({ templateData: [] }),
      /pageEnvironment\.templateData must be an object/
    );
    await assert.rejects(
      () => openEnvironment({ globalProps: [] }),
      /pageEnvironment\.globalProps must be an object/
    );
  });

  for (const delayMs of [-1, 1.5, 2_147_483_648, '1000']) {
    test(`rejects invalid JSB mock delay: ${delayMs}`, async () => {
      await assert.rejects(
        () => openEnvironment({ jsb: { bridge: [{ name: 'x.request', delayMs, result: {} }] } }),
        /delayMs must be an integer between 0 and 2147483647/
      );
    });
  }
});

describe('JavaScript page environments', () => {
  for (const extension of ['mjs', 'js']) {
    test(`loads asynchronous .${extension} factories and fields with source context`, async () => {
      fs.writeFileSync(path.join(tempDirectory, 'package.json'), '{"type":"module"}');
      fs.writeFileSync(path.join(tempDirectory, 'helper.mjs'), 'export const title = "测试页面";');
      const source = writeModule(
        `import { title } from './helper.mjs';
        export default async (context) => ({
          templateData: async (dataContext) => ({ title, ...dataContext }),
          globalProps: async (propsContext) => ({ sameContext: propsContext === context }),
          jsb: { bridge: [{ name: 'x.mock', result: { ok: true } }] },
        });`,
        `page env.${extension}`
      );
      const window = { size: { width: 320, height: 640 }, windowless: true };
      const context = { label: 'host' };
      const page = await manager.open({
        target,
        pageEnvironment: extension === 'mjs' ? path.basename(source) : pathToFileURL(source).href,
        cwd: tempDirectory,
        window,
        context,
      });
      assert.deepEqual(runtime.windows.get(page.id).options.lynxOptions, {
        data: {
          title: '测试页面',
          source: pathToFileURL(source).href,
          cwd: tempDirectory,
          target,
          windowOptions: window,
          context,
        },
        globalProps: { sameContext: true },
      });
      assert.deepEqual(await runtime.callJSB('x.mock', {}, page), { ok: true });
    });
  }

  test('calls the cached module factory per page and isolates asynchronous JSB state', async () => {
    const source = writeModule(`
      let factories = 0;
      export default async () => {
        const factory = ++factories;
        let calls = 0;
        return { jsb: async (name, params, context) => ({
          name, params, factory, calls: ++calls,
          source: context.source, cwd: context.cwd, target: context.target,
          windowId: context.window.id, label: context.context.label,
        }) };
      }
    `);
    const first = await manager.open({
      target,
      pageEnvironment: source,
      context: { label: 'first' },
    });
    const second = await manager.open({
      target,
      pageEnvironment: source,
      context: { label: 'second' },
    });
    assert.equal(runtime.handlers.size, 0);
    const expected = {
      name: 'unknown.name',
      params: { value: 1 },
      factory: 1,
      calls: 1,
      source: pathToFileURL(source).href,
      cwd: process.cwd(),
      target,
      windowId: first.id,
      label: 'first',
    };
    assert.deepEqual(await runtime.callJSB('unknown.name', { value: 1 }, first), expected);
    assert.deepEqual(await runtime.callJSB('unknown.name', { value: 1 }, second), {
      ...expected,
      factory: 2,
      windowId: second.id,
      label: 'second',
    });
    assert.deepEqual(await runtime.callJSB('unknown.name', { value: 1 }, first), {
      ...expected,
      calls: 2,
    });
  });

  test('delegates only through next and propagates asynchronous JSB failures', async (t) => {
    const realHandler = t.mock.fn(async (params) => ({ real: params }));
    configure({ realHandlers: [{ name: 'x.real', handler: realHandler }] });
    const source = writeModule(`export default () => ({
      jsb: async (name, params, { next }) => {
        if (params.empty) return undefined;
        if (params.fail) throw new Error('JSB rejected');
        return next();
      },
    });`);
    const page = await manager.open({ target, pageEnvironment: source });
    assert.equal(await runtime.callJSB('x.real', { empty: true }, page), undefined);
    assert.equal(realHandler.mock.calls.length, 0);
    assert.deepEqual(await runtime.callJSB('x.real', { key: 1 }, page), { real: { key: 1 } });
    const withHost = await manager.open({
      target,
      pageEnvironment: source,
      onJSBInvoke: async (name, params, { next }) =>
        name === 'x.host' ? { host: params } : next(),
    });
    assert.deepEqual(await runtime.callJSB('x.host', { key: 2 }, withHost), { host: { key: 2 } });
    assert.deepEqual(await runtime.callJSB('x.real', { key: 3 }, withHost), { real: { key: 3 } });
    await assert.rejects(() => runtime.callJSB('x.real', { fail: true }, withHost), /JSB rejected/);
    assert.equal(realHandler.mock.calls.length, 2);
  });

  for (const cleanup of ['close', 'dispose']) {
    test(`releases function handlers on ${cleanup}`, async () => {
      configure({ realHandlers: [{ name: 'x.real', handler: () => 'real' }] });
      const source = writeModule(`export default () => ({ jsb: async () => 'mock' });`);
      const page = await manager.open({ target, pageEnvironment: source });
      assert.equal(await runtime.callJSB('x.real', {}, page), 'mock');
      if (cleanup === 'close') await page.close();
      else manager.dispose();
      assert.equal(await runtime.callJSB('x.real', {}, page), 'real');
    });
  }

  for (const [name, code, message] of [
    ['non-function export', 'export default {};', /default-export a function/],
    ['syntax error', 'export default (', /Unexpected/],
    [
      'factory rejection',
      'export default async () => { throw new Error("factory rejected"); };',
      /factory rejected/,
    ],
    ['invalid environment', 'export default () => null;', /must be an object/],
    [
      'invalid data result',
      'export default () => ({ templateData: async () => [] });',
      /templateData must be an object/,
    ],
    [
      'props rejection',
      'export default () => ({ globalProps: async () => { throw new Error("props rejected"); } });',
      /props rejected/,
    ],
  ]) {
    test(`reports ${name} before opening a window`, async () => {
      const source = writeModule(code);
      await assert.rejects(
        () => manager.open({ target, pageEnvironment: source }),
        (error) => {
          assert.equal(
            toSimulatorErrorInfo(error).code,
            SimulatorErrorCodes.RuntimeInvalidPageEnvironment
          );
          assert.match(error.message, message);
          assert.ok(error.message.includes(source));
          return true;
        }
      );
      assert.equal(runtime.windows.size, 0);
    });
  }

  test('rejects remote JavaScript modules', async () => {
    await assert.rejects(
      () => manager.open({ target, pageEnvironment: 'https://example.com/page-env.mjs' }),
      /JavaScript page environments must be local files/
    );
    assert.equal(runtime.windows.size, 0);
  });

  test('prevents an awaiting module factory from opening a window after disposal', async () => {
    const started = Promise.withResolvers();
    const pending = Promise.withResolvers();
    const source = writeModule(`export default async ({ context }) => {
      context.started();
      await context.pending;
      return { templateData: { ready: true } };
    };`);
    const opening = manager.open({
      target,
      pageEnvironment: source,
      context: { started: started.resolve, pending: pending.promise },
    });
    await started.promise;
    manager.dispose();
    pending.resolve();
    await assert.rejects(opening, (error) => {
      assert.equal(
        toSimulatorErrorInfo(error).code,
        SimulatorErrorCodes.RuntimePageEnvironmentDisposed
      );
      return true;
    });
    assert.equal(runtime.windows.size, 0);
  });
});

describe('page environment resource callbacks', () => {
  const request = {
    nativeWindowId: 101,
    url: 'https://example.com/cover.png',
    scheme: 'https',
    resourceType: 'Image',
  };

  test('isolates async factory state and passes resource and page context', async () => {
    const logs = [];
    configure({ onDispatch: (event, payload) => logs.push({ event, payload }) });
    const source = writeModule(`export default () => {
      let calls = 0;
      return { fetchResource: async (request, { source, cwd, target, window, context }) =>
        Buffer.from(JSON.stringify({ request, source, cwd, target,
          windowId: window.id, label: context.label, calls: ++calls })) };
    };`);
    const first = await manager.open({
      target,
      pageEnvironment: source,
      context: { label: 'first' },
    });
    const second = await manager.open({
      target,
      pageEnvironment: source,
      context: { label: 'second' },
    });
    const firstResult = JSON.parse(await runtime.fetchResource(request, first));
    assert.deepEqual(firstResult, {
      request,
      source: pathToFileURL(source).href,
      cwd: process.cwd(),
      target,
      windowId: first.id,
      label: 'first',
      calls: 1,
    });
    const secondRequest = { ...request, nativeWindowId: 102 };
    assert.deepEqual(JSON.parse(await runtime.fetchResource(secondRequest, second)), {
      ...firstResult,
      request: secondRequest,
      windowId: second.id,
      label: 'second',
    });
    assert.equal(JSON.parse(await runtime.fetchResource(request, first)).calls, 2);
    assert.deepEqual(logs[0], {
      event: 'resource-mock',
      payload: { ...request, simulatorWindowId: first.id },
    });
  });

  test('delegates through next but not for explicit undefined or failures', async (t) => {
    const logs = [];
    configure({ onDispatch: (event, payload) => logs.push({ event, payload }) });
    const host = t.mock.fn(async () => Buffer.from('host'));
    const source = writeModule(`export default () => ({
      fetchResource: async ({ url }, { next }) => {
        if (url.endsWith('/empty')) return undefined;
        if (url.endsWith('/fail')) throw new Error('resource rejected');
        return next();
      },
    });`);
    const page = await manager.open({ target, pageEnvironment: source, onFetchResource: host });
    assert.equal((await runtime.fetchResource(request, page)).toString(), 'host');
    assert.equal(host.mock.calls[0].arguments[0], request);
    assert.equal(host.mock.calls[0].arguments[1].window.id, page.id);
    assert.equal(
      await runtime.fetchResource({ ...request, url: `${target}/empty` }, page),
      undefined
    );
    const failedRequest = { ...request, url: `${target}/fail` };
    await assert.rejects(runtime.fetchResource(failedRequest, page), /resource rejected/);
    assert.equal(host.mock.calls.length, 1);
    assert.deepEqual(logs.at(-1), {
      event: 'resource-error',
      payload: {
        ...failedRequest,
        simulatorWindowId: page.id,
        message: 'Error: resource rejected',
      },
    });
    const withoutHost = await manager.open({ target, pageEnvironment: source });
    assert.equal(await runtime.fetchResource(request, withoutHost), undefined);
    const hostOnly = await manager.open({ target, onFetchResource: host });
    assert.equal((await runtime.fetchResource(request, hostOnly)).toString(), 'host');
  });

  for (const cleanup of ['close', 'fail', 'dispose']) {
    test(`releases resource factory state on ${cleanup}`, async () => {
      const source = writeModule(
        `export default () => ({ fetchResource: () => Buffer.from('mock') });`
      );
      const page = await manager.open({
        target,
        pageEnvironment: source,
        onFetchResource: () => Buffer.from('host'),
      });
      assert.equal((await runtime.fetchResource(request, page)).toString(), 'mock');
      if (cleanup === 'close') await page.close();
      else if (cleanup === 'fail') runtime.fail(page);
      else manager.dispose();
      assert.equal((await runtime.fetchResource(request, page)).toString(), 'host');
    });
  }

  test('rejects non-function resource rules before opening a window', async () => {
    await assert.rejects(
      openEnvironment({ fetchResource: {} }),
      /fetchResource must be a function/
    );
    assert.equal(runtime.windows.size, 0);
  });
});

function writeModule(code, name = 'page-env.mjs') {
  const source = path.join(tempDirectory, name);
  fs.writeFileSync(source, code);
  return source;
}

function configure(options = {}) {
  manager?.dispose();
  runtime = createRuntimeMock();
  manager = createPageEnvironmentManager({ runtime, ...options });
}

async function openEnvironment(data) {
  const filePath = path.join(tempDirectory, `${runtime.windows.size}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data));
  return manager.open({ target, pageEnvironment: filePath, cwd: tempDirectory });
}

function createRuntimeMock() {
  const handlers = new Map();
  const windows = new Map();
  const listeners = new Set();
  return {
    handlers,
    windows,
    registerJSBHandlers(registrations) {
      for (const { name, handler } of registrations) handlers.set(name, handler);
    },
    addWindowEventListener(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    fail(page) {
      const { info } = windows.get(page.id);
      info.status = 'failed';
      for (const listener of listeners) listener({ type: 'failed', window: info });
    },
    async fetchResource(request, page) {
      const record = windows.get(page.id);
      return record.options.onFetchResource?.(request, {
        window: record.info,
        context: record.options.context,
        next: () => undefined,
      });
    },
    async open(options) {
      const id = `win_${windows.size + 1}`;
      const info = createWindowInfo(id, options.target);
      windows.set(id, { options, info });
      return {
        id,
        getInfo: () => info,
        async close() {
          info.status = 'closed';
          for (const listener of listeners) listener({ type: 'closed', window: info });
        },
      };
    },
    async callJSB(name, params, page) {
      const record = windows.get(page?.id);
      const context = {
        window: record?.info ?? createWindowInfo('unscoped', target),
        context: record?.options.context,
      };
      const next = () => {
        const handler = handlers.get(name);
        assert.equal(typeof handler, 'function');
        return handler(params, context);
      };
      return record?.options.onJSBInvoke
        ? record.options.onJSBInvoke(name, params, { ...context, next })
        : next();
    },
  };
}

function createWindowInfo(id, target) {
  return {
    id,
    target,
    status: 'ready',
    size: { width: 390, height: 844 },
    windowless: false,
    focused: false,
    createdAt: 0,
    updatedAt: 0,
  };
}
