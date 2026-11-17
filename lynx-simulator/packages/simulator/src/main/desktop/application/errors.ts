// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as lynxtron from '@lynx-js/lynxtron';
import { type SimulatorErrorInfo } from '@lynx-js/lynx-simulator-core';
import { APP_ICON_PATH } from './vendorPaths';

const { dialog } = lynxtron;

export function showApplicationErrorMessage(message: string): void {
  console.error(`[lynx-simulator] ${message}`);
  showErrorMessage(message);
}

export function showErrorInfo(error: SimulatorErrorInfo): void {
  const message = `[${error.code}] ${error.message}`;
  console.error(`[lynx-simulator] ${message}`);
  if (error.details) {
    console.error('[lynx-simulator] error details:', error.details);
  }
  showErrorMessage(message);
}

function showErrorMessage(message: string): void {
  void dialog
    .showMessageBox({
      type: 'error',
      title: 'Lynx Simulator',
      message,
      icon: APP_ICON_PATH,
      buttons: ['OK'],
    })
    .catch((error) => {
      console.error(`[lynx-simulator] Failed to show error dialog: ${String(error)}`);
    });
}
