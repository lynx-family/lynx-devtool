// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SimulatorDevice } from '@lynx-js/lynx-simulator-core';
import type { JSBErrorResult, Theme } from './types';

type AppGlobalProps = {
  simulatorTheme?: unknown;
  simulatorDevices?: unknown;
};

export function getGlobalTheme(): Theme {
  const theme = getAppGlobalProps().simulatorTheme;
  return theme === 'dark' || theme === 'light' ? theme : 'light';
}

export function getGlobalDevices(): SimulatorDevice[] {
  const devices = getAppGlobalProps().simulatorDevices;
  return Array.isArray(devices) ? devices.filter(isDevice) : [];
}

export function getSizeSummary(device: SimulatorDevice | undefined): string {
  if (device) {
    return `${device.label ?? device.name} - ${device.size.width}x${device.size.height}`;
  }
  return 'Default size - 390x844';
}

export function getSizeOptionClass(selected: boolean, theme: Theme): string {
  return `SizeOption SizeOption--${theme}${selected ? ' SizeOption--selected' : ''}`;
}

export function createCustomDeviceName(
  label: string,
  width: number,
  height: number,
  devices: SimulatorDevice[]
): string {
  const baseName = normalizeCustomDeviceName(label) || `custom-${width}x${height}`;
  const names = new Set(devices.map((device) => device.name));
  if (!names.has(baseName)) {
    return baseName;
  }

  let index = 2;
  while (names.has(`${baseName}-${index}`)) {
    index += 1;
  }
  return `${baseName}-${index}`;
}

export function formatJSBError(name: string, result: JSBErrorResult): string {
  return result.message ?? `${name} failed.`;
}

function isDevice(value: unknown): value is SimulatorDevice {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const device = value as SimulatorDevice;
  return (
    typeof device.name === 'string' &&
    typeof device.size?.width === 'number' &&
    typeof device.size?.height === 'number'
  );
}

function getAppGlobalProps(): AppGlobalProps {
  return (lynx.__globalProps ?? {}) as AppGlobalProps;
}

function normalizeCustomDeviceName(name: string): string {
  return name
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
