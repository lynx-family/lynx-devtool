// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface ISessionInfo {
  url: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  session_id: number;
  type: 'web' | 'worker' | '';
  screenshot?: string;
  engineType?: string;
  targets?: Set<string>;
}
export interface IDevice {
  clientId?: number;
  info: {
    did?: string;
    appId?: string;
    App: string;
    AppProcessName: string;
    AppVersion: string;
    deviceModel: string;
    model?: string;
    network: string;
    osType?: 'iOS' | 'Android' | 'Mac' | 'Windows';
    osSupportWebDevtool?: string;
    osVersion: string;
    sdkVersion: string;
    ldtVersion?: string;
    debugRouterVersion?: string;
    debugRouterId?: string;
    lynxDevtoolEnabled?: string;
    webDevtoolEnabled?: string;
    usbDeviceId?: string;
    deviceType?: 'simulator' | 'mobile';
  };
  xdbId?: string;
  xdbOnline?: boolean;
}

export interface IDeviceInfo {
  stopAtEntry: boolean;
  stopLepusAtEntry: boolean;
  sessions?: ISessionInfo[];
  selectedSession?: ISessionInfo;
  traceStarting?: boolean;
  traceLoading?: boolean;
  traceTimer?: any;
  testbenchStarting?: boolean;
  testbenchLoading?: boolean;
  testbenchTimer?: any;
  memoryStarting?: boolean;
  memoryTimer?: any;
  // -2: Lynx SDK not support start up trace
  // -1 or 0: Lynx SDK support start up trace, but user doesn't set
  // > 0: Lynx SDK would start trace while app start up
  startupTracingDuration?: number;
  isCardDebugMode?: boolean;
}

export interface IGroupDevice extends IDevice {
  top: boolean;
}

export type Platform = 'Android' | 'iOS' | 'Mac' | 'Windows';
