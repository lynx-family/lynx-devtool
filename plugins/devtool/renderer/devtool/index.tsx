// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable max-lines-per-function */
import { ECustomDataType, ICustomDataWrapper } from '@lynx-js/remote-debug-driver';
import React, { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { GlobalContext } from '..';
import { sendEventToSimulator } from './electron';
import { devtoolActionHandler, getCdpMessageDispatcher, getPluginDriver } from './services';
import { IDeviceInfo, InspectorType } from './types';
import { Empty, Spin } from 'antd';

const CODEX_CONTEXT_STORAGE_KEY = 'lynx-devtool:codex-context';
const CODEX_CONTEXT_EVENT_NAME = 'lynx-devtool:codex-context';

type CodexContextPayload = {
  id?: string;
  label?: string;
  text?: string;
  createdAt?: number;
  autoSend?: boolean;
  source?: string;
};

type CodexContextInput =
  | string
  | (CodexContextPayload & {
      includeBaseContext?: boolean;
    });

function parseStoredCodexPayloads(rawPayloads: string | null): CodexContextPayload[] {
  if (!rawPayloads) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawPayloads) as CodexContextPayload | CodexContextPayload[];
    const payloads = Array.isArray(parsed) ? parsed : [parsed];
    return payloads.filter((payload) => typeof payload?.text === 'string' && payload.text.trim().length > 0);
  } catch (_) {
    return [];
  }
}

function createCodexContextId() {
  return `codex-context-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function labelForCodexContextSource(source?: string) {
  switch (source) {
    case 'elements-selection':
      return 'Elements context';
    case 'console-selection':
      return 'Console context';
    case 'devtool-panel':
      return 'DevTool context';
    default:
      return 'Context';
  }
}

export interface IDevToolProps {
  clientId: number;
  sessionId: number;
  inspectorType: InspectorType;
  landingPage?: React.ReactNode;
  showPanels?: string[];
  info?: IDeviceInfo;
  keepCardOpen?: boolean;
  wsUrl?: string;
  roomId?: string;
  inspectorUrl?: string;
  // TODO: type def use common packages
  plugins?: Record<string, any>[];
}

export const DevTool: React.FC<IDevToolProps> = (props: IDevToolProps) => {
  const iframeElement = useRef<any>();
  const iframeOnMessageRef = useRef<{ onMessage: (event: MessageEvent) => void }>();
  const mainWindowOnMessageRef = useRef<{ onMessage: (event: MessageEvent) => void }>();
  const { debugDriver, switchView } = useContext(GlobalContext);
  const { sessionId, clientId, inspectorUrl, inspectorType, info, showPanels, plugins } = props;

  const sendGenericMessageToIframe = useCallback((type: string, content?: unknown) => {
    const targetWindow = iframeElement.current?.contentWindow;
    if (!targetWindow) {
      return;
    }
    targetWindow.postMessage({ type, content }, '*');
  }, []);
  const sendMessageToIframe = (message: ICustomDataWrapper<ECustomDataType.CDP>) => {
    const targetWindow = iframeElement.current?.contentWindow;
    if (!targetWindow) {
      return;
    }
    sendGenericMessageToIframe('lynx_message', {
      type: message.type,
      message: message.data.message
    });
  };
  const lynxOpen = useCallback(() => {
    const sessionInfo = info?.sessions.find((session) => session.session_id === sessionId);
    const data = {
      wsUrl: props.wsUrl,
      roomId: props.roomId,
      sessionId,
      info: info?.info,
      sessionUrl: sessionInfo?.url || ''
    };
    sendGenericMessageToIframe('lynx_open', data);
    // Register message listener for lynx communication interface
    const messages = getCdpMessageDispatcher().listen4ClientIdAndSessionId(clientId, sessionId, sendMessageToIframe);
    getPluginDriver().registerCallback(sendMessageToIframe);
    if (messages) {
      for (const message of messages) {
        sendGenericMessageToIframe('lynx_message', {
          type: message.type,
          message: message.data.message
        });
      }
    }
  }, [props]);

  const defaultLandingPage = () => {
    if (!clientId || clientId <= 0) {
      return <Empty description="Please connect device" />;
    }
    return info?.sessions?.length === 0 ? <Empty description="Please open a card" /> : <Spin />;
  };

  const onLoad = () => {
    // Call methods in props to handle/forward messages after receiving iframe messages
    const onMessage = (event: MessageEvent) => {
      if (!event.data) {
        return;
      }
      if (event.data.event === 'simulator') {
        sendEventToSimulator(event.data.data);
        return;
      }
      // Only process messages from the same sessionId
      if (event.data.sessionId && event.data.sessionId !== sessionId) {
        return;
      }

      // Handle iframe communication from inside to outside
      const { content, type } = event.data;
      if (type === 'codex_send_context') {
        // Allow focused inspector views to push local debugging context into
        // Codex while keeping the current session metadata attached.
        dispatchCodexContext(content as CodexContextInput);
        return;
      }

      if (type) {
        devtoolActionHandler.handle(type, content);
      }

      // TODO: refactor into devtoolActionHandler
      switch (event.data.type) {
        // Initialize data, dynamic plugin configuration
        case 'iframe_init':
          console.log('iframe init', event);
          sendGenericMessageToIframe('inject_data', {
            info: info?.info ?? {},
            plugins: plugins ?? []
          });
          break;
        // Compatible with webview inspector interface
        case 'iframe_loaded':
          console.log('iframe loaded', event);
          lynxOpen();
          break;
        // Call lynx communication interface to forward messages
        case 'send_message':
          debugDriver.sendCustomMessage({
            type: content.type,
            clientId,
            sessionId,
            params: content.message
          });
          break;
        default:
          break;
      }
    };
    if (iframeOnMessageRef.current) {
      window.removeEventListener('message', iframeOnMessageRef.current.onMessage);
    }
    iframeOnMessageRef.current = { onMessage };
    window.addEventListener('message', onMessage);

    // Main window message listener
    const mainWindowOnMessage = (event: MessageEvent): void => {
      // Only process messages from the same sessionId
      if (event.data.sessionId && event.data.sessionId !== sessionId) {
        return;
      }

      const { content, type } = event.data;
      // a11y business logic
      if (type === 'a11y_mark_lynx') {
        sendGenericMessageToIframe('a11y_mark_lynx', content);
      }
    };
    if (mainWindowOnMessageRef.current) {
      window.parent.removeEventListener('message', mainWindowOnMessageRef.current.onMessage);
    }
    mainWindowOnMessageRef.current = { onMessage: mainWindowOnMessage };
    window.parent.addEventListener('message', mainWindowOnMessage);
  };

  const inspectUrl = useMemo(() => {
    return `${
      inspectorUrl ?? ('') // TODO(talisk): fallback url
    }?sessionId=${sessionId}&clientId=${clientId}&ldtVersion=${info?.info?.ldtVersion}&showPanels=${showPanels?.join(
      ','
    )}&sdkVersion=${info?.info?.sdkVersion}`;
  }, [clientId, sessionId, inspectorType, inspectorUrl, showPanels, info]);

  const codexContextText = useMemo(() => {
    const sessionInfo = info?.sessions.find((session) => session.session_id === sessionId);
    const deviceInfo = info?.info ?? {};
    const contextLines = [
      'Lynx DevTool session context',
      '',
      'Session:',
      `- clientId: ${clientId || 'unknown'}`,
      `- sessionId: ${sessionId || 'unknown'}`,
      `- inspectorType: ${inspectorType || 'unknown'}`,
      `- sessionUrl: ${sessionInfo?.url || 'unknown'}`,
      '',
      'Environment:',
      `- app: ${deviceInfo.App || 'unknown'} ${deviceInfo.AppVersion || ''}`.trim(),
      `- deviceModel: ${deviceInfo.deviceModel || 'unknown'}`,
      `- os: ${deviceInfo.osType || 'unknown'} ${deviceInfo.osVersion || ''}`.trim(),
      `- sdkVersion: ${deviceInfo.sdkVersion || 'unknown'}`,
      `- ldtVersion: ${deviceInfo.ldtVersion || 'unknown'}`,
      `- network: ${deviceInfo.network || 'unknown'}`
    ];

    return contextLines.join('\n');
  }, [clientId, info, inspectorType, sessionId]);

  const dispatchCodexContext = useCallback((payloadInput?: CodexContextInput) => {
    const includeBaseContext =
      typeof payloadInput === 'string' ? true : payloadInput?.includeBaseContext !== false;
    const extraText = typeof payloadInput === 'string' ? payloadInput : payloadInput?.text;
    const contextSections = [
      includeBaseContext ? codexContextText : '',
      typeof extraText === 'string' ? extraText.trim() : ''
    ].filter(Boolean);

    if (contextSections.length === 0) {
      return;
    }

    const payload: CodexContextPayload = {
      id: typeof payloadInput === 'string' ? createCodexContextId() : payloadInput?.id ?? createCodexContextId(),
      label:
        typeof payloadInput === 'string'
          ? labelForCodexContextSource('devtool-panel')
          : payloadInput?.label ?? labelForCodexContextSource(payloadInput?.source),
      text: contextSections.join('\n\n'),
      createdAt: typeof payloadInput === 'string' ? Date.now() : payloadInput?.createdAt ?? Date.now(),
      autoSend: typeof payloadInput === 'string' ? false : payloadInput?.autoSend ?? false,
      source: typeof payloadInput === 'string' ? 'devtool-panel' : payloadInput?.source ?? 'devtool-panel'
    };

    const storedPayloads = parseStoredCodexPayloads(sessionStorage.getItem(CODEX_CONTEXT_STORAGE_KEY));
    sessionStorage.setItem(CODEX_CONTEXT_STORAGE_KEY, JSON.stringify([...storedPayloads, payload]));
    window.dispatchEvent(new CustomEvent(CODEX_CONTEXT_EVENT_NAME, { detail: payload }));
    switchView({ pluginId: 'codex-agent' });
  }, [codexContextText, switchView]);

  useEffect(() => {
    const onInspectMessage = (_: any, data: any) => {
      sendGenericMessageToIframe('inspect-devtool-message', data);
    };

    window.ldtElectronAPI?.on('inspect-devtool-message', onInspectMessage);

    return () => {
      if (iframeOnMessageRef.current?.onMessage) {
        window.removeEventListener('message', iframeOnMessageRef.current.onMessage);
        getCdpMessageDispatcher().remove4ChildIdAndSessionId(clientId, sessionId);
      }
      if (mainWindowOnMessageRef.current?.onMessage) {
        window.parent?.removeEventListener('message', mainWindowOnMessageRef.current.onMessage);
      }
      window.ldtElectronAPI?.off('inspect-devtool-message', onInspectMessage);
    };
  }, [clientId, dispatchCodexContext, sessionId, inspectorType, inspectorUrl]);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {clientId > 0 && sessionId > 0 ? (
        <iframe
          key={`${clientId}-${sessionId}`}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          ref={iframeElement}
          onLoad={onLoad}
          src={inspectUrl}
        />
      ) : (
        props.landingPage || (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {defaultLandingPage()}
          </div>
        )
      )}
    </div>
  );
};
