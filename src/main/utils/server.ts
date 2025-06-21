// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { toolkitExecutor, getDebugDriver, sendUsbMessageToWeb, CliOptions } from '@lynx-js/lynx-devtool-cli';

export interface LDTServerOptions extends CliOptions {
  forceNew?: boolean;
}
class LDTServer {
  ldtUrl: string | null = null;
  readyResolve: (() => void) | null = null;
  readyPromise: Promise<void> | null = new Promise((resolve) => {
    this.readyResolve = resolve;
  });

  async start(options: LDTServerOptions = {}): Promise<string> {
    if (!this.ldtUrl || options.forceNew) {
      this.ldtUrl = await toolkitExecutor({
        openWebview: false,
        runType: 'electron-v3',
        upgradeChannel: '3x',
        debug: process.env.NODE_ENV === 'development',
        // debug: true,
        progressListener: options?.progressListener
      });
    }
    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
      this.readyPromise = null;
    }

    return this.ldtUrl;
  }

  getDebugDriver() {
    return getDebugDriver();
  }

  async getDebugDriverAsync() {
    if (this.readyPromise) {
      await this.readyPromise;
    }

    return getDebugDriver();
  }

  getHost() {
    if (this.ldtUrl) {
      const url = new URL(this.ldtUrl);
      return url.host;
    }
    return null;
  }

  getConnectionQuery() {
    if (this.ldtUrl) {
      const url = new URL(this.ldtUrl);
      return url.searchParams.toString();
    }
    return null;
  }

  sendMessageToWeb(id: number, message: string) {
    sendUsbMessageToWeb(id, message);
  }
}

const ldtServer = new LDTServer();
export default ldtServer;
