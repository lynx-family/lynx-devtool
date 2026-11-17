// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  toSimulatorErrorInfo,
  type CommandParser,
  type PageEnvironmentManager,
  type ParsedCommandContext,
  type SimulatorRuntime,
} from '@lynx-js/lynx-simulator-core';

import { getAppWindowBackgroundColor } from '../application/theme';
import { ActionTriggers } from '../support/actionTriggers';
import { getOpenDeviceScaleFactor, resolveOpenSize } from '../support/openOptions';
import type { InstanceRequest, InstanceResponse } from '../../../shared/instanceProtocol';

export interface CreateInstanceRequestHandlerOptions {
  parser: CommandParser;
  runtime: SimulatorRuntime;
  pageEnvironment: PageEnvironmentManager;
  instanceId: string;
  openDevToolSettingsWindow(): Promise<InstanceResponse>;
  focusApplication?: () => void;
  shutdownApplication(): Promise<void>;
  writeLog(event: string, payload?: Record<string, unknown>): void;
}

export function createInstanceRequestHandler(
  options: CreateInstanceRequestHandlerOptions
): (request: InstanceRequest) => Promise<InstanceResponse> {
  return async (request) => {
    return handleInstanceRequest(options, request);
  };
}

async function handleInstanceRequest(
  options: CreateInstanceRequestHandlerOptions,
  request: InstanceRequest
): Promise<InstanceResponse> {
  if (request.command === 'ping') {
    return {
      ok: true,
      instanceId: options.instanceId,
    };
  }

  let response: InstanceResponse;
  if (request.instanceId !== options.instanceId) {
    response = {
      ok: false,
      code: 'INSTANCE_MISMATCH',
      message: `Instance mismatch: ${String(request.instanceId)}`,
      instanceId: options.instanceId,
    };
  } else {
    options.writeLog('command', {
      trigger: ActionTriggers.InstanceCommand,
      command: request.command,
      rawArgv: request.rawArgv,
    });
    response = await handleParsedInstanceRequest(options, request);
  }

  options.writeLog('command-result', {
    trigger: ActionTriggers.InstanceCommand,
    result: response,
  });
  return response;
}

async function handleParsedInstanceRequest(
  options: CreateInstanceRequestHandlerOptions,
  request: InstanceRequest
): Promise<InstanceResponse> {
  try {
    const parsed = options.parser.parse(request.rawArgv ?? [request.command]);
    switch (parsed.command) {
      case 'open':
        return await openFromInstanceRequest(options, parsed);
      case 'devtool-settings':
        return await options.openDevToolSettingsWindow();
      case 'connect-devtool':
        await options.runtime.devTool.connectDevTool(parsed.args.url as string);
        return {
          ok: true,
          instanceId: options.instanceId,
        };
      case 'status': {
        const windowId =
          typeof parsed.options.window === 'string' ? parsed.options.window : undefined;
        return getStatusResponse(options, windowId);
      }
      case 'focus':
        return await focusWindowFromRequest(options, parsed.options.window as string);
      case 'close':
        return await closeWindowFromRequest(options, parsed.options.window as string);
      case 'quit':
        // Defer shutdown so the IPC response can be written before the server
        // starts closing.
        setTimeout(() => {
          void options.shutdownApplication().catch((error) => {
            console.warn(`[lynx-simulator] Failed to quit: ${String(error)}`);
          });
        }, 0);
        return {
          ok: true,
          instanceId: options.instanceId,
        };
      default:
        return {
          ok: false,
          code: 'COMMAND_UNSUPPORTED',
          message: `Cannot handle command: ${parsed.command}.`,
          instanceId: options.instanceId,
        };
    }
  } catch (error) {
    const errorInfo = toSimulatorErrorInfo(error);
    return {
      ok: false,
      code: errorInfo.code,
      message: errorInfo.message,
      instanceId: options.instanceId,
    };
  }
}

async function openFromInstanceRequest(
  options: CreateInstanceRequestHandlerOptions,
  parsed: ParsedCommandContext
): Promise<InstanceResponse> {
  if (typeof parsed.options.window === 'string') {
    return {
      ok: false,
      code: 'WINDOW_REUSE_UNSUPPORTED',
      message: 'open --window is reserved but not implemented yet.',
      instanceId: options.instanceId,
      windowId: parsed.options.window,
    };
  }

  if (typeof parsed.options['connect-devtool'] === 'string') {
    await options.runtime.devTool.connectDevTool(parsed.options['connect-devtool']);
  }
  const sizeResult = resolveOpenSize(parsed.options, options.runtime);
  if (sizeResult.error) {
    return {
      ok: false,
      message: sizeResult.error,
      instanceId: options.instanceId,
    };
  }

  const source = parsed.options['page-env'];
  const ref = await options.pageEnvironment.open({
    target: parsed.args.target as string,
    cwd: process.cwd(),
    pageEnvironment: typeof source === 'string' ? source || undefined : undefined,
    window: {
      size: sizeResult.size,
      backgroundColor: getAppWindowBackgroundColor(),
      windowless: parsed.options.windowless === true,
      deviceScaleFactor: getOpenDeviceScaleFactor(parsed.options, options.runtime),
    },
  });
  const error = ref.getInfo()?.error;
  if (error) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      instanceId: options.instanceId,
    };
  }

  return {
    ok: true,
    windowType: 'page',
    instanceId: options.instanceId,
    windowId: ref.id,
  };
}

function getStatusResponse(
  options: CreateInstanceRequestHandlerOptions,
  windowId?: string
): InstanceResponse {
  if (windowId) {
    const window = options.runtime.getWindow(windowId)?.getInfo();
    if (!window) {
      return windowNotFound(options.instanceId, windowId);
    }
    return {
      ok: true,
      instanceId: options.instanceId,
      window,
    };
  }

  return {
    ok: true,
    instanceId: options.instanceId,
    pid: process.pid,
    windows: options.runtime.listWindows(),
  };
}

async function focusWindowFromRequest(
  options: CreateInstanceRequestHandlerOptions,
  windowId: string
): Promise<InstanceResponse> {
  const window = options.runtime.getWindow(windowId);
  if (!window) {
    return windowNotFound(options.instanceId, windowId);
  }
  options.focusApplication?.();
  const waitFocused = waitForWindowFocused(options, windowId);
  await window.focus();
  await waitFocused;
  return {
    ok: true,
    instanceId: options.instanceId,
    window: window.getInfo(),
  };
}

async function waitForWindowFocused(
  options: CreateInstanceRequestHandlerOptions,
  windowId: string,
  timeoutMs = 300
): Promise<void> {
  if (options.runtime.getWindow(windowId)?.getInfo()?.focused) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    let removeListener = () => {};

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      removeListener();
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);
    removeListener = options.runtime.addWindowEventListener((event) => {
      if (event.type === 'focused' && event.window.id === windowId) {
        finish();
      }
    });
  });
}

async function closeWindowFromRequest(
  options: CreateInstanceRequestHandlerOptions,
  windowId: string
): Promise<InstanceResponse> {
  const window = options.runtime.getWindow(windowId);
  if (!window) {
    return windowNotFound(options.instanceId, windowId);
  }
  await window.close();
  return {
    ok: true,
    instanceId: options.instanceId,
    windowId,
  };
}

function windowNotFound(instanceId: string, windowId: string): InstanceResponse {
  return {
    ok: false,
    code: 'WINDOW_NOT_FOUND',
    message: `Window not found: ${windowId}`,
    instanceId,
    windowId,
  };
}
