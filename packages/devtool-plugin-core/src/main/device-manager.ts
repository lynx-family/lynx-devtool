// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type IDeviceInfo = {
  deviceModel?: string;
  screenWidth?: number;
  screenHeight?: number;
  statusBarHeight?: number;
};

export interface IDeviceInfoManager {
  switchDevice: (deviceInfo: IDeviceInfo) => void;
  getCurrentDevice: () => IDeviceInfo;
}
