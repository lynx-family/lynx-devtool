// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import 'background-only';
import type { JSBResult } from '../shared/types';

export const OPEN_PAGE_JSB = 'openPage';
export const CONNECT_DEVTOOL_JSB = 'connectDevTool';

export type OpenPagePayload = {
  target: string;
  device?: string;
  size?: {
    width: number;
    height: number;
  };
};

export type ConnectDevToolPayload = {
  url: string;
};

export function openPage(payload: OpenPagePayload, callback: (result: JSBResult) => void): void {
  'background only';
  NativeModules.bridge.call(OPEN_PAGE_JSB, payload, (result) => {
    callback(result as JSBResult);
  });
}

export function connectDevTool(
  payload: ConnectDevToolPayload,
  callback: (result: JSBResult) => void
): void {
  'background only';
  NativeModules.bridge.call(CONNECT_DEVTOOL_JSB, payload, (result) => {
    callback(result as JSBResult);
  });
}
