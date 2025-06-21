// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const DEVICES: CustomDevice[] = [
  {
    value: {
      width: 375,
      height: 667,
      statusBarHeight: 20
    },
    label: 'iPhone 6'
  },
  {
    value: {
      width: 375,
      height: 667,
      statusBarHeight: 20
    },
    label: 'iPhone 7'
  },
  {
    value: {
      width: 375,
      height: 667,
      statusBarHeight: 20
    },
    label: 'iPhone 8'
  },
  {
    value: {
      width: 390,
      height: 844,
      statusBarHeight: 44
    },
    label: 'iPhone 14'
  },
  {
    value: {
      width: 392,
      height: 800,
      statusBarHeight: 44
    },
    label: 'Huawei Mate 30 Pro'
  }
].map((device) => ({
  ...device,
  deviceType: 'builtin'
}));

export const getDeviceId = (device: CustomDevice) => {
  return `${device.label}-${device.deviceType}`;
};

export const getDeviceById = (id: string, combinedDevices: CustomDevice[]) => {
  return combinedDevices.find((device) => getDeviceId(device) === id);
};

export type CustomDevice = {
  label: string;
  value: {
    width: number;
    height: number;
    statusBarHeight: number;
  };
  deviceType?: 'custom' | 'client' | 'builtin';
};
