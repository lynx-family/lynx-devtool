// Copyright (c) 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable rulesdir/no_underscored_properties */

import * as Common from '../common/common.js';
import * as Host from '../host/host.js';
import * as ProtocolClient from '../protocol_client/protocol_client.js';
import * as InspectorBackend from '../protocol_client/InspectorBackend.js';

import {TargetManager} from './TargetManager.js';

export class MainConnection implements ProtocolClient.InspectorBackend.Connection {
  _onMessage: ((arg0: (Object|string)) => void)|null;
  _onDisconnect: ((arg0: string) => void)|null;
  _messageBuffer: string;
  _messageSize: number;
  _eventListeners: Common.EventTarget.EventDescriptor[];
  constructor() {
    this._onMessage = null;
    this._onDisconnect = null;
    this._messageBuffer = '';
    this._messageSize = 0;
    this._eventListeners = [
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(
          Host.InspectorFrontendHostAPI.Events.DispatchMessage, this._dispatchMessage, this),
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(
          Host.InspectorFrontendHostAPI.Events.DispatchMessageChunk, this._dispatchMessageChunk, this),
    ];
  }

  setOnMessage(onMessage: (arg0: (Object|string)) => void): void {
    this._onMessage = onMessage;
  }

  setOnDisconnect(onDisconnect: (arg0: string) => void): void {
    this._onDisconnect = onDisconnect;
  }

  sendRawMessage(message: string): void {
    if (this._onMessage) {
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.sendMessageToBackend(message);
    }
  }

  _dispatchMessage(event: Common.EventTarget.EventTargetEvent): void {
    if (this._onMessage) {
      this._onMessage.call(null, (event.data as string));
    }
  }

  _dispatchMessageChunk(event: Common.EventTarget.EventTargetEvent): void {
    const messageChunk = (event.data['messageChunk'] as string);
    const messageSize = (event.data['messageSize'] as number);
    if (messageSize) {
      this._messageBuffer = '';
      this._messageSize = messageSize;
    }
    this._messageBuffer += messageChunk;
    if (this._messageBuffer.length === this._messageSize && this._onMessage) {
      this._onMessage.call(null, this._messageBuffer);
      this._messageBuffer = '';
      this._messageSize = 0;
    }
  }

  async disconnect(): Promise<void> {
    const onDisconnect = this._onDisconnect;
    Common.EventTarget.removeEventListeners(this._eventListeners);
    this._onDisconnect = null;
    this._onMessage = null;

    if (onDisconnect) {
      onDisconnect.call(null, 'force disconnect');
    }
  }
}

export class WebSocketConnection implements ProtocolClient.InspectorBackend.Connection {
  _socket: WebSocket|null;
  _onMessage: ((arg0: (Object|string)) => void)|null;
  _onDisconnect: ((arg0: string) => void)|null;
  _onWebSocketDisconnect: (() => void)|null;
  _connected: boolean;
  _messages: string[];
  constructor(url: string, onWebSocketDisconnect: () => void) {
    this._socket = new WebSocket(url);
    this._socket.onerror = this._onError.bind(this);
    this._socket.onopen = this._onOpen.bind(this);
    this._socket.onmessage = (messageEvent: MessageEvent<string>): void => {
      if (this._onMessage) {
        this._onMessage.call(null, messageEvent.data);
      }
    };
    this._socket.onclose = this._onClose.bind(this);

    this._onMessage = null;
    this._onDisconnect = null;
    this._onWebSocketDisconnect = onWebSocketDisconnect;
    this._connected = false;
    this._messages = [];
  }

  setOnMessage(onMessage: (arg0: (Object|string)) => void): void {
    this._onMessage = onMessage;
  }

  setOnDisconnect(onDisconnect: (arg0: string) => void): void {
    this._onDisconnect = onDisconnect;
  }

  _onError(): void {
    if (this._onWebSocketDisconnect) {
      this._onWebSocketDisconnect.call(null);
    }
    if (this._onDisconnect) {
      // This is called if error occurred while connecting.
      this._onDisconnect.call(null, 'connection failed');
    }
    this._close();
  }

  _onOpen(): void {
    this._connected = true;
    if (this._socket) {
      this._socket.onerror = console.error;
      for (const message of this._messages) {
        this._socket.send(message);
      }
    }
    this._messages = [];
  }

  _onClose(): void {
    if (this._onWebSocketDisconnect) {
      this._onWebSocketDisconnect.call(null);
    }
    if (this._onDisconnect) {
      this._onDisconnect.call(null, 'websocket closed');
    }
    this._close();
  }

  _close(callback?: (() => void)): void {
    if (this._socket) {
      this._socket.onerror = null;
      this._socket.onopen = null;
      this._socket.onclose = callback || null;
      this._socket.onmessage = null;
      this._socket.close();
      this._socket = null;
    }
    this._onWebSocketDisconnect = null;
  }

  sendRawMessage(message: string): void {
    if (this._connected && this._socket) {
      this._socket.send(message);
    } else {
      this._messages.push(message);
    }
  }

  disconnect(): Promise<void> {
    return new Promise(fulfill => {
      this._close(() => {
        if (this._onDisconnect) {
          this._onDisconnect.call(null, 'force disconnect');
        }
        fulfill();
      });
    });
  }
}

export class StubConnection implements ProtocolClient.InspectorBackend.Connection {
  _onMessage: ((arg0: (Object|string)) => void)|null;
  _onDisconnect: ((arg0: string) => void)|null;
  constructor() {
    this._onMessage = null;
    this._onDisconnect = null;
  }

  setOnMessage(onMessage: (arg0: (Object|string)) => void): void {
    this._onMessage = onMessage;
  }

  setOnDisconnect(onDisconnect: (arg0: string) => void): void {
    this._onDisconnect = onDisconnect;
  }

  sendRawMessage(message: string): void {
    setTimeout(this._respondWithError.bind(this, message), 0);
  }

  _respondWithError(message: string): void {
    const messageObject = JSON.parse(message);
    const error = {
      message: 'This is a stub connection, can\'t dispatch message.',
      code: ProtocolClient.InspectorBackend.DevToolsStubErrorCode,
      data: messageObject,
    };
    if (this._onMessage) {
      this._onMessage.call(null, {id: messageObject.id, error: error});
    }
  }

  async disconnect(): Promise<void> {
    if (this._onDisconnect) {
      this._onDisconnect.call(null, 'force disconnect');
    }
    this._onDisconnect = null;
    this._onMessage = null;
  }
}

export class ParallelConnection implements ProtocolClient.InspectorBackend.Connection {
  _connection: ProtocolClient.InspectorBackend.Connection;
  _sessionId: string;
  _onMessage: ((arg0: Object) => void)|null;
  _onDisconnect: ((arg0: string) => void)|null;
  constructor(connection: ProtocolClient.InspectorBackend.Connection, sessionId: string) {
    this._connection = connection;
    this._sessionId = sessionId;
    this._onMessage = null;
    this._onDisconnect = null;
  }

  setOnMessage(onMessage: (arg0: Object) => void): void {
    this._onMessage = onMessage;
  }

  setOnDisconnect(onDisconnect: (arg0: string) => void): void {
    this._onDisconnect = onDisconnect;
  }

  sendRawMessage(message: string): void {
    const messageObject = JSON.parse(message);
    // If the message isn't for a specific session, it must be for the root session.
    if (!messageObject.sessionId) {
      messageObject.sessionId = this._sessionId;
    }
    this._connection.sendRawMessage(JSON.stringify(messageObject));
  }

  async disconnect(): Promise<void> {
    if (this._onDisconnect) {
      this._onDisconnect.call(null, 'force disconnect');
    }
    this._onDisconnect = null;
    this._onMessage = null;
  }
}

export class LynxConnection implements ProtocolClient.InspectorBackend.Connection {
  _onMessage: ((arg0: (Object|string)) => void)|null;
  _onDisconnect: ((arg0: string) => void)|null;
  _onWebSocketDisconnect: (() => void)|null;
  _connected: boolean;
  _messages: string[];
  _screenCastFrame: boolean;
  constructor(onWebSocketDisconnect: () => void) {
    // @ts-ignore
    window.document.addEventListener('lynx_message', messageEvent => {
      if (this._onMessage) {
        // @ts-ignore
        this._onMessage.call(null, /** @type {string} */ (messageEvent.data));
      }
    });
    window.addEventListener('message', event => {
      if (!event.data) {
        return;
      }
      let { content } = event.data;
      switch (event.data.type) {
        case 'lynx_open':
          this._onOpen(content);
          // Loading progress reporting
          Host.InspectorFrontendHost.sendWindowMessage({
            type: 'update_loading_progress',
            content: {
              timestamp: Date.now(),
              type: 'lynx_open',
              message: null,
            },
          });
          break;
        case 'codex_companion_mode':
          if (content?.visible && typeof content?.focusPanelId === 'string' && content.focusPanelId) {
            (window as any).DevToolsAPI?.showPanel(content.focusPanelId);
          }
          break;
        // all messages from devtool server
        case 'lynx_message':
          // After receiving all types of messages, the web sends devtoolStats messages to the iframe, and no longer sends them repeatedly in pluginLoader
          // @ts-ignore
          if (window.devtoolStatsRecording) {
            // Report all received devtool messages to the iframe
            Host.InspectorFrontendHost.sendWindowMessage({
              type: 'devtool_stats',
              content: {
                type: 'stats_message',
                message: {
                  sender: 'app',
                  type: content.type,
                  message: content.message,
                  timestamp: Date.now(),
                },
              },
            });
          }
          if (this._onMessage) {
            // Only CDP messages are processed here, and plugin messages such as jsb and resource are handled by pluginLoader
            // @ts-ignore
            if (content.type === 'CDP') {
              // @ts-ignore
              if (window.runLighthouse) {
                const messageObject = ((typeof content.message === 'string') ? JSON.parse(content.message) : content.message) as InspectorBackend.Message;
                if (messageObject) {
                  // @ts-ignore
                  messageObject['sessionId'] = window.lighthouseSessionId;
                  this._onMessage.call(null, /** @type {string} */ JSON.stringify(messageObject));
                }
              } else {
                this._onMessage.call(null, /** @type {string} */ (content.message));
                if (!this._screenCastFrame && content.message.includes('Page.screencastFrame')) {
                  Host.InspectorFrontendHost.sendWindowMessage({
                    type: 'update_loading_progress',
                    content: {
                      timestamp: Date.now(),
                      type: 'first_screencastframe',
                      message: null
                    }
                  });
                  // TODO: "update_screenFrameTime" can be deleted after LDT 2.0 online version is released
                  Host.InspectorFrontendHost.sendWindowMessage({
                    type: 'update_screenFrameTime',
                    content: `${Date.now()}`
                  });
                  this._screenCastFrame = true;
                }
              }
            } else if (content.type === 'xdb_lynx_event') {
              Host.InspectorFrontendHost.sendWindowMessage({
                type: content.type,
                content: content.message
              });
            }
          }
          break;
        case 'devtool_stats':
          if (content.type === 'change_recording') {
            // @ts-ignore
            window.devtoolStatsRecording = content.message;
            Host.InspectorFrontendHost.sendWindowMessage({
              type: 'devtool_stats',
              content: {
                type: 'change_recording_resp',
                message: ''
              },
            });
          }
          break;
        case 'a11y_mark_lynx':
          if (content.type === 'console_log') {
            // @ts-ignore will be injected by plugin.js
            window.logPluginExpression(content.message);
          }
          break;
        default:
          break;
      }
    });
    Host.InspectorFrontendHost.sendWindowMessage({ type: 'iframe_loaded' });
    this._onMessage = null;
    this._onDisconnect = null;
    this._onWebSocketDisconnect = onWebSocketDisconnect;
    this._connected = false;
    this._messages = [];
    this._screenCastFrame = false;
  }

  setOnMessage(onMessage: (arg0: (Object|string)) => void): void {
    this._onMessage = onMessage;
  }

  setOnDisconnect(onDisconnect: (arg0: string) => void): void {
    this._onDisconnect = onDisconnect;
  }

  _onError(): void {
    if (this._onWebSocketDisconnect) {
      this._onWebSocketDisconnect.call(null);
    }
    if (this._onDisconnect) {
      // This is called if error occurred while connecting.
      this._onDisconnect.call(null, 'connection failed');
    }
    this._close();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _onOpen(msg: any): void {
    // @ts-ignore
    window.wsUrl = msg.wsUrl;
    // @ts-ignore
    window.roomId = msg.roomId;
    // @ts-ignore
    window.sessionId = msg.sessionId;
    // @ts-ignore
    window.info = msg.info;
    // @ts-ignore
    window.sessionUrl = msg.sessionUrl;

    this._connected = true;
    for (const message of this._messages) {
      Host.InspectorFrontendHost.sendWindowMessage({
        type: 'send_message',
        content: {
          type: 'CDP',
          message
        }
      });
    }
    this._messages = [];

    // lynx inspector initialization tracking
    Host.InspectorFrontendHost.reportToStatistics('devtool_init', {
      type: 'lynx',
      appId: msg.info?.appId ?? msg.info?.App
    });

    let timeout: ReturnType<typeof setTimeout>|null = null;
    new IntersectionObserver((entries, observer) => {
      if (entries.some(entry => entry.isIntersecting)) {
        if (timeout !== null) {
          return;
        }
        timeout = setTimeout(() => {
          observer.unobserve(document.body);
          Host.InspectorFrontendHost.reportToStatistics('devtools_active_user', {
            type: 'lynx',
            appId: msg.info?.appId ?? msg.info?.App,
          });
        }, 10000);
      } else if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    }).observe(document.body);
  }

  _onClose(): void {
    if (this._onWebSocketDisconnect) {
      this._onWebSocketDisconnect.call(null);
    }
    if (this._onDisconnect) {
      this._onDisconnect.call(null, 'websocket closed');
    }
    this._close();
  }

  _close(_?: (() => void)): void {
    this._onWebSocketDisconnect = null;
  }

  sendRawMessage(message: string): void {
    if (this._connected) {
      Host.InspectorFrontendHost.sendWindowMessage({
        type: 'send_message',
        content: {
          type: 'CDP',
          message,
        }
      });
    } else {
      this._messages.push(message);
    }
  }

  disconnect(): Promise<void> {
    let fulfill: () => void;
    const promise = new Promise<void>((f: () => void) => {
      fulfill = f;
    });
    this._close(() => {
      if (this._onDisconnect) {
        this._onDisconnect.call(null, 'force disconnect');
      }
      fulfill();
    });
    return promise;
  }
}

export async function initMainConnection(
    createMainTarget: () => Promise<void>, websocketConnectionLost: () => void): Promise<void> {
  ProtocolClient.InspectorBackend.Connection.setFactory(createMainConnection.bind(null, websocketConnectionLost));
  await createMainTarget();
  Host.InspectorFrontendHost.InspectorFrontendHostInstance.connectionReady();
  Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(
      Host.InspectorFrontendHostAPI.Events.ReattachMainTarget, () => {
        const target = TargetManager.instance().mainTarget();
        if (target) {
          const router = target.router();
          if (router) {
            router.connection().disconnect();
          }
        }
        createMainTarget();
      });
}

// TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
// eslint-disable-next-line @typescript-eslint/naming-convention
export function createMainConnection(websocketConnectionLost: () => void): ProtocolClient.InspectorBackend.Connection {
  return new LynxConnection(websocketConnectionLost);
}
