// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  parseSize,
  toSimulatorErrorInfo,
  type SimulatorRuntime,
  type SimulatorSize,
} from '@lynx-js/lynx-simulator-core';

export type OpenSizeResult =
  | {
      size?: SimulatorSize;
      error?: undefined;
    }
  | {
      size?: undefined;
      error: string;
    };

export function getOpenPageTarget(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const target = (data as { target?: unknown }).target;
  return typeof target === 'string' && target.length > 0 ? target : undefined;
}

export function resolveOpenSize(input: unknown, runtime: SimulatorRuntime): OpenSizeResult {
  if (!input || typeof input !== 'object') {
    return {
      error: 'open options must be an object.',
    };
  }

  const options = input as Record<string, unknown>;
  if (hasOption(options, 'device')) {
    return resolveDeviceSize(options.device, runtime);
  }

  if (hasOption(options, 'size')) {
    return resolveSizeOption(options.size);
  }

  if (hasOption(options, 'width') || hasOption(options, 'height')) {
    return {
      size: {
        width: options.width,
        height: options.height,
      } as SimulatorSize,
    };
  }

  return {};
}

export function getOpenDeviceScaleFactor(
  input: unknown,
  runtime: SimulatorRuntime
): number | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const options = input as Record<string, unknown>;
  // An explicit DPR overrides the selected device's preset.
  if (typeof options.dpr === 'number') {
    return options.dpr;
  }

  return typeof options.device === 'string'
    ? runtime.getDevice(options.device)?.devicePixelRatio
    : undefined;
}

function resolveDeviceSize(value: unknown, runtime: SimulatorRuntime): OpenSizeResult {
  const device = typeof value === 'string' ? runtime.getDevice(value) : undefined;
  return device ? { size: device.size } : { error: `Unknown device: ${String(value)}.` };
}

function resolveSizeOption(value: unknown): OpenSizeResult {
  if (typeof value === 'string') {
    try {
      return {
        size: parseSize(value),
      };
    } catch (error) {
      const errorInfo = toSimulatorErrorInfo(error);
      return {
        error: `[${errorInfo.code}] ${errorInfo.message}`,
      };
    }
  }

  return value && typeof value === 'object'
    ? { size: value as SimulatorSize }
    : { error: `Invalid size: ${String(value)}.` };
}

function hasOption(options: Record<string, unknown>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(options, name);
}
