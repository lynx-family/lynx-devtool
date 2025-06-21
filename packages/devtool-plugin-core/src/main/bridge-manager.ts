// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface CustomJSBImplConfigDetail {
  isActive: boolean;
}
export interface CustomJSBImplConfig {
  [x: string]: CustomJSBImplConfigDetail;
}

export interface IBridgeManager {
  getCustomJSBConfig: () => CustomJSBImplConfig;
  setCustomJSBConfig: (newConfig: CustomJSBImplConfig) => void;
  registerCustomJSBFromFile: (filename: string) => Promise<void>;
}
