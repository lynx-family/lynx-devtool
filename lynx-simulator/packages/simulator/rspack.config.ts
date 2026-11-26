// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference path="./tsconfig.tools.json" />

import {
  createSimulatorRspackConfigs,
  getBuildTargets,
  simulatorSourceRoot,
} from './rspack.configs.ts';

export default createSimulatorRspackConfigs({
  packageRoot: simulatorSourceRoot,
  targets: getBuildTargets(),
  isDev: process.env.NODE_ENV === 'development',
});
