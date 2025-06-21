// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BrowserWindow } from 'electron/main';
import { ViewMode } from '@lynx-js/devtool-plugin-core/dist/types/main';

export abstract class BaseHandler {
  abstract getName(): string;
  abstract handle(params?: any): Promise<any>;
}

export enum PageMode {
  MOBILE = 0,
  SIMULATOR = 1,
  SIMULATOR_LYNX = 2
}

export interface IPageParams {
  ldtUrl: string; // lynx-devtool-web address
  schema?: URL; // deep-link
  pageMode?: PageMode; // Real machine or simulator
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
