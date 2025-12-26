// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable max-depth */
import {
  definePlugin,
  EDebugDriverClientEventNames,
  EnvLogLevelType,
  IDebugDriverEvent2Payload,
  IDevice,
  IDeviceInfo,
  RendererContext
} from '@lynx-js/devtool-plugin-core/renderer';
import React, { createContext, useEffect, useState } from 'react';
import { AsyncBridgeType } from '../bridge';
import { DevTool, IDevToolProps } from './devtool';
import { devtoolActionHandler, getCdpMessageDispatcher } from './devtool/services';
import './index.scss';
import { LDTPlatformPluginForUser } from './devtool/types';
import { createCustomData } from '@lynx-js/remote-debug-driver';
import { ECustomDataType } from '@lynx-js/remote-debug-driver';
import { PLUGIN_EVENT_GET_PLATFORM_PLUGINS } from '../../../src/constants/event';

export const GlobalContext = createContext<RendererContext<AsyncBridgeType>>({} as any);
// eslint-disable-next-line max-lines-per-function
export default definePlugin<AsyncBridgeType>((context) => {
  const {
    debugDriver,
    asyncBridge,
    getStore,
    logger: { sendEvent, sendEnvLog }
  } = context;
  const { fetch, useUser } = (context as any).ldt;
  const { ConnectionView } = (context as any).components;
  const { user } = getStore(useUser);
  getCdpMessageDispatcher().bootstrap(debugDriver);

  const clientId = debugDriver.getSelectClientId();
  const props = {} as IDevToolProps;
  if (clientId) {
    props.clientId = clientId;
    const clientInfo = debugDriver.getClientInfo(clientId) as IDeviceInfo;
    const device = debugDriver.getDeviceInfo(clientId);
    if (clientInfo) {
      props.sessionId = clientInfo.selectedSession?.session_id || -1;
      props.inspectorType = clientInfo.selectedSession?.type || '';
      props.info = {
        clientId,
        info: {
          ...device?.info
        } as any,
        sessions: clientInfo.sessions || []
      };
    }
  }
  props.landingPage = <ConnectionView />;

  const Index = () => {
    const [devtoolProps, setDevtoolProps] = useState<IDevToolProps>(props);
    const { selectedDevice, deviceInfoMap, setDeviceInfoMap } = context.useConnection();

    useEffect(() => {
      const onSessionWillChange = ({
        oldSession
      }: IDebugDriverEvent2Payload[EDebugDriverClientEventNames.SessionWillChange]) => {
        // send disable to all targets of the old session
        if (oldSession && oldSession.targets) {
          oldSession.targets.forEach((target) => {
            debugDriver.sendCustomMessageAsync({
              sessionId: oldSession.session_id,
              type: ECustomDataType.CDP,
              params: {
                method: 'Debugger.disable',
                sessionId: target
              }
            });
            debugDriver.sendCustomMessageAsync({
              sessionId: oldSession.session_id,
              type: ECustomDataType.CDP,
              params: {
                method: 'Runtime.disable',
                sessionId: target
              }
            });
          });
        }
      };
      const onSessionChange = async ({ device, sessionId, deviceInfo }) => {
        devtoolProps.clientId = device.clientId;
        devtoolProps.sessionId = sessionId;
        devtoolProps.inspectorType = deviceInfo?.selectedSession?.type;
        devtoolProps.info = {
          clientId: device.clientId,
          info: {
            ...device.info
          },
          sessions: deviceInfo?.sessions ?? []
        };
        try {
          devtoolProps.inspectorUrl = await asyncBridge.getInspectUrl(
            devtoolProps.inspectorType === 'web' ? 'web' : 'lynx'
          );
        } catch (error) {
          console.error('Failed to get inspect URL:', error);
          // Set a default URL or keep the original URL
          devtoolProps.inspectorUrl = devtoolProps.inspectorUrl || '';
        }

        setDevtoolProps({ ...devtoolProps });
      };
      const onClientChange = ({ device }) => {
        // @ts-ignore
        window.ldtElectronAPI
          .invoke(PLUGIN_EVENT_GET_PLATFORM_PLUGINS, {})
          .then((platformPlugins) => {
            devtoolProps.clientId = device.clientId || -1;
            devtoolProps.plugins = platformPlugins;
            setDevtoolProps({ ...devtoolProps });
          });
      };

      debugDriver.on(EDebugDriverClientEventNames.ClientChange, onClientChange);
      debugDriver.on(EDebugDriverClientEventNames.SessionChange, onSessionChange);
      debugDriver.on(EDebugDriverClientEventNames.SessionWillChange, onSessionWillChange);
      asyncBridge.getInspectUrl().then((url) => {
        devtoolProps.inspectorUrl = url || '';
        setDevtoolProps({ ...devtoolProps });
      }).catch((error) => {
        console.error('Failed to get initial inspect URL:', error);
        devtoolProps.inspectorUrl = '';
        setDevtoolProps({ ...devtoolProps });
      });

      return () => {
        debugDriver.off(EDebugDriverClientEventNames.ClientChange, onClientChange);
        debugDriver.off(EDebugDriverClientEventNames.SessionChange, onSessionChange);
        debugDriver.off(EDebugDriverClientEventNames.SessionWillChange, onSessionWillChange);
      };
    }, []);

    useEffect(() => {
      // devtool action handlers
      const statisticsHandler = (params: any[]) => {
        if (params && params.length > 1 && params[0] === 'sendEvent') {
          sendEvent(params[1]);
        }
      };
      // TODO: fix type
      const envLogHandler = (params: any) => {
        const { level, module, tag, msg, extra } = params;
        sendEnvLog({
          level,
          msg,
          categories: {
            module,
            tag,
            extra
          }
        });
      };
      const devtoolWSMsgMonitor = (params: any) => {
        sendEnvLog({
          level: EnvLogLevelType.Info,
          msg: createCustomData(params.type, {
            client_id: selectedDevice.clientId ?? 0,
            session_id: deviceInfoMap[selectedDevice.clientId ?? 0]?.selectedSession?.session_id ?? 0,
            message: params.message
          }),
          categories: {
            module: 'Devtool',
            tag: 'sendMsg'
          }
        });
      };
      const delayHandler = async (params: any) => {
        const delay = Number(params);
        // TODO: Delay value UI
        // updateDelay(delay);
        const devtoolWSUrl = await debugDriver.getRemoteSchema(undefined);
        sendEvent({
          name: 'devtool_network_delay',
          metrics: {
            networkDelay: delay
          },
          categories: {
            devtoolWSUrl,
            networkType: selectedDevice.info?.network ?? 'WiFi',
            lynxVersion: selectedDevice.info?.sdkVersion ?? 'unknown'
          }
        });
      };
      const sessionTargetHandler = (msgObject: Record<string, any>) => {
        const newDeviceInfoMap = { ...deviceInfoMap };
        const session = newDeviceInfoMap[selectedDevice.clientId ?? 0]?.selectedSession;
        if (!session) {
          return;
        }
        const { type, info } = msgObject;
        const { sessionId } = info;
        if (!sessionId) {
          return;
        }
        if (type === 'target_attached') {
          if (!session.targets) {
            session.targets = new Set();
          }
          session.targets.add(sessionId);
        } else if (type === 'target_detached') {
          if (session.targets) {
            session.targets.delete(sessionId);
          }
        }
        setDeviceInfoMap(newDeviceInfoMap);
      };

      devtoolActionHandler.registerHandler('statistics', statisticsHandler);
      devtoolActionHandler.registerHandler('addEnvLog', envLogHandler);
      devtoolActionHandler.registerHandler('send_message', devtoolWSMsgMonitor);
      devtoolActionHandler.registerHandler('update_delay', delayHandler);
      devtoolActionHandler.registerHandler('update_session_target', sessionTargetHandler);

      return () => {
        devtoolActionHandler.removeHandler('statistics', statisticsHandler);
        devtoolActionHandler.removeHandler('addEnvLog', envLogHandler);
        devtoolActionHandler.removeHandler('send_message', devtoolWSMsgMonitor);
        devtoolActionHandler.removeHandler('update_delay', delayHandler);
        devtoolActionHandler.removeHandler('update_session_target', sessionTargetHandler);
      };
    }, []);

    return (
      <GlobalContext.Provider value={context}>
        <DevTool {...devtoolProps} />
      </GlobalContext.Provider>
    );
  };
  return Index;
});
