// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { IDebugDriver } from './debug-driver';
import { PluginEnvLog, PluginTrackEvent } from './logger';
import { IConnectionStore } from './store';

export type * from './debug-driver';
export type * from './device';
export * from './logger';
export { EDebugDriverClientEventNames } from './debug-driver';

type AsyncBridgeType = Record<string, (...args: any[]) => Promise<any> | any>;

export type PluginEvent = {
  id?: number;
  isAsync?: boolean;
  timeout?: number;
  pluginId?: string;
  eventName: string;
  params: any;
};

export type RendererContext<T extends AsyncBridgeType = AsyncBridgeType> = {
  asyncBridge: T;
  appPath: string;
  plugin: { id: string };
  debugDriver: IDebugDriver;
  logger: {
    sendEvent: (event: PluginTrackEvent) => void;
    sendEnvLog: (log: PluginEnvLog) => void;
  };
  // TODO: types
  ldt: any;
  useConnection: () => IConnectionStore;
  getStore: any;
  switchView: (options: { pluginId: string }) => void;
  publishPluginEvent: (event: PluginEvent) => void;
  addPluginEventListener: (eventName: string, listener: (event: PluginEvent) => Promise<any> | any) => void;
  removePluginEventListener: (eventName: string, listener: (event: PluginEvent) => Promise<any> | any) => void;
};

export type RendererPlugin<T extends AsyncBridgeType = AsyncBridgeType> = (context: RendererContext<T>) => any;

export const definePlugin = <T extends AsyncBridgeType = AsyncBridgeType>(
  config: RendererPlugin<T>
): RendererPlugin<T> => config;

export const definePluginEntry = <T extends AsyncBridgeType = AsyncBridgeType>(
  config: RendererPlugin<T>
): RendererPlugin<T> => config;
