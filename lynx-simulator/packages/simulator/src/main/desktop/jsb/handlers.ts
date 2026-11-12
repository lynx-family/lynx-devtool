// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SimulatorRuntime } from '@lynx-js/lynx-simulator-core';
import { getAppWindowBackgroundColor } from '../application/theme';
import { getOpenPageTarget, resolveOpenSize } from '../support/openOptions';

const OPEN_PAGE_JSB = 'openPage';
const CONNECT_DEVTOOL_JSB = 'connectDevTool';
const JSB_FAILED_EVENT = 'jsb-failed';
const JSB_SUCCESS_EVENT = 'jsb-success';

export function registerApplicationJSBHandlers(options: {
  runtime: SimulatorRuntime;
  cwd: string;
  writeLog?: (event: string, payload?: Record<string, unknown>) => void;
}): void {
  registerOpenPageJSB(options);
  registerConnectDevToolJSB(options);
}

function registerConnectDevToolJSB(options: {
  runtime: SimulatorRuntime;
  writeLog?: (event: string, payload?: Record<string, unknown>) => void;
}): void {
  options.runtime.registerJSBHandler({
    name: CONNECT_DEVTOOL_JSB,
    handler: async (data) => {
      const url =
        typeof data === 'object' && data !== null && 'url' in data && typeof data.url === 'string'
          ? data.url.trim()
          : '';
      if (!url) {
        const message = 'connectDevTool requires a URL.';
        options.writeLog?.(JSB_FAILED_EVENT, {
          name: CONNECT_DEVTOOL_JSB,
          message,
        });
        return { ok: false, message };
      }

      try {
        await options.runtime.devTool.connectDevTool(url);
        options.writeLog?.(JSB_SUCCESS_EVENT, {
          name: CONNECT_DEVTOOL_JSB,
          url,
        });
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.writeLog?.(JSB_FAILED_EVENT, {
          name: CONNECT_DEVTOOL_JSB,
          url,
          message,
        });
        return { ok: false, message };
      }
    },
  });
}

function registerOpenPageJSB(options: {
  runtime: SimulatorRuntime;
  cwd: string;
  writeLog?: (event: string, payload?: Record<string, unknown>) => void;
}): void {
  options.runtime.registerJSBHandler({
    name: OPEN_PAGE_JSB,
    handler: async (data) => {
      const target = getOpenPageTarget(data);
      if (!target) {
        const message = 'openPage requires a target.';
        options.writeLog?.(JSB_FAILED_EVENT, {
          name: OPEN_PAGE_JSB,
          message,
        });
        return {
          ok: false,
          message,
        };
      }
      const sizeResult = resolveOpenSize(data, options.runtime);
      if (sizeResult.error) {
        options.writeLog?.(JSB_FAILED_EVENT, {
          name: OPEN_PAGE_JSB,
          target,
          message: sizeResult.error,
        });
        return {
          ok: false,
          message: sizeResult.error,
        };
      }

      const ref = await options.runtime.open({
        target,
        cwd: options.cwd,
        window: {
          ...(sizeResult.size !== undefined ? { size: sizeResult.size } : {}),
          backgroundColor: getAppWindowBackgroundColor(),
        },
      });
      const error = ref.getInfo()?.error;
      if (error) {
        options.writeLog?.(JSB_FAILED_EVENT, {
          name: OPEN_PAGE_JSB,
          target,
          windowId: ref.id,
          code: error.code,
          message: error.message,
          details: error.details,
        });
        return {
          ok: false,
          message: `[${error.code}] ${error.message}`,
        };
      }
      options.writeLog?.(JSB_SUCCESS_EVENT, {
        name: OPEN_PAGE_JSB,
        target,
        windowId: ref.id,
        size: ref.getInfo()?.size,
      });
      return { ok: true };
    },
  });
}
