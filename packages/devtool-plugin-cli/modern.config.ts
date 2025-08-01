// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { moduleTools, defineConfig } from '@modern-js/module-tools';

export default defineConfig({
  plugins: [moduleTools()],
  buildConfig: {
    copy: {
      patterns: [
        {
          from: '../template',
          to: './template'
        }
      ]
    }
  },
  buildPreset: 'npm-library-es2019'
});
