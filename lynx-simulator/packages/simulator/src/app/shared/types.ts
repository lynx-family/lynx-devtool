// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SimulatorDevice, SimulatorSize } from '@lynx-js/lynx-simulator-core';

export type InputEvent = {
  detail?: {
    value?: string;
  };
};

export type Theme = 'light' | 'dark';
export type SizeMode = 'default' | 'device' | 'custom';

export type SizeSelection =
  | {
      mode: 'default';
    }
  | {
      mode: 'device';
      device: SimulatorDevice;
    }
  | {
      mode: 'custom';
      size: SimulatorSize;
    };

export type JSBSuccessResult = {
  ok: true;
};

export type JSBErrorResult = {
  ok: false;
  message: string;
};

export type JSBResult = JSBSuccessResult | JSBErrorResult;
