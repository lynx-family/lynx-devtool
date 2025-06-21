// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import BaseDebugger from '../base/BaseDebugger';
import { IDebuggerOptions } from '@lynx-js/devtool-plugin-core/main';
import { ipcMain } from 'electron';

class LynxDebugger extends BaseDebugger {
  private _sessionId = 0;

  constructor() {
    super();
    this._onMessage = this._onMessage.bind(this);
    this.appInfo.deviceModel = 'Simulator(lynx)';
  }

  start(options: IDebuggerOptions): Promise<void> {
    super.start(options);

    // Receive messages from lynx
    ipcMain.handle('ldt-lynx-devtool-message', (_, params, event) => {
      this._onMessage(params, event);
    });

    // Forward devtool messages to inspect overlay
    ipcMain.handle('devtool-inspect-message', (_, params) => {
      this._inspectContents?.send('devtool-inspect-message', params);
      if (params.method === 'Overlay.setInspectMode') {
        this._win?.webContents?.send('set-inspect-mode', params.data?.mode);
      }
    });

    // Forward inspect overlay messages to devtool
    ipcMain.handle('inspect-devtool-message', (_, params) => {
      this._win?.webContents?.send('inspect-devtool-message', params);
    });

    return Promise.resolve();
  }

  stop(): void {
    super.stop();
    ipcMain.removeHandler('devtool-inspect-message');
    ipcMain.removeHandler('inspect-devtool-message');
    ipcMain.removeHandler('ldt-lynx-devtool-message');
  }

  sendMessage(type: string, data: any) {
    const isObject = typeof data !== 'string';
    this.callLynxMethod(
      'sendDevtoolMessage',
      isObject ? JSON.stringify(data) : data,
      type,
      this._sessionId ?? -1,
      isObject
    );
  }

  getProtocol() {
    return {
      domains: [
        {
          domain: 'DOM',
          commands: [
            {
              name: 'enable'
            },
            {
              name: 'getDocument'
            },
            {
              name: 'getBoxModel'
            }
          ]
        },
        {
          domain: 'Page',
          commands: [
            {
              name: 'startScreencast'
            },
            {
              name: 'stopScreencast'
            },
            {
              name: 'enable'
            },
            {
              name: 'captureScreenshot'
            },
            {
              name: 'navigate'
            },
            {
              name: 'getResourceTree'
            }
          ],
          events: [
            {
              name: 'screencastFrame'
            }
          ]
        },
        {
          domain: 'CSS',
          commands: [
            {
              name: 'enable'
            },
            {
              name: 'getComputedStyleForNode'
            }
          ]
        },
        {
          domain: 'Input',
          commands: [
            {
              name: 'emulateTouchFromMouseEvent'
            },
            {
              name: 'dispatchMouseEvent'
            },
            {
              name: 'dispatchKeyEvent'
            }
          ]
        }
      ]
    };
  }

  private _onMessage = (payload, event) => {
    if (event === 'devtool-message') {
      const { type, message, session_id } = payload;
      if (type === 'CDP') {
        return;
      }
      if (!session_id || session_id === this._sessionId) {
        const data = JSON.parse(message);
        this.handleMessage(type, data);
      }
    } else if (event === 'devtool-session-create') {
      this._sessionId = payload.session_id;
    } else if (event === 'devtool-opencard') {
      console.log('opencard', payload);
      this.openCard(payload.url);
      // this.callContainerMethod('openScheme', payload.url);
    }
  };

  private callLynxMethod(method: string, ...params: any) {
    this.callContainerMethod('postMessage', {
      uuid: this.getContainerId(),
      type: 'function',
      method,
      arguments: params
    });
  }
}

export default LynxDebugger;
