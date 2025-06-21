// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BrowserWindow } from 'electron';

export abstract class BaseHandler {
  abstract getName(): string;
  abstract handle(params?: any): Promise<any>;
}

export enum PageMode {
  MOBILE = 0,
  SIMULATOR = 1,
  SIMULATOR_LYNX = 2
}

export enum ViewMode {
  LYNX = 'lynx',
  WEB = 'web'
}

export interface IPageParams {
  ldtUrl: string; // ldt-pc address
  schema?: URL; // deep-link
  pageMode?: PageMode; // real device or simulator
  viewMode?: ViewMode; // lynx or web
  forceRefresh?: boolean;
}

export interface IDebuggerOptions {
  [key: string]: any;
  win?: BrowserWindow;
  target?: any;
  pageParams: IPageParams;
  containerId?: string;
}

export interface IBaseDebugger {
  start: (options: IDebuggerOptions) => void;
  stop: () => void;
  isStarted: () => boolean;
  getMessageHandler: (name: string) => BaseHandler[];
  getTarget: () => any;
  getContainerId: () => string | undefined;
  getScheme: () => string | undefined;
  getAppInfo: () => any;
  addMessageHandler: (handler: BaseHandler) => void;
  removeMessageHandler: (handler: BaseHandler) => void;
  removeMessageHandlers: (handlerName: string) => void;
  removeAllMessageHandlers: () => void;
  handleMessage: (type: string, data: any) => void;
  callContainerMethod: (method: string, ...params: any) => void;
  sendMessage: (type: string, data: any) => void;
}
