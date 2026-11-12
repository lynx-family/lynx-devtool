// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config';
import path from 'node:path';

const defaultConfig = await createVitestConfig();
const config = defineConfig({
  resolve: {
    alias: {
      '@assets': path.resolve(import.meta.dirname, './src/assets'),
    },
  },
  test: {
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
  },
});

export default mergeConfig(defaultConfig, config);
