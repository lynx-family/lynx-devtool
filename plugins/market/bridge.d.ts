// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type AsyncBridgeType = {
  installPlugin: (params: { pkgName: string; pkgVersion: string }) => Promise<string>;
  getPluginMeta: (pluginPath: string) => Promise<{
    id: string;
    name: string;
    description: string;
    disable: boolean;
    path: string;
    platformPlugin?: {
      entry: string;
      isValid: string;
      location: string;
      type: string;
    };
  }>;
  getPluginConfig: () => Promise<{
    plugins: Array<{
      id: string;
      name: string;
      description: string;
      isInternal?: boolean;
      path?: string;
      visible?: boolean;
    }>;
  }>;
  savePluginConfig: (config: { [key: string]: any }) => Promise<void>;
  updatePlatformPlugin: (pluginMeta: {path, platformPlugin?: {entry}}) => Promise<void>;
};