// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import BaseHandler from '@/main/base/BaseHandler';
import { dialog, BrowserWindow } from 'electron';

class OpenDirectoryHandler extends BaseHandler {
  getName(): string {
    return 'dialog:openDirectory';
  }
  async handle(_params: any): Promise<string | null> {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const options = { properties: ['openDirectory' as const] };
    const result = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  }
}

export default OpenDirectoryHandler;
