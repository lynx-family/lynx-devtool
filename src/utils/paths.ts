// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { resolve } from 'path';
import { app } from 'electron';

export const getPath = (...relativePaths: string[]): string => {
  let path: string;

  if (app) {
    path = app.getPath('userData');
  } else {
    return '';
  }

  return resolve(path, ...relativePaths).replace(/\\/g, '/');
};

export function getAppPath(): string {
  if (app) {
    return app.getAppPath();
  } else {
    console.error('some thing may be wrong!');
    return '';
  }
}
