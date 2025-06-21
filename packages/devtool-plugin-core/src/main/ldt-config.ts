// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type OnChangeListener = (key: string, value: any) => void;

export interface ILDTConfig {
  getConfig: <T>(key: string, defaultValue?: T) => T;
  setConfig: (key: string, value: any) => void;
  addChangeListener: (key: string, listener: OnChangeListener) => void;
  removeChangeListener: (key: string, listener: OnChangeListener) => void;
}
