// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SimulatorRuntime } from '@lynx-js/lynx-simulator-core';
import { describe, expect, test } from 'vitest';

import { getOpenDeviceScaleFactor, getOpenPageTarget, resolveOpenSize } from '../openOptions';

describe('open options', () => {
  test('extracts open page target', () => {
    expect(getOpenPageTarget({ target: 'https://example.com/main.lynx.bundle' })).toBe(
      'https://example.com/main.lynx.bundle'
    );
    expect(getOpenPageTarget({ target: '' })).toBeUndefined();
    expect(getOpenPageTarget({})).toBeUndefined();
    expect(getOpenPageTarget(undefined)).toBeUndefined();
  });

  test('resolves device, size, and width height options', () => {
    const runtime = createRuntimeMock();

    expect(resolveOpenSize({ device: 'iphone-15' }, runtime)).toEqual({
      size: { width: 393, height: 852 },
    });
    expect(resolveOpenSize({ size: '390x844' }, runtime)).toEqual({
      size: { width: 390, height: 844 },
    });
    expect(resolveOpenSize({ size: { width: 375, height: 812 } }, runtime)).toEqual({
      size: { width: 375, height: 812 },
    });
    expect(resolveOpenSize({ width: 400, height: 800 }, runtime)).toEqual({
      size: { width: 400, height: 800 },
    });
    expect(resolveOpenSize({}, runtime)).toEqual({});
  });

  test('keeps open size fallback behavior explicit', () => {
    const runtime = createRuntimeMock();

    // CLI rejects conflicting size options before this helper. If a direct JSB
    // or future programmatic caller passes conflicting fields, keep the current
    // source priority stable.
    expect(resolveOpenSize({ device: 'iphone-15', size: '390x844' }, runtime)).toEqual({
      size: { width: 393, height: 852 },
    });
    // Normal CLI and home UI paths validate width/height before reaching this
    // helper. This covers the defensive fallback for direct JSB or future
    // programmatic callers that pass only one side of the size pair.
    expect(resolveOpenSize({ width: 400 }, runtime)).toEqual({
      size: { width: 400, height: undefined },
    });
    expect(resolveOpenSize({ height: 800 }, runtime)).toEqual({
      size: { width: undefined, height: 800 },
    });
  });

  test('returns user-facing errors for invalid options', () => {
    const runtime = createRuntimeMock();

    expect(resolveOpenSize(undefined, runtime)).toEqual({
      error: 'open options must be an object.',
    });
    expect(resolveOpenSize({ device: 'unknown-device' }, runtime)).toEqual({
      error: 'Unknown device: unknown-device.',
    });
    expect(resolveOpenSize({ size: 'bad-size' }, runtime).error).toContain(
      '[COMMAND_INVALID_SIZE]'
    );
  });

  test('resolves an explicit or device-provided scale factor', () => {
    const runtime = createRuntimeMock();

    expect(getOpenDeviceScaleFactor({ dpr: 2 }, runtime)).toBe(2);
    expect(getOpenDeviceScaleFactor({ device: 'iphone-15' }, runtime)).toBe(3);
    expect(getOpenDeviceScaleFactor({ device: 'iphone-15', dpr: 2 }, runtime)).toBe(2);
    expect(getOpenDeviceScaleFactor({}, runtime)).toBeUndefined();
  });
});

function createRuntimeMock(): SimulatorRuntime {
  return {
    getDevice(name: string) {
      return name === 'iphone-15'
        ? {
            name: 'iphone-15',
            label: 'iPhone 15',
            platform: 'ios',
            size: { width: 393, height: 852 },
            devicePixelRatio: 3,
          }
        : undefined;
    },
  } as SimulatorRuntime;
}
