// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SimulatorDevTool } from '@lynx-js/lynx-simulator-core';

export interface DevToolConfig {
  devToolEnabled?: unknown;
  logBoxEnabled?: unknown;
}

export async function applyDevToolConfig(
  devTool: SimulatorDevTool,
  config: DevToolConfig
): Promise<void> {
  if (typeof config.devToolEnabled === 'boolean') {
    await devTool.setDevToolEnabled(config.devToolEnabled);
  }
  if (typeof config.logBoxEnabled === 'boolean') {
    await devTool.setLogBoxEnabled(config.logBoxEnabled);
  }
}
