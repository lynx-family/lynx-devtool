import type { SimulatorDevice } from './types';

const BUILTIN_DEVICES: SimulatorDevice[] = [
  {
    name: 'iphone-se-3',
    label: 'iPhone SE (3rd generation)',
    platform: 'ios',
    size: { width: 375, height: 667 },
    devicePixelRatio: 2,
  },
  {
    name: 'iphone-15',
    label: 'iPhone 15',
    platform: 'ios',
    size: { width: 393, height: 852 },
    devicePixelRatio: 3,
  },
  {
    name: 'iphone-15-pro-max',
    label: 'iPhone 15 Pro Max',
    platform: 'ios',
    size: { width: 430, height: 932 },
    devicePixelRatio: 3,
  },
  {
    name: 'ipad-mini-6',
    label: 'iPad mini (6th generation)',
    platform: 'ios',
    size: { width: 744, height: 1133 },
    devicePixelRatio: 2,
  },
  {
    name: 'ipad-pro-11',
    label: 'iPad Pro 11-inch',
    platform: 'ios',
    size: { width: 834, height: 1194 },
    devicePixelRatio: 2,
  },
  {
    name: 'pixel-7',
    label: 'Pixel 7',
    platform: 'android',
    size: { width: 412, height: 915 },
    devicePixelRatio: 2.625,
  },
  {
    name: 'galaxy-s24-ultra',
    label: 'Galaxy S24 Ultra',
    platform: 'android',
    size: { width: 384, height: 854 },
    devicePixelRatio: 3.75,
  },
  {
    name: 'huawei-pura-70',
    label: 'Huawei Pura 70',
    platform: 'harmony',
    size: { width: 393, height: 863 },
    devicePixelRatio: 3.2,
  },
  {
    name: 'huawei-mate-60-pro',
    label: 'Huawei Mate 60 Pro',
    platform: 'harmony',
    size: { width: 394, height: 850 },
    devicePixelRatio: 3.2,
  },
  {
    name: 'huawei-mate-x5-unfolded',
    label: 'Huawei Mate X5 (unfolded)',
    platform: 'harmony',
    size: { width: 768, height: 960 },
    devicePixelRatio: 3,
  },
  {
    name: 'desktop-1024x768',
    label: 'Desktop 1024 x 768',
    platform: 'desktop',
    size: { width: 1024, height: 768 },
    devicePixelRatio: 1,
  },
  {
    name: 'desktop-1440x900',
    label: 'Desktop 1440 x 900',
    platform: 'desktop',
    size: { width: 1440, height: 900 },
    devicePixelRatio: 1,
  },
];

export function getBuiltinDevices(): SimulatorDevice[] {
  return BUILTIN_DEVICES.map(cloneDevice);
}

export function normalizeDeviceName(name: string): string {
  return name
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function cloneDevice(device: SimulatorDevice): SimulatorDevice {
  return {
    ...device,
    size: {
      width: device.size.width,
      height: device.size.height,
    },
  };
}
