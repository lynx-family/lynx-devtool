// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Distribution hooks for the simulator SDK.
//
// These are the defaults of the public package. A distribution that ships a
// different Lynxtron host replaces this module at build time with a module that
// exports the same functions. Keep the public defaults here and keep
// distribution-specific values out.

import type * as Lynxtron from '@lynx-js/lynxtron';

export type LynxtronModule = typeof Lynxtron;

// Loads the Lynxtron host module at runtime instead of bundling it, so the
// installed host package keeps its package-relative native paths.
export function loadLynxtron(): Promise<LynxtronModule> {
  return import(/* webpackIgnore: true */ '@lynx-js/lynxtron') as Promise<LynxtronModule>;
}
