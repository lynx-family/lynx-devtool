// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { definePlugin, EDebugDriverClientEventNames } from '@lynx-js/devtool-plugin-core/renderer';
import React, { useEffect, useState } from 'react';
import { RendererContext } from '@lynx-js/devtool-plugin-core/renderer';
import { AsyncBridgeType } from '../bridge';
import { ILynxTraceProps } from './types/trace';
import { GlobalContext } from './utils/context';
import TraceView from './Trace';

export default definePlugin<AsyncBridgeType>((context: RendererContext<AsyncBridgeType>) => {
  const {
    debugDriver,
  } = context;
  const clientId = debugDriver.getSelectClientId();
  const device = debugDriver.getDeviceInfo(clientId ?? -1);
  const props = {} as ILynxTraceProps;
  if (clientId && device) {
    props.clientId = clientId;
    props.info = device.info;
  }
  const Index: React.FC = () => {
    const [traceProps, setTraceProps] = useState<ILynxTraceProps>(props);
  
    useEffect(() => {
      const onSessionChange = async ({ device, }) => {
        setTraceProps({
          clientId: device.clientId ?? -1,
          info: device.info,
        });
      };
      const onClientChange = ({ device }) => {
        setTraceProps({
          clientId: device.clientId ?? -1,
          info: device.info,
        });
      };
  
      debugDriver.on(EDebugDriverClientEventNames.ClientChange, onClientChange);
      debugDriver.on(EDebugDriverClientEventNames.SessionChange, onSessionChange);
  
      return () => {
        debugDriver.off(EDebugDriverClientEventNames.ClientChange, onClientChange);
        debugDriver.off(EDebugDriverClientEventNames.SessionChange, onSessionChange);
      };
    }, []);
    return (
      <GlobalContext.Provider value={context}>
        <TraceView {...traceProps}/>
      </GlobalContext.Provider>
    )
  };

  return Index;
});
