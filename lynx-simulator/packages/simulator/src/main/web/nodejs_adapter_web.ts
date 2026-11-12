// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Node.js Simulation Environment for Web (Background Thread)
 */

import { contextBridge } from '@lynx-js/lynxtron/context-bridge';

contextBridge.exposeInLynxBTS({
  // Adapt to desktop's exposed pattern
  echo(message: string) {
    return `Echo from Web BG Thread: ${message}`;
  },
});
