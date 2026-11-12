// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  JSBHandler,
  JSBHandlerContext,
  JSBHandlerRegistration,
  SimulatorRuntime,
} from '@lynx-js/lynx-simulator-core';
import { describe, expect, test, vi } from 'vitest';

import { registerApplicationJSBHandlers } from '../handlers';

describe('application JSB handlers', () => {
  test('opens a page and records the opened window', async () => {
    const { getHandler, open, writeLog } = createHandlerFixture();
    open.mockResolvedValue({
      id: 'win_123',
      getInfo: () => ({
        status: 'ready',
        size: { width: 390, height: 844 },
      }),
    });

    await expect(
      getHandler('openPage')(
        {
          target: 'https://example.com/main.lynx.bundle',
          size: { width: 390, height: 844 },
        },
        {} as JSBHandlerContext
      )
    ).resolves.toEqual({ ok: true });
    expect(open).toHaveBeenCalledWith({
      target: 'https://example.com/main.lynx.bundle',
      cwd: '/workspace',
      window: {
        size: { width: 390, height: 844 },
        backgroundColor: expect.any(String),
      },
    });
    expect(writeLog).toHaveBeenCalledWith('jsb-success', {
      name: 'openPage',
      target: 'https://example.com/main.lynx.bundle',
      windowId: 'win_123',
      size: { width: 390, height: 844 },
    });
  });

  test('rejects openPage without a target', async () => {
    const { getHandler, open, writeLog } = createHandlerFixture();

    await expect(getHandler('openPage')({}, {} as JSBHandlerContext)).resolves.toEqual({
      ok: false,
      message: 'openPage requires a target.',
    });
    expect(open).not.toHaveBeenCalled();
    expect(writeLog).toHaveBeenCalledWith('jsb-failed', {
      name: 'openPage',
      message: 'openPage requires a target.',
    });
  });

  test('returns and records errors from the opened window', async () => {
    const { getHandler, open, writeLog } = createHandlerFixture();
    open.mockResolvedValue({
      id: 'win_123',
      getInfo: () => ({
        status: 'error',
        error: {
          code: 'RUNTIME_LOAD_FAILED',
          message: 'load failed',
          details: { stage: 'load' },
        },
      }),
    });

    await expect(
      getHandler('openPage')(
        { target: 'https://example.com/main.lynx.bundle' },
        {} as JSBHandlerContext
      )
    ).resolves.toEqual({
      ok: false,
      message: '[RUNTIME_LOAD_FAILED] load failed',
    });
    expect(writeLog).toHaveBeenCalledWith('jsb-failed', {
      name: 'openPage',
      target: 'https://example.com/main.lynx.bundle',
      windowId: 'win_123',
      code: 'RUNTIME_LOAD_FAILED',
      message: 'load failed',
      details: { stage: 'load' },
    });
  });

  test('connects DevTool with the provided URL', async () => {
    const { getHandler, connectDevTool, writeLog } = createHandlerFixture();

    await expect(
      getHandler('connectDevTool')({ url: '  ws://localhost:9222  ' }, {} as JSBHandlerContext)
    ).resolves.toEqual({
      ok: true,
    });
    expect(connectDevTool).toHaveBeenCalledWith('ws://localhost:9222');
    expect(writeLog).toHaveBeenCalledWith('jsb-success', {
      name: 'connectDevTool',
      url: 'ws://localhost:9222',
    });
  });

  test('rejects an empty DevTool URL', async () => {
    const { getHandler, connectDevTool, writeLog } = createHandlerFixture();

    await expect(
      getHandler('connectDevTool')({ url: '   ' }, {} as JSBHandlerContext)
    ).resolves.toEqual({
      ok: false,
      message: 'connectDevTool requires a URL.',
    });
    expect(connectDevTool).not.toHaveBeenCalled();
    expect(writeLog).toHaveBeenCalledWith('jsb-failed', {
      name: 'connectDevTool',
      message: 'connectDevTool requires a URL.',
    });
  });

  test('returns and records DevTool connection failures', async () => {
    const { getHandler, connectDevTool, writeLog } = createHandlerFixture();
    connectDevTool.mockRejectedValue(new Error('connection failed'));

    await expect(
      getHandler('connectDevTool')({ url: 'ws://localhost:9222' }, {} as JSBHandlerContext)
    ).resolves.toEqual({
      ok: false,
      message: 'connection failed',
    });
    expect(writeLog).toHaveBeenCalledWith('jsb-failed', {
      name: 'connectDevTool',
      url: 'ws://localhost:9222',
      message: 'connection failed',
    });
  });
});

function createHandlerFixture(): {
  getHandler: (name: string) => JSBHandler;
  open: ReturnType<typeof vi.fn>;
  connectDevTool: ReturnType<typeof vi.fn>;
  writeLog: ReturnType<typeof vi.fn>;
} {
  const registrations: JSBHandlerRegistration[] = [];
  const open = vi.fn();
  const connectDevTool = vi.fn().mockResolvedValue(undefined);
  const writeLog = vi.fn();
  const runtime = {
    registerJSBHandler(registration: JSBHandlerRegistration) {
      registrations.push(registration);
    },
    open,
    devTool: {
      connectDevTool,
    },
  } as unknown as SimulatorRuntime;

  registerApplicationJSBHandlers({
    runtime,
    cwd: '/workspace',
    writeLog,
  });

  return {
    getHandler(name) {
      const registration = registrations.find((item) => item.name === name);
      if (!registration) {
        throw new Error(`Expected ${name} JSB handler to be registered.`);
      }
      return registration.handler;
    },
    open,
    connectDevTool,
    writeLog,
  };
}
