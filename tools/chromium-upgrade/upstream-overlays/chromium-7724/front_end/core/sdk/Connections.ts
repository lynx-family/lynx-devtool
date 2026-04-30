// Copyright 2015 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../core/i18n/i18n.js';
import * as Common from '../common/common.js';
import * as Host from '../host/host.js';
import type * as Platform from '../platform/platform.js';
import * as ProtocolClient from '../protocol_client/protocol_client.js';
import * as Root from '../root/root.js';

import {RehydratingConnectionTransport} from './RehydratingConnection.js';
import {TargetManager} from './TargetManager.js';

const UIStrings = {
  /**
   * @description Text on the remote debugging window to indicate the connection is lost
   */
  websocketDisconnected: 'WebSocket disconnected',
} as const;
const str_ = i18n.i18n.registerUIStrings('core/sdk/Connections.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

type LynxMessageContent = {
  type?: string;
  message?: string|boolean|Record<string, unknown>|null;
  [key: string]: unknown;
};

type LynxEnvelope = {
  type?: string;
  content?: LynxMessageContent;
  sessionId?: string|number;
};

type LynxWindow = typeof window&{
  devtoolStatsRecording?: boolean;
  runLighthouse?: boolean;
  lighthouseSessionId?: string;
  wsUrl?: string;
  roomId?: string;
  sessionId?: string|number;
  info?: Record<string, unknown>;
  sessionUrl?: string;
  logPluginExpression?: (message: string) => void;
};

let activeLynxTransport: LynxConnectionTransport|null = null;

export class MainConnection implements ProtocolClient.ConnectionTransport.ConnectionTransport {
  onMessage: ((arg0: Object|string) => void)|null = null;
  #onDisconnect: ((arg0: string) => void)|null = null;
  #messageBuffer = '';
  #messageSize = 0;
  readonly #eventListeners: Common.EventTarget.EventDescriptor[];
  constructor() {
    this.#eventListeners = [
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(
          Host.InspectorFrontendHostAPI.Events.DispatchMessage, this.dispatchMessage, this),
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(
          Host.InspectorFrontendHostAPI.Events.DispatchMessageChunk, this.dispatchMessageChunk, this),
    ];
  }

  setOnMessage(onMessage: (arg0: Object|string) => void): void {
    this.onMessage = onMessage;
  }

  setOnDisconnect(onDisconnect: (arg0: string) => void): void {
    this.#onDisconnect = onDisconnect;
  }

  sendRawMessage(message: string): void {
    if (this.onMessage) {
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.sendMessageToBackend(message);
    }
  }

  private dispatchMessage(event: Common.EventTarget.EventTargetEvent<string>): void {
    if (this.onMessage) {
      this.onMessage.call(null, event.data);
    }
  }

  private dispatchMessageChunk(
      event: Common.EventTarget.EventTargetEvent<Host.InspectorFrontendHostAPI.DispatchMessageChunkEvent>): void {
    const {messageChunk, messageSize} = event.data;
    if (messageSize) {
      this.#messageBuffer = '';
      this.#messageSize = messageSize;
    }
    this.#messageBuffer += messageChunk;
    if (this.#messageBuffer.length === this.#messageSize && this.onMessage) {
      this.onMessage.call(null, this.#messageBuffer);
      this.#messageBuffer = '';
      this.#messageSize = 0;
    }
  }

  async disconnect(): Promise<void> {
    const onDisconnect = this.#onDisconnect;
    Common.EventTarget.removeEventListeners(this.#eventListeners);
    this.#onDisconnect = null;
    this.onMessage = null;

    if (onDisconnect) {
      onDisconnect.call(null, 'force disconnect');
    }
  }
}

export class WebSocketTransport implements ProtocolClient.ConnectionTransport.ConnectionTransport {
  #socket: WebSocket|null;
  onMessage: ((arg0: Object|string) => void)|null = null;
  #onDisconnect: ((arg0: string) => void)|null = null;
  #onWebSocketDisconnect: ((message: Platform.UIString.LocalizedString) => void)|null;
  #connected = false;
  #messages: string[] = [];
  constructor(
      url: Platform.DevToolsPath.UrlString,
      onWebSocketDisconnect: (message: Platform.UIString.LocalizedString) => void) {
    this.#socket = new WebSocket(url);
    this.#socket.onerror = this.onError.bind(this);
    this.#socket.onopen = this.onOpen.bind(this);
    this.#socket.onmessage = (messageEvent: MessageEvent<string>): void => {
      if (this.onMessage) {
        this.onMessage.call(null, messageEvent.data);
      }
    };
    this.#socket.onclose = this.onClose.bind(this);

    this.#onWebSocketDisconnect = onWebSocketDisconnect;
  }

  setOnMessage(onMessage: (arg0: Object|string) => void): void {
    this.onMessage = onMessage;
  }

  setOnDisconnect(onDisconnect: (arg0: string) => void): void {
    this.#onDisconnect = onDisconnect;
  }

  private onError(): void {
    if (this.#onWebSocketDisconnect) {
      this.#onWebSocketDisconnect.call(null, i18nString(UIStrings.websocketDisconnected));
    }
    if (this.#onDisconnect) {
      // This is called if error occurred while connecting.
      this.#onDisconnect.call(null, 'connection failed');
    }
    this.close();
  }

  private onOpen(): void {
    this.#connected = true;
    if (this.#socket) {
      this.#socket.onerror = console.error;
      for (const message of this.#messages) {
        this.#socket.send(message);
      }
    }
    this.#messages = [];
  }

  private onClose(): void {
    if (this.#onWebSocketDisconnect) {
      this.#onWebSocketDisconnect.call(null, i18nString(UIStrings.websocketDisconnected));
    }
    if (this.#onDisconnect) {
      this.#onDisconnect.call(null, 'websocket closed');
    }
    this.close();
  }

  private close(callback?: (() => void)): void {
    if (this.#socket) {
      this.#socket.onerror = null;
      this.#socket.onopen = null;
      this.#socket.onclose = callback || null;
      this.#socket.onmessage = null;
      this.#socket.close();
      this.#socket = null;
    }
    this.#onWebSocketDisconnect = null;
  }

  sendRawMessage(message: string): void {
    if (this.#connected && this.#socket) {
      this.#socket.send(message);
    } else {
      this.#messages.push(message);
    }
  }

  disconnect(): Promise<void> {
    return new Promise(fulfill => {
      this.close(() => {
        if (this.#onDisconnect) {
          this.#onDisconnect.call(null, 'force disconnect');
        }
        fulfill();
      });
    });
  }
}

export class StubTransport implements ProtocolClient.ConnectionTransport.ConnectionTransport {
  onMessage: ((arg0: Object|string) => void)|null = null;
  #onDisconnect: ((arg0: string) => void)|null = null;

  setOnMessage(onMessage: (arg0: Object|string) => void): void {
    this.onMessage = onMessage;
  }

  setOnDisconnect(onDisconnect: (arg0: string) => void): void {
    this.#onDisconnect = onDisconnect;
  }

  sendRawMessage(message: string): void {
    window.setTimeout(this.respondWithError.bind(this, message), 0);
  }

  private respondWithError(message: string): void {
    const messageObject = JSON.parse(message);
    const error = {
      message: 'This is a stub connection, can\'t dispatch message.',
      code: ProtocolClient.CDPConnection.CDPErrorStatus.DEVTOOLS_STUB_ERROR,
      data: messageObject,
    };
    if (this.onMessage) {
      this.onMessage.call(null, {id: messageObject.id, error});
    }
  }

  async disconnect(): Promise<void> {
    if (this.#onDisconnect) {
      this.#onDisconnect.call(null, 'force disconnect');
    }
    this.#onDisconnect = null;
    this.onMessage = null;
  }
}

export class LynxConnectionTransport implements ProtocolClient.ConnectionTransport.ConnectionTransport {
  onMessage: ((arg0: Object|string) => void)|null = null;
  #onDisconnect: ((arg0: string) => void)|null = null;
  #onWebSocketDisconnect: ((message: Platform.UIString.LocalizedString) => void)|null;
  #connected = false;
  #messages: string[] = [];
  #screenCastFrame = false;
  readonly #documentMessageListener: EventListener;
  readonly #windowMessageListener: (event: MessageEvent<LynxEnvelope>) => void;

  constructor(onWebSocketDisconnect: (message: Platform.UIString.LocalizedString) => void) {
    this.#onWebSocketDisconnect = onWebSocketDisconnect;
    this.#documentMessageListener = this.handleDocumentMessage.bind(this) as EventListener;
    this.#windowMessageListener = this.handleWindowMessage.bind(this);

    globalThis.document.addEventListener('lynx_message', this.#documentMessageListener);
    globalThis.addEventListener('message', this.#windowMessageListener);

    Host.InspectorFrontendHost.sendWindowMessage({type: 'iframe_loaded'});
  }

  setOnMessage(onMessage: (arg0: Object|string) => void): void {
    this.onMessage = onMessage;
  }

  setOnDisconnect(onDisconnect: (arg0: string) => void): void {
    this.#onDisconnect = onDisconnect;
  }

  sendRawMessage(message: string): void {
    if (this.#connected) {
      Host.InspectorFrontendHost.sendWindowMessage({
        type: 'send_message',
        content: {
          type: 'CDP',
          message,
        },
      });
      return;
    }
    this.#messages.push(message);
  }

  disconnect(): Promise<void> {
    return new Promise(fulfill => {
      const onDisconnect = this.#onDisconnect;
      this.close();
      this.#onDisconnect = null;
      this.onMessage = null;
      if (activeLynxTransport === this) {
        activeLynxTransport = null;
      }
      onDisconnect?.call(null, 'force disconnect');
      fulfill();
    });
  }

  private handleDocumentMessage(event: Event): void {
    if (!this.onMessage) {
      return;
    }
    const messageEvent = event as MessageEvent<string>&CustomEvent<string>;
    const message = messageEvent.data ?? messageEvent.detail;
    if (message !== undefined) {
      this.onMessage.call(null, message);
    }
  }

  private handleWindowMessage(event: MessageEvent<LynxEnvelope>): void {
    const data = event.data;
    if (!data?.type) {
      return;
    }
    const content = data.content;
    switch (data.type) {
      case 'lynx_open':
        this.onOpen(content);
        Host.InspectorFrontendHost.sendWindowMessage({
          type: 'update_loading_progress',
          content: {
            timestamp: Date.now(),
            type: 'lynx_open',
            message: null,
          },
        });
        break;
      case 'lynx_message':
        this.handleLynxMessage(content);
        break;
      case 'devtool_stats':
        if (content?.type === 'change_recording') {
          const globalWindow = globalThis as LynxWindow;
          globalWindow.devtoolStatsRecording = Boolean(content.message);
          Host.InspectorFrontendHost.sendWindowMessage({
            type: 'devtool_stats',
            content: {
              type: 'change_recording_resp',
              message: '',
            },
          });
        }
        break;
      case 'a11y_mark_lynx':
        if (content?.type === 'console_log' && typeof content.message === 'string') {
          const globalWindow = globalThis as LynxWindow;
          globalWindow.logPluginExpression?.(content.message);
        }
        break;
      default:
        break;
    }
  }

  private handleLynxMessage(content?: LynxMessageContent): void {
    if (!content) {
      return;
    }

    const globalWindow = globalThis as LynxWindow;
    if (globalWindow.devtoolStatsRecording) {
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

    if (!this.onMessage) {
      return;
    }

    if (content.type === 'CDP') {
      const rawMessage = typeof content.message === 'string' ? content.message : JSON.stringify(content.message ?? {});
      if (globalWindow.runLighthouse) {
        const messageObject = JSON.parse(rawMessage) as ProtocolClient.InspectorBackend.Message;
        messageObject.sessionId = globalWindow.lighthouseSessionId;
        this.onMessage.call(null, JSON.stringify(messageObject));
        return;
      }

      this.onMessage.call(null, rawMessage);
      if (!this.#screenCastFrame && rawMessage.includes('Page.screencastFrame')) {
        Host.InspectorFrontendHost.sendWindowMessage({
          type: 'update_loading_progress',
          content: {
            timestamp: Date.now(),
            type: 'first_screencastframe',
            message: null,
          },
        });
        Host.InspectorFrontendHost.sendWindowMessage({
          type: 'update_screenFrameTime',
          content: `${Date.now()}`,
        });
        this.#screenCastFrame = true;
      }
      return;
    }

    if (content.type === 'xdb_lynx_event') {
      Host.InspectorFrontendHost.sendWindowMessage({
        type: content.type,
        content: content.message,
      });
    }
  }

  private onOpen(msg?: LynxMessageContent): void {
    const globalWindow = globalThis as LynxWindow;
    globalWindow.wsUrl = typeof msg?.wsUrl === 'string' ? msg.wsUrl : undefined;
    globalWindow.roomId = typeof msg?.roomId === 'string' ? msg.roomId : undefined;
    globalWindow.sessionId = typeof msg?.sessionId === 'string' || typeof msg?.sessionId === 'number' ? msg.sessionId : undefined;
    globalWindow.info = typeof msg?.info === 'object' && msg.info ? msg.info as Record<string, unknown> : undefined;
    globalWindow.sessionUrl = typeof msg?.sessionUrl === 'string' ? msg.sessionUrl : undefined;

    this.#connected = true;
    for (const message of this.#messages) {
      Host.InspectorFrontendHost.sendWindowMessage({
        type: 'send_message',
        content: {
          type: 'CDP',
          message,
        },
      });
    }
    this.#messages = [];

    const appId = globalWindow.info?.appId ?? globalWindow.info?.App;
    Host.InspectorFrontendHost.reportToStatistics('devtool_init', {
      type: 'lynx',
      appId,
    });

    let timeout: ReturnType<typeof setTimeout>|null = null;
    if (!globalThis.document.body) {
      return;
    }
    new IntersectionObserver((entries, observer) => {
      if (entries.some(entry => entry.isIntersecting)) {
        if (timeout !== null) {
          return;
        }
        timeout = globalThis.setTimeout(() => {
          observer.unobserve(globalThis.document.body);
          Host.InspectorFrontendHost.reportToStatistics('devtools_active_user', {
            type: 'lynx',
            appId,
          });
        }, 10000);
      } else if (timeout !== null) {
        globalThis.clearTimeout(timeout);
        timeout = null;
      }
    }).observe(globalThis.document.body);
  }

  private close(): void {
    globalThis.document.removeEventListener('lynx_message', this.#documentMessageListener);
    globalThis.removeEventListener('message', this.#windowMessageListener);
    if (activeLynxTransport === this) {
      activeLynxTransport = null;
    }
    this.#onWebSocketDisconnect = null;
  }
}

export async function initMainConnection(
    createRootTarget: () => Promise<void>,
    onConnectionLost: (message: Platform.UIString.LocalizedString) => void): Promise<void> {
  ProtocolClient.ConnectionTransport.ConnectionTransport.setFactory(createMainTransport.bind(null, onConnectionLost));
  await createRootTarget();
  Host.InspectorFrontendHost.InspectorFrontendHostInstance.connectionReady();
  Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(
      Host.InspectorFrontendHostAPI.Events.ReattachMainTarget, () => {
        const target = TargetManager.instance().primaryPageTarget() ?? TargetManager.instance().rootTarget();
        void activeLynxTransport?.disconnect();
        target?.dispose('reattach main target');
        void createRootTarget();
      });
}

function createMainTransport(onConnectionLost: (message: Platform.UIString.LocalizedString) => void):
    ProtocolClient.ConnectionTransport.ConnectionTransport {
  if (Root.Runtime.Runtime.isTraceApp()) {
    return new RehydratingConnectionTransport(onConnectionLost);
  }

  const wsParam = Root.Runtime.Runtime.queryParam('ws');
  const wssParam = Root.Runtime.Runtime.queryParam('wss');
  if (wsParam || wssParam) {
    const ws = (wsParam ? `ws://${wsParam}` : `wss://${wssParam}`) as Platform.DevToolsPath.UrlString;
    return new WebSocketTransport(ws, onConnectionLost);
  }

  if (isLynxHostedMode()) {
    activeLynxTransport = new LynxConnectionTransport(onConnectionLost);
    return activeLynxTransport;
  }

  const notEmbeddedOrWs = Host.InspectorFrontendHost.InspectorFrontendHostInstance.isHostedMode();
  if (notEmbeddedOrWs) {
    // eg., hosted mode (e.g. `http://localhost:9222/devtools/inspector.html`) without a WebSocket URL,
    return new StubTransport();
  }

  return new MainConnection();
}

function isLynxHostedMode(): boolean {
  return Boolean(Root.Runtime.Runtime.queryParam('sessionId') && Root.Runtime.Runtime.queryParam('clientId'));
}
