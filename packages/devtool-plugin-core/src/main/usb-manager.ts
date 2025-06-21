// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export enum DeviceStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected'
}

export interface IUsbDevice {
  info: IUsbDeviceInfo;
  executeShell: (command: string) => Promise<string>;
  serial: string;
}

export interface IUsbDeviceInfo {
  title: string;
  os: string;
  serial: string;
}

export type DeviceChangeListener = (status: DeviceStatus, device: IUsbDevice) => void;

export interface IUsbManager {
  getDevice: (deviceId: string) => IUsbDevice | undefined;

  getDevices: () => any[];
  getDeviceByClientId: (clientId: number) => IUsbDevice | undefined;
  addDeviceChangeListener: (listener: DeviceChangeListener) => void;
  removeDeviceChangeListener: (listener: DeviceChangeListener) => void;
  shell: (deviceId: string, cmd: string) => Promise<string>;
  click: (deviceId: string, x: number, y: number) => Promise<void>;
  swipe: (
    deviceId: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration: number
  ) => Promise<void>;
  inputText: (deviceId: string, text: string) => Promise<void>;

  captureScreen: (deviceId: string) => Promise<string>;
}
