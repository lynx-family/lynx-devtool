// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Desktop extension points.
//
// The public app has no native extensions and no built-in JSB implementations.
// A distribution replaces this module at build time to set up host extensions
// and to provide real JSB handlers. Page environment mocks still take priority
// over these handlers.

import type { JSBHandlerRegistration, SimulatorRuntime } from '@lynx-js/lynx-simulator-core';

// Runs once when the desktop main process starts, before the runtime exists.
export function setupDesktopExtensions(): void {}

// Returns the real JSB handlers used when a page environment has no mock.
export function createDesktopJSBHandlers(_runtime: SimulatorRuntime): JSBHandlerRegistration[] {
  return [];
}
