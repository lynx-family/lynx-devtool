// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { IAppInfoManager } from './appInfo-manager';
import type { BaseHandler, IBaseDebugger, IDebuggerOptions } from './base-debugger';
import type { CustomJSBImplConfig, IBridgeManager } from './bridge-manager';
import { IDeviceInfo, IDeviceInfoManager } from './device-manager';
import { IEnvConfig, IEnvManager } from './env-manager';
import { IGlobalPropsManager } from './globalprops-manager';
import { ILDTConfig, OnChangeListener } from './ldt-config';
import { INavigateManager } from './navigate-manager';
import { IDownloadNpmPackage, IGetVersionFromPackageJson } from './package-manager';
import { IUsbManager } from './usb-manager';
import type { IUserInfo, IUserManager } from './user-manager';

export type {
  BaseHandler,
  CustomJSBImplConfig,
  IAppInfoManager,
  IBaseDebugger,
  IBridgeManager,
  IDebuggerOptions,
  IEnvConfig,
  IEnvManager,
  IGlobalPropsManager,
  INavigateManager,
  ILDTConfig,
  IUserInfo,
  IUserManager,
  IDeviceInfoManager,
  IDeviceInfo,
  OnChangeListener,
  IGetVersionFromPackageJson,
  IDownloadNpmPackage
};

export type * from './usb-manager';
export { DeviceStatus } from './usb-manager';

export enum ViewMode {
  LYNX = 'lynx',
  WEB = 'web',
  MOBILE = 'mobile'
}

export enum PageMode {
  MOBILE = 0,
  SIMULATOR = 1,
  SIMULATOR_LYNX = 2
}

export type PluginEvent = {
  id?: number;
  isAsync?: boolean;
  timeout?: number;
  pluginId?: string;
  eventName: string;
  params: any;
};

export type MainContext = {
  plugin: {
    plugins: Array<{ id: string; name: string; description: string; isInternal?: boolean; path?: string }>;
    currentId: string;
  };
  simulator?: {
    bridgeManager: IBridgeManager;
    userManager: IUserManager;
    globalPropsManager: IGlobalPropsManager;
    envManager: IEnvManager;
    appInfoManager: IAppInfoManager;
    deviceInfoManager: IDeviceInfoManager;
    navigateManager: INavigateManager;
    getDebugger: () => IBaseDebugger;
    switchViewMode: (mode: ViewMode) => void;
    switchPage: (mode: PageMode) => void;
  };
  mobile: {
    usbManager: IUsbManager;
  };
  utils?: {
    package: {
      downloadNpmPackage: IDownloadNpmPackage;
      getVersionFromPackageJson: IGetVersionFromPackageJson;
    };
  };
  storage: ILDTConfig;
  constants: {
    LDT_DIR: string;
  };
      // Main process sends events to renderer process
  publishPluginEvent: (event: PluginEvent) => void;
  invokePluginEvent: (event: PluginEvent) => Promise<any>;
  restart: () => void;
};

type AsyncBridgeType = Record<string, (...args: any[]) => Promise<any> | any>;

export type MainPlugin<T extends AsyncBridgeType = AsyncBridgeType> = {
  asyncBridge?: (context: MainContext) => T;
  onCreate?: (context: MainContext, params: any) => Promise<void> | void;
  onShow?: (context: MainContext, params: any) => Promise<void> | void;
  onRestart?: (context: MainContext, params: any) => Promise<void> | void;
  onDestroy?: (context: MainContext, params: any) => Promise<void> | void;
  onSelect?: (context: MainContext, params: { value: string }) => Promise<void> | void;
};

export const definePlugin = <T extends AsyncBridgeType = AsyncBridgeType>(
  config: Partial<MainPlugin<T>>
): Partial<MainPlugin<T>> => config;
