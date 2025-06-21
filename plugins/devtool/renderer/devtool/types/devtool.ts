// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export enum WebsiteType {
  Devtool = 'Devtool',
  XDB = 'XDB'
}

export type InspectorType = '' | 'web' | 'worker';

export enum DevtoolServerType {
  Remote = 'remote WS',
  LocalWS = 'local WS',
  LocalUSB = 'local USB'
}

/**
 * Connection steps with LDT server and devtool server.
 * step 0: web - server not connected.
 * step 1: web - server connected. server - device not connected.
 * step 2: web - server connected. server - device connected.
 */
export interface IConnectionSteps {
  ldt: number;
  devtool: {
    type: DevtoolServerType;
    step: number;
  };
  deviceName: string;
}

export enum DevtoolConnectionNodeType {
  LDTServer2Web = 'LDTServer2Web',
  LDTServer2Device = 'LDTServer2Device',
  DevtoolServer2Web = 'DevtoolServer2Web',
  DevtoolServer2Device = 'DevtoolServer2Device'
}

export interface IDevtoolStatsMessage {
  sender: string;
  type: string;
  message: string;
}

export interface IDevtoolStatsUpdater {
  recordedTypes: string[];
  updater: (entry: IDevtoolStatsMessage) => void;
}

enum EDevtoolLoadingProgressType {
  lynxOpen = 'lynx_open',
  createAppUI = 'create_appUI',
  showAppUI = 'show_appUI',
  initializeTarget = 'initialize_target',
  startScreencast = 'start_screencast',
  stopScreencast = 'stop_screencast',
  firstScreencastFrame = 'first_screencastFrame',
  startProgress = 'start_progress',
  stopProgress = 'stop_progress'
}
export interface IDevtoolLoadingProgress {
  timestamp?: number;
  type: EDevtoolLoadingProgressType;
  message?: Record<string, any> | null;
}

export interface LDTPlatformPluginForUser {
  _id: string;
  name: string;
  type: string;
  url: string;
  location: string;
  isValid: string;
}
