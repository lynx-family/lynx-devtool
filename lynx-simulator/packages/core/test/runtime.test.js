import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSimulatorRuntime,
  SimulatorErrorCodes,
  toSimulatorErrorInfo,
} from '../dist/index.js';

test('exposes runtime APIs', () => {
  assert.equal(typeof createSimulatorRuntime, 'function');
  const runtime = createSimulatorRuntime();
  assert.equal(typeof runtime.open, 'function');
  assert.equal(typeof runtime.devTool.setDevToolEnabled, 'function');
  assert.equal(typeof runtime.devTool.setOpenCardCallback, 'function');
});

test('registers native extensions once', async () => {
  const runtime = createSimulatorRuntime();
  let setupCount = 0;
  const extension = {
    setUp() {
      setupCount += 1;
    },
  };

  await runtime.registerNativeExtension(extension);
  await runtime.registerNativeExtension(extension);

  assert.equal(setupCount, 1);
});

test('registers async native extensions once', async () => {
  const runtime = createSimulatorRuntime();
  let setupCount = 0;
  const extension = {
    async setUp() {
      setupCount += 1;
    },
  };

  await runtime.registerNativeExtension(extension);
  await runtime.registerNativeExtension(extension);

  assert.equal(setupCount, 1);
});

test('validates runtime registrations', async () => {
  const runtime = createSimulatorRuntime();

  assert.equal(
    toSimulatorErrorInfo(
      catchError(() => runtime.registerDevice({ name: '', size: { width: 1, height: 1 } }))
    ).code,
    SimulatorErrorCodes.RuntimeInvalidDevice
  );
  assert.equal(
    toSimulatorErrorInfo(
      catchError(() => runtime.registerJSBHandler({ name: '', handler: () => undefined }))
    ).code,
    SimulatorErrorCodes.RuntimeInvalidJSB
  );
  assert.equal(
    toSimulatorErrorInfo(
      catchError(() => runtime.registerJSBHandler({ name: 'x.test', handler: undefined }))
    ).code,
    SimulatorErrorCodes.RuntimeInvalidJSB
  );
  await assert.rejects(
    () => runtime.registerNativeExtension({}),
    (error) => {
      assert.equal(toSimulatorErrorInfo(error).code, SimulatorErrorCodes.RuntimeInvalidExtension);
      return true;
    }
  );
});

test('registers JSB handlers in batches', () => {
  const runtime = createSimulatorRuntime();

  runtime.registerJSBHandlers([
    { name: 'x.first', handler: () => 'first' },
    { name: 'x.second', handler: () => 'second' },
  ]);
});

function catchError(action) {
  try {
    action();
  } catch (error) {
    return error;
  }
  assert.fail('Expected action to throw.');
}

test('validates open target before loading Lynxtron', async () => {
  const runtime = createSimulatorRuntime();

  await assert.rejects(
    () => runtime.open({ target: '' }),
    (error) => {
      assert.equal(toSimulatorErrorInfo(error).code, SimulatorErrorCodes.RuntimeInvalidTarget);
      return true;
    }
  );
  await assert.rejects(
    () => runtime.open({ target: 'ftp://example.com/main.js' }),
    (error) => {
      assert.equal(toSimulatorErrorInfo(error).code, SimulatorErrorCodes.RuntimeInvalidTarget);
      return true;
    }
  );
  await assert.rejects(
    () => runtime.open({ target: 'sslocal://other/replay' }),
    (error) => {
      assert.equal(toSimulatorErrorInfo(error).code, SimulatorErrorCodes.RuntimeInvalidTarget);
      return true;
    }
  );
  await assert.rejects(
    () => runtime.open({ target: 'file://xx.js' }),
    (error) => {
      assert.equal(toSimulatorErrorInfo(error).code, SimulatorErrorCodes.RuntimeInvalidTarget);
      return true;
    }
  );
});

test('accepts Lynx Recorder replay targets', async () => {
  const runtime = createSimulatorRuntime();

  // The target is accepted, so opening fails later when Lynxtron is not the
  // current host process, not with an invalid-target error.
  await assert.rejects(
    () => runtime.open({ target: 'sslocal://arkview?url=https://example.com/record.json' }),
    (error) => {
      assert.notEqual(toSimulatorErrorInfo(error).code, SimulatorErrorCodes.RuntimeInvalidTarget);
      return true;
    }
  );
});

test('validates device scale factor before loading Lynxtron', async () => {
  const runtime = createSimulatorRuntime();

  for (const deviceScaleFactor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      () =>
        runtime.open({
          target: 'https://example.com/main.js',
          window: { deviceScaleFactor },
        }),
      (error) => {
        assert.equal(
          toSimulatorErrorInfo(error).code,
          SimulatorErrorCodes.RuntimeInvalidDeviceScaleFactor
        );
        return true;
      }
    );
  }
});

test('validates DevTool arguments', async () => {
  const runtime = createSimulatorRuntime();

  for (const action of [
    () => runtime.devTool.setDevToolEnabled('true'),
    () => runtime.devTool.setLogBoxEnabled(1),
    () => runtime.devTool.setOpenCardCallback(undefined),
    () => runtime.devTool.connectDevTool(' '),
  ]) {
    await assert.rejects(action, (error) => {
      assert.equal(
        toSimulatorErrorInfo(error).code,
        SimulatorErrorCodes.RuntimeInvalidDevToolArgument
      );
      return true;
    });
  }
});
