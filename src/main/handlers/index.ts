// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import BaseHandler from '@/main/base/BaseHandler';
import { ipcMain } from 'electron';
import RestartLDTHandler from './RestartLDTHandler';
import SwitchPageModeHandler from './SwitchPageModeHandler';
import SwitchViewModeHandler from './SwitchViewModeHandler';
import ReconnectDriverHandler from './ReconnectDriverHandler';
import ServerHandler from './ServerHandler';

const handlers: (new () => BaseHandler)[] = [
  RestartLDTHandler,
  SwitchPageModeHandler,
  SwitchViewModeHandler,
  ReconnectDriverHandler,
  ServerHandler
];

function response(code: number, data?: any, msg?: string) {
  return { code, msg, data };
}

function succeed(data: any) {
  return response(0, data);
}

function error(e: Error) {
  return response(-1, undefined, e.message);
}

export function initHandlers() {
  handlers.forEach((item) => {
    const handler = new item();
    ipcMain.handle(handler.getName(), async (_, params) => {
      try {
        const result = await handler.handle(params);
        return succeed(result);
      } catch (e) {
        return error(e);
      }
    });
  });
}
