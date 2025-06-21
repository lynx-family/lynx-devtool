// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type PluginTrackEvent = {
  name: string;
  categories?: Record<string, string>;
  metrics?: Record<string, number>;
};

// TODO: The following need to be moved down to ldt-utils/ldt-core
export interface EnvLogCategoryObject {
  module: string; // Primary tag
  tag: string; // Secondary tag
  extra?: Record<string, any>; // Any extra tags
}
export enum EnvLogLevelType {
  Info = 'info',
  Debug = 'debug',
  Warn = 'warn',
  Error = 'error'
}
// TODO: The above needs to be moved down to ldt-utils/ldt-core
export type PluginEnvLog = {
  level: EnvLogLevelType;
  msg: Record<string, any> | string;
  categories: EnvLogCategoryObject;
};
