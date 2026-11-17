// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SimulatorDevTool, SimulatorRuntime } from '@lynx-js/lynx-simulator-core';
import { describe, expect, test, vi } from 'vitest';

import { createSimulatorCommandParser } from '../../../../shared/commands';
import { createInstanceRequestHandler } from '../handlers';

describe('instance command handler', () => {
  test('connects an existing instance to a remote DevTool', async () => {
    const calls: string[] = [];
    const runtime = createRuntimeMock(calls);
    const handleRequest = createInstanceRequestHandler({
      parser: createSimulatorCommandParser(),
      runtime,
      pageEnvironment: { open: vi.fn(), dispose: vi.fn() },
      instanceId: 'sim_123',
      openDevToolSettingsWindow: vi.fn(),
      shutdownApplication: vi.fn(),
      writeLog: vi.fn(),
    });

    await expect(
      handleRequest({
        command: 'connect-devtool',
        instanceId: 'sim_123',
        rawArgv: ['connect-devtool', 'ws://localhost:9222', '--instance', 'sim_123'],
      })
    ).resolves.toEqual({
      ok: true,
      instanceId: 'sim_123',
    });
    expect(calls).toEqual(['connectDevTool:ws://localhost:9222']);
  });
});

function createRuntimeMock(calls: string[]): SimulatorRuntime {
  const devTool: SimulatorDevTool = {
    async setDevToolEnabled(enabled) {
      calls.push(`setDevToolEnabled:${String(enabled)}`);
    },
    async isDevToolEnabled() {
      calls.push('isDevToolEnabled');
      return true;
    },
    async setLogBoxEnabled(enabled) {
      calls.push(`setLogBoxEnabled:${String(enabled)}`);
    },
    async isLogBoxEnabled() {
      calls.push('isLogBoxEnabled');
      return false;
    },
    async setOpenCardCallback() {},
    async connectDevTool(url) {
      calls.push(`connectDevTool:${url}`);
    },
  };
  return {
    devTool,
  } as unknown as SimulatorRuntime;
}
