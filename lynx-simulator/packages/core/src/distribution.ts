// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Distribution hooks for the simulator SDK.
//
// These are the defaults of the public package. A distribution that ships a
// different Lynxtron host or accepts extra target schemes replaces this module
// at build time with a module that exports the same functions. Keep every
// export here small and free of distribution-specific values.

import type * as Lynxtron from '@lynx-js/lynxtron';
import type { LoadTarget } from './runtime/target';

export type LynxtronModule = typeof Lynxtron;

// Loads the Lynxtron host module at runtime instead of bundling it, so the
// installed host package keeps its package-relative native paths.
export function loadLynxtron(): Promise<LynxtronModule> {
  return import(/* webpackIgnore: true */ '@lynx-js/lynxtron') as Promise<LynxtronModule>;
}

// Resolves a URL target that the public SDK does not accept by itself.
// Returns undefined to keep the default target handling.
export function resolveDistributionTarget(_url: URL, _target: string): LoadTarget | undefined {
  return undefined;
}
