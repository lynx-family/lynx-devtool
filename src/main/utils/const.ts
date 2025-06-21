// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import os from 'os';
import path from 'path';

export const LDT_DIR = path.resolve(os.homedir(), '.lynx-devtool');

export const LDT_DOWNLOAD_DIR = path.resolve(LDT_DIR, 'download');

export const LDT_CACHE_DIR = path.resolve(LDT_DIR, 'cache');

export const LDT_CONFIG_FILE = path.resolve(LDT_DIR, 'config.json');

export const LDT_JSB_IMPL_DIR = path.resolve(LDT_DIR, 'customize/jsbImpl');
export const LDT_GLOBALPROPS_IMPL_DIR = path.resolve(LDT_DIR, 'customize/globalpropsImpl');
export const LDT_APP_INFO_IMPL_DIR = path.resolve(LDT_DIR, 'customize/appInfoImpl');

export const KEY_CONFIG_ENV = 'envConfig';

export function getOsType() {
  const platform = os.platform();
  if (platform === 'linux') {
    return 'Linux';
  }
  if (platform === 'darwin') {
    return 'Mac';
  }
  if (platform.startsWith('win')) {
    return 'Windows';
  }
  return 'Mac';
}
