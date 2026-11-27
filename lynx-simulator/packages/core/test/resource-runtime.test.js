// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createSimulatorRuntime, SimulatorErrorCodes } from '../dist/index.js';
import { handlers } from './fixtures/lynxtron.mjs';

// Replace only the native dependency, exercising the built public Core API.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@lynx-js/lynxtron') {
      return { url: new URL('./fixtures/lynxtron.mjs', import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
after(() => hooks.deregister());
const runtimes = [];
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose();
  assert.equal(handlers.size, 0, 'Core must release its protocol registrations');
});

function createRuntime() {
  const runtime = createSimulatorRuntime();
  runtimes.push(runtime);
  return runtime;
}

const target = 'https://example.com/main.lynx.bundle';
function request(windowId, scheme = 'https') {
  return { windowId, scheme, resourceType: 'Image', url: `${scheme}://example.com/cover.png` };
}

test('routes resources across windows and runtimes, translating native identity', async () => {
  const calls = [];
  const first = await createRuntime().open({
    target,
    onFetchResource: async (request, context) => {
      calls.push({ request, window: context.window.id });
      return Uint8Array.of(255, 0, 0);
    },
  });
  const second = await createRuntime().open({
    target,
    onFetchResource: () => Buffer.from([0, 0, 255]),
  });
  assert.equal(handlers.size, 3);
  for (const scheme of ['http', 'https', 'file']) {
    const nativeRequest = request(first.getLynxWindow().id, scheme);
    const response = await handlers.get(scheme)(nativeRequest);
    assert.deepEqual(response, {
      url: nativeRequest.url,
      statusCode: 0,
      data: Buffer.from([255, 0, 0]),
    });
    assert.deepEqual(calls.at(-1), {
      request: {
        nativeWindowId: nativeRequest.windowId,
        url: nativeRequest.url,
        scheme,
        resourceType: 'Image',
      },
      window: first.id,
    });
  }
  assert.deepEqual(
    (await handlers.get('https')(request(second.getLynxWindow().id))).data,
    Buffer.from([0, 0, 255])
  );
  await first.close();
  assert.equal(handlers.size, 3);
  assert.deepEqual(
    (await handlers.get('https')(request(second.getLynxWindow().id))).data,
    Buffer.from([0, 0, 255])
  );
  await second.close();
  assert.equal(handlers.size, 0);
});

test('delegates absent/unknown native IDs and asynchronous next to native loading', async () => {
  const runtime = createRuntime();
  let calls = 0;
  const page = await runtime.open({
    target,
    onFetchResource: async (_request, { next }) => {
      calls++;
      return next();
    },
  });
  const unmocked = await runtime.open({ target });
  const handle = handlers.get('https');
  assert.equal(handle(request(undefined)), undefined);
  assert.equal(handle(request(-1)), undefined);
  assert.equal(handle(request(unmocked.getLynxWindow().id)), undefined);
  assert.equal(calls, 0);
  assert.equal(await handle(request(page.getLynxWindow().id)), undefined);
  assert.equal(calls, 1);
});

test('rejects an existing protocol registration without taking ownership', async () => {
  const existing = () => undefined;
  handlers.set('https', existing);
  try {
    const runtime = createRuntime();
    await assert.rejects(
      runtime.open({ target, onFetchResource: () => undefined }),
      /already has a handler/
    );
    assert.deepEqual([...handlers], [['https', existing]]);
    assert.equal(runtime.listWindows()[0].status, 'closed');
  } finally {
    handlers.delete('https');
  }
});

for (const [name, callback] of [
  [
    'throw',
    () => {
      throw new Error('mock failed');
    },
  ],
  [
    'rejection',
    async () => {
      throw new Error('mock failed');
    },
  ],
  ['invalid data', () => 'not bytes'],
]) {
  test(`fails the resource rather than falling back on ${name}`, async () => {
    const page = await createRuntime().open({ target, onFetchResource: callback });
    const response = await handlers.get('https')(request(page.getLynxWindow().id));
    assert.equal(response.statusCode, -1);
    assert.equal(response.data.length, 0);
    assert.match(response.errorMessage, /mock failed|must return Uint8Array/);
  });
}

test('consumes native error event arguments and releases failed windows', async () => {
  const runtime = createRuntime();
  const events = [];
  runtime.addWindowEventListener((event) => events.push(event));
  const page = await runtime.open({ target, onFetchResource: () => Buffer.from('data') });
  const native = page.getLynxWindow();
  native.emit('receive-lynx-window-error', {}, '--lynx-error', 123, 'template failed');
  assert.equal(page.getInfo().status, 'failed');
  assert.deepEqual(page.getInfo().error, {
    module: 'runtime',
    code: SimulatorErrorCodes.RuntimeLoadFailed,
    message: 'template failed',
    details: { errorType: '--lynx-error', lynxCode: '123' },
  });
  assert.equal(events.at(-1).type, 'failed');
  assert.equal(handlers.size, 0);
  native.emit('ready-to-show', {});
  assert.equal(page.getInfo().status, 'failed');
  const next = await runtime.open({ target, onFetchResource: () => Buffer.from('next') });
  await page.close();
  assert.equal(handlers.size, 3, 'closing a failed window must not unregister the next window');
  assert.equal(
    (await handlers.get('https')(request(next.getLynxWindow().id))).data.toString(),
    'next'
  );
});

for (const end of ['close', 'fail']) {
  test(`discards an in-flight response after ${end}`, async () => {
    const pending = Promise.withResolvers();
    const page = await createRuntime().open({ target, onFetchResource: () => pending.promise });
    const native = page.getLynxWindow();
    const response = handlers.get('https')(request(native.id));
    if (end === 'close') await page.close();
    else native.emit('receive-lynx-window-error', {}, '--lynx-error', 1, 'failed');
    pending.resolve(Buffer.from('late'));
    assert.equal((await response).statusCode, -1);
    assert.equal(handlers.size, 0);
  });
}

test('keeps local paths and file URLs on loadFile and cleans synchronous load failure', async () => {
  const runtime = createRuntime();
  const file = new URL('./fixtures/lynxtron.mjs', import.meta.url);
  for (const target of [file.href, fileURLToPath(file)]) {
    const page = await runtime.open({ target, onFetchResource: () => undefined });
    assert.deepEqual(page.getLynxWindow().loads, [{ kind: 'file', target: fileURLToPath(file) }]);
    await page.close();
  }
  const missing = new URL('./fixtures/missing-main.lynx.bundle', import.meta.url);
  const failed = await runtime.open({ target: missing.href, onFetchResource: () => undefined });
  assert.equal(failed.getInfo().status, 'failed');
  assert.equal(failed.getInfo().error.code, SimulatorErrorCodes.RuntimeLoadFileNotFound);
  assert.equal(handlers.size, 0);
});
