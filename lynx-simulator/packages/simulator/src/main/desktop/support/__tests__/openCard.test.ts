// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { OpenCardCallback, SimulatorRuntime } from '@lynx-js/lynx-simulator-core';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { registerOpenCardHandler } from '../openCard';

describe('OpenCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('opens a visible window with the default size', async () => {
    const callbackHolder: { callback?: OpenCardCallback } = {};
    const open = vi.fn().mockResolvedValue({
      id: 'win_123',
      getInfo: () => ({ status: 'ready' }),
    });
    const writeLog = vi.fn();
    const runtime = createRuntimeMock(open, (handler) => {
      callbackHolder.callback = handler ?? undefined;
    });

    await registerOpenCardHandler({
      runtime,
      getBackgroundColor: () => '#ffffff',
      writeLog,
    });
    callbackHolder.callback?.('https://example.com/card.js');

    await vi.waitFor(() => {
      expect(open).toHaveBeenCalledWith({
        target: 'https://example.com/card.js',
        cwd: process.cwd(),
        window: {
          backgroundColor: '#ffffff',
        },
      });
      expect(writeLog).toHaveBeenLastCalledWith('open-card-opened', {
        url: 'https://example.com/card.js',
        windowId: 'win_123',
      });
    });
  });

  test('records asynchronous open failures', async () => {
    const callbackHolder: { callback?: OpenCardCallback } = {};
    const open = vi.fn().mockRejectedValue(new Error('open failed'));
    const writeLog = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const runtime = createRuntimeMock(open, (handler) => {
      callbackHolder.callback = handler ?? undefined;
    });

    await registerOpenCardHandler({
      runtime,
      getBackgroundColor: () => '#ffffff',
      writeLog,
    });
    callbackHolder.callback?.('https://example.com/card.js');

    await vi.waitFor(() => {
      expect(writeLog).toHaveBeenLastCalledWith(
        'open-card-failed',
        expect.objectContaining({
          url: 'https://example.com/card.js',
          message: 'open failed',
        })
      );
    });
  });

  test('preserves errors returned by the opened window', async () => {
    const callbackHolder: { callback?: OpenCardCallback } = {};
    const open = vi.fn().mockResolvedValue({
      id: 'win_123',
      getInfo: () => ({
        status: 'error',
        error: {
          code: 'RUNTIME_LOAD_FAILED',
          message: 'load failed',
          details: { target: 'https://example.com/card.js' },
        },
      }),
    });
    const writeLog = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const runtime = createRuntimeMock(open, (handler) => {
      callbackHolder.callback = handler ?? undefined;
    });

    await registerOpenCardHandler({
      runtime,
      getBackgroundColor: () => '#ffffff',
      writeLog,
    });
    callbackHolder.callback?.('https://example.com/card.js');

    await vi.waitFor(() => {
      expect(writeLog).toHaveBeenLastCalledWith('open-card-failed', {
        url: 'https://example.com/card.js',
        code: 'RUNTIME_LOAD_FAILED',
        message: 'load failed',
        details: { target: 'https://example.com/card.js' },
      });
    });
  });
});

function createRuntimeMock(
  open: ReturnType<typeof vi.fn>,
  setCallback: (callback: OpenCardCallback | null) => void
): SimulatorRuntime {
  return {
    open,
    devTool: {
      setOpenCardCallback: async (callback: OpenCardCallback | null) => {
        setCallback(callback);
      },
    },
  } as unknown as SimulatorRuntime;
}
