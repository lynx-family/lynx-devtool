// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Distribution settings shared by the CLI and the desktop app.
//
// These are the values of the public package. A distribution with its own
// package name, registry, documentation or telemetry service replaces this
// module at build time with a module that exports the same shape. Version and
// registry come from package.json, so they are not listed here.

export interface SimulatorDistribution {
  // Name of this package, used to find the installed package root.
  packageName: string;
  // Package that provides the Lynxtron host binary started by the CLI.
  lynxtronPackage: string;
  // Command shown when a newer version is available.
  updateCommand: string;
  links: {
    documentation: string;
    changelog: string;
  };
  // CLI telemetry endpoint. Telemetry is disabled when this is undefined,
  // unless LYNX_SIMULATOR_METRICS_UPLOAD_URL is set.
  metricsUploadUrl?: string;
}

export const simulatorDistribution: SimulatorDistribution = {
  packageName: '@lynx-js/lynx-simulator',
  lynxtronPackage: '@lynx-js/lynxtron',
  updateCommand: 'npm install -g @lynx-js/lynx-simulator@latest',
  links: {
    documentation: 'https://github.com/lynx-family/lynx-devtool/tree/main/lynx-simulator',
    changelog:
      'https://github.com/lynx-family/lynx-devtool/blob/main/lynx-simulator/packages/simulator/CHANGELOG.md',
  },
};
