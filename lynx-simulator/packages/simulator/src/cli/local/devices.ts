// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createSimulatorRuntime, formatDevices } from '@lynx-js/lynx-simulator-core';

import type { CliResult } from '../output';

export function getDevicesResult(): CliResult {
  return {
    ok: true,
    output: formatDevices(createSimulatorRuntime().listDevices()),
    stdout: 'text',
  };
}
