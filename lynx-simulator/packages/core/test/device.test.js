import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSimulatorRuntime,
  formatDevices,
  SimulatorErrorCodes,
  toSimulatorErrorInfo,
} from '../dist/index.js';

test('lists built-in devices and formats them', () => {
  const runtime = createSimulatorRuntime();
  const devices = runtime.listDevices();

  assert.ok(devices.some((device) => device.name === 'iphone-15'));
  assert.ok(devices.some((device) => device.platform === 'android'));
  assert.equal(runtime.getDevice('iPhone_15')?.name, 'iphone-15');
  assert.equal(runtime.getDevice('iphone-15')?.devicePixelRatio, 3);
  assert.match(formatDevices(devices), /Name\s+Size\s+DPR\s+Platform\s+Label/);
  assert.match(formatDevices(devices), /iphone-15/);
  assert.match(formatDevices(devices), /pixel-7/);
  assert.match(formatDevices(devices), /DPR only affects windowless rendering/);
});

test('normalizes, clones, and overwrites registered devices', () => {
  const runtime = createSimulatorRuntime();
  const first = runtime.registerDevice({
    name: 'My Phone',
    label: 'My Phone',
    platform: 'android',
    size: { width: 401, height: 802 },
    devicePixelRatio: 2.5,
  });

  assert.equal(first.device.name, 'my-phone');
  assert.equal(first.overwritten, undefined);

  first.device.size.width = 1;
  assert.equal(runtime.getDevice('my phone')?.size.width, 401);
  assert.equal(runtime.getDevice('my phone')?.devicePixelRatio, 2.5);

  const second = runtime.registerDevice({
    name: 'my_phone',
    label: 'My Phone 2',
    platform: 'android',
    size: { width: 402, height: 804 },
  });
  assert.equal(second.device.name, 'my-phone');
  assert.equal(second.overwritten?.size.width, 401);
  assert.equal(runtime.getDevice('MY PHONE')?.size.width, 402);

  const overwrittenBuiltin = runtime.registerDevice({
    name: 'iPhone 15',
    label: 'Custom iPhone 15',
    size: { width: 400, height: 860 },
  });
  assert.equal(overwrittenBuiltin.device.name, 'iphone-15');
  assert.equal(overwrittenBuiltin.overwritten?.name, 'iphone-15');
});

test('registers devices in batches', () => {
  const runtime = createSimulatorRuntime();
  const results = runtime.registerDevices([
    {
      name: 'Small Phone',
      size: { width: 320, height: 568 },
    },
    {
      name: 'Large Phone',
      size: { width: 430, height: 932 },
    },
  ]);

  assert.deepEqual(
    results.map((result) => result.device.name),
    ['small-phone', 'large-phone']
  );
  assert.equal(runtime.getDevice('small phone')?.size.width, 320);
  assert.equal(runtime.getDevice('large_phone')?.size.height, 932);
});

test('returns cloned device snapshots', () => {
  const runtime = createSimulatorRuntime();
  const listedDevice = runtime.listDevices().find((device) => device.name === 'iphone-15');
  assert.ok(listedDevice);

  listedDevice.size.width = 1;
  assert.notEqual(runtime.getDevice('iphone-15')?.size.width, 1);

  const device = runtime.getDevice('iphone-15');
  assert.ok(device);
  device.size.width = 2;
  assert.notEqual(runtime.getDevice('iphone-15')?.size.width, 2);
});

test('validates registered devices', () => {
  const runtime = createSimulatorRuntime();

  assert.equal(
    toSimulatorErrorInfo(
      catchError(() => runtime.registerDevice({ name: '', size: { width: 1, height: 1 } }))
    ).code,
    SimulatorErrorCodes.RuntimeInvalidDevice
  );
  assert.deepEqual(
    toSimulatorErrorInfo(
      catchError(() =>
        runtime.registerDevice({ name: 'Bad Device', size: { width: 0, height: 1 } })
      )
    ),
    {
      module: 'runtime',
      code: SimulatorErrorCodes.RuntimeInvalidSize,
      message: 'registerDevice requires a positive width and height.',
      details: {
        size: { width: 0, height: 1 },
      },
    }
  );
  assert.equal(
    toSimulatorErrorInfo(
      catchError(() =>
        runtime.registerDevice({
          name: 'Bad DPR',
          size: { width: 1, height: 1 },
          devicePixelRatio: 0,
        })
      )
    ).code,
    SimulatorErrorCodes.RuntimeInvalidDevice
  );
});

test('formats custom devices and empty device lists', () => {
  assert.equal(
    formatDevices([]),
    [
      'Name  Size  DPR  Platform  Label',
      '',
      'DPR only affects windowless rendering. Windowed rendering uses the host display scale.',
    ].join('\n')
  );

  assert.match(
    formatDevices([
      {
        name: 'custom-phone',
        label: 'Custom Phone',
        platform: 'android',
        size: { width: 360, height: 780 },
      },
    ]),
    /custom-phone\s+360x780\s+android\s+Custom Phone/
  );
});

function catchError(action) {
  try {
    action();
  } catch (error) {
    return error;
  }
  assert.fail('Expected action to throw.');
}
