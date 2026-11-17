// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  toSimulatorErrorInfo,
  type SimulatorErrorInfo,
  type SimulatorRuntime,
} from '@lynx-js/lynx-simulator-core';

interface RegisterOpenCardHandlerOptions {
  runtime: SimulatorRuntime;
  getBackgroundColor: () => string;
  writeLog: (event: string, detail: Record<string, unknown>) => void;
}

export async function registerOpenCardHandler(
  options: RegisterOpenCardHandlerOptions
): Promise<void> {
  await options.runtime.devTool.setOpenCardCallback((url) => {
    void openCard(url, options);
  });
}

async function openCard(url: string, options: RegisterOpenCardHandlerOptions): Promise<void> {
  options.writeLog('open-card-requested', { url });

  try {
    const ref = await options.runtime.open({
      target: url,
      cwd: process.cwd(),
      window: {
        backgroundColor: options.getBackgroundColor(),
      },
    });
    const error = ref.getInfo()?.error;
    if (error) {
      logOpenCardError(url, error, options.writeLog);
      return;
    }

    options.writeLog('open-card-opened', {
      url,
      windowId: ref.id,
    });
  } catch (error) {
    logOpenCardError(url, toSimulatorErrorInfo(error), options.writeLog);
  }
}

function logOpenCardError(
  url: string,
  errorInfo: SimulatorErrorInfo,
  writeLog: RegisterOpenCardHandlerOptions['writeLog']
): void {
  writeLog('open-card-failed', {
    url,
    code: errorInfo.code,
    message: errorInfo.message,
    details: errorInfo.details,
  });
  console.error(`[lynx-simulator] Failed to open card: ${errorInfo.message}`);
}
