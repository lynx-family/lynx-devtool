// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  ERemoteDebugDriverEventNames,
  IRemoteDebugDriverEvent2Payload,
  IRemoteDebugServer4Driver
} from '@lynx-js/remote-debug-driver';
// TODO(talisk): make this file more generic
import type { IDevice, IDeviceInfo, ISessionInfo } from './device';

export interface ICustomMessage {
  type?: string;
  params: Record<string, any>;
  clientId?: number;
  sessionId?: number;
  useParamsAsData?: boolean;
}

export enum EDebugDriverClientEventNames {
  ClientChange = 'ClientChange',
  // emitted before session changes
  SessionWillChange = 'SessionWillChange',
  // emitted after session has changed
  SessionChange = 'SessionChange'
}

export interface IDebugDriverEvent2Payload extends IRemoteDebugDriverEvent2Payload {
  ['ClientChange']: {
    device: IDevice;
    sessionId: number;
  };
  ['SessionChange']: {
    device: IDevice;
    sessionId: number;
    deviceInfo: IDeviceInfo;
  };
  ['SessionWillChange']: {
    newSession: ISessionInfo;
    oldSession?: ISessionInfo;
  };
}

export type EDebugDriverEventNames = ERemoteDebugDriverEventNames | EDebugDriverClientEventNames;

export interface IDebugDriver {
  connect: (url: string, roomId: string) => Promise<IRemoteDebugServer4Driver>;
  getRemoteSchema: (prefix?: string) => Promise<string>;
  sendCustomMessage: (message: ICustomMessage) => void;
  sendCustomMessageAsync: (message: ICustomMessage) => Promise<any>;
  getSelectClientId: () => number | undefined;
  setSelectClientId: (clientId?: number) => void;
  getSelectSessionId: () => number | undefined;
  setSelectSessionId: (sessionId?: number) => void;
  getClientInfo: (clientId: number) => IDeviceInfo | undefined;
  getDeviceInfo: (clientId: number) => IDevice | undefined;
  emit: <T extends EDebugDriverEventNames>(name: T, payload: IDebugDriverEvent2Payload[T]) => void;
  on: <T extends EDebugDriverEventNames>(name: T, callback: (payload: IDebugDriverEvent2Payload[T]) => void) => void;
  off: <T extends EDebugDriverEventNames>(name: T, callback: (payload: IDebugDriverEvent2Payload[T]) => void) => void;
}
