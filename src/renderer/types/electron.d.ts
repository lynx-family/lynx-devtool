// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

interface IpcRenderer {
  send(channel: string, ...args: any[]): void;
  invoke(channel: string, ...args: any[]): Promise<any>;
  on(channel: string, func: (...args: any[]) => void): () => void;
  once(channel: string, func: (...args: any[]) => void): void;
  removeAllListeners(channel: string): void;
}

declare global {
  interface Window {
    electron: {
      ipcRenderer: IpcRenderer;
    };
  }
}

export {}; 