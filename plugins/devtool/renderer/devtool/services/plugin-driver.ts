// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

class PluginDriver {
  private _messageCallback: ((message: any) => void) | undefined;

  registerCallback(callback: (message: any) => void) {
    this._messageCallback = callback;
  }

  sendMessage(message: any) {
    if (this._messageCallback) {
      this._messageCallback(message);
    }
  }
}

let instance: PluginDriver | undefined;
export function getPluginDriver(): PluginDriver {
  if (!instance) {
    instance = new PluginDriver();
  }
  return instance;
}
