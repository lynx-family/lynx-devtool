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
  const iframeBootstrapRef = useRef<{ injectedKey?: string; openedKey?: string }>({});
  const bootstrapRetryTimersRef = useRef<number[]>([]);
  const { debugDriver } = useContext(GlobalContext);
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

  const injectInspectorData = useCallback(() => {
    sendGenericMessageToIframe('inject_data', {
      info: info?.info ?? {},
      plugins: plugins ?? []
    });
  }, [sendGenericMessageToIframe, info, plugins]);

  const clearBootstrapRetries = useCallback(() => {
    bootstrapRetryTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    bootstrapRetryTimersRef.current = [];
  }, []);

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
      if (type) {
        devtoolActionHandler.handle(type, content);
      }

      // TODO: refactor into devtoolActionHandler
      switch (event.data.type) {
        // Initialize data, dynamic plugin configuration
        case 'iframe_init':
          console.log('iframe init', event);
          ensureInjectedData();
          break;
        // Compatible with webview inspector interface
        case 'iframe_loaded':
          console.log('iframe loaded', event);
          ensureLynxOpen();
          break;
        // Call lynx communication interface to forward messages
        case 'send_message':
          clearBootstrapRetries();
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

    // Chromium 7724 can post iframe_loaded/iframe_init before the outer shell
    // starts listening. Finish the parent -> iframe handshake explicitly here.
    scheduleBootstrapHandshake();
  };

  const inspectUrl = useMemo(() => {
    return `${
      inspectorUrl ?? ('') // TODO(talisk): fallback url
    }?sessionId=${sessionId}&clientId=${clientId}&ldtVersion=${info?.info?.ldtVersion}&showPanels=${showPanels?.join(
      ','
    )}&sdkVersion=${info?.info?.sdkVersion}`;
  }, [clientId, sessionId, inspectorType, inspectorUrl, showPanels, info]);
  const canRenderInspectFrame = useMemo(() => {
    return clientId > 0 && sessionId > 0 && Boolean(inspectorUrl);
  }, [clientId, inspectorUrl, sessionId]);

  const iframeBootstrapKey = useMemo(() => {
    return `${clientId}:${sessionId}:${inspectUrl}`;
  }, [clientId, sessionId, inspectUrl]);

  const ensureInjectedData = useCallback(() => {
    if (iframeBootstrapRef.current.injectedKey === iframeBootstrapKey) {
      return;
    }
    injectInspectorData();
    iframeBootstrapRef.current.injectedKey = iframeBootstrapKey;
  }, [iframeBootstrapKey, injectInspectorData]);

  const ensureLynxOpen = useCallback(() => {
    if (iframeBootstrapRef.current.openedKey === iframeBootstrapKey) {
      return;
    }
    lynxOpen();
    iframeBootstrapRef.current.openedKey = iframeBootstrapKey;
  }, [iframeBootstrapKey, lynxOpen]);

  const scheduleBootstrapHandshake = useCallback(() => {
    clearBootstrapRetries();
    [0, 80, 200, 500, 1200].forEach((delay) => {
      const timer = window.setTimeout(() => {
        injectInspectorData();
        lynxOpen();
      }, delay);
      bootstrapRetryTimersRef.current.push(timer);
    });
  }, [clearBootstrapRetries, injectInspectorData, lynxOpen]);

  useEffect(() => {
    iframeBootstrapRef.current = {};
    clearBootstrapRetries();
  }, [inspectUrl, clearBootstrapRetries]);

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
      clearBootstrapRetries();
      window.ldtElectronAPI?.off('inspect-devtool-message', onInspectMessage);
    };
  }, [clientId, sessionId, inspectorType, inspectorUrl, clearBootstrapRetries]);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {canRenderInspectFrame ? (
        <iframe
          key={`${clientId}-${sessionId}`}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          ref={iframeElement}
          onLoad={onLoad}
          src={inspectUrl}
        />
      ) : clientId > 0 && sessionId > 0 ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
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
