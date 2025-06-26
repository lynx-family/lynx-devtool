// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { TraceConfig } from '../types/trace';
import { IDebugDriver } from "@lynx-js/devtool-plugin-core/renderer";

export const sendTraceCommand = async (debugDriver: IDebugDriver, method: string, customConfig: any) => {
  const config: TraceConfig = {
    recordMode: 'recordContinuously',
    includedCategories: ['*'],
    excludedCategories: ['*'],
    enableSystrace: false,
    bufferSize: 200 * 1024,
    JSProfileInterval: 0,
    ...customConfig
  };
  const params = {
    method,
    params: {
      streamCompression: 'none',
      streamFormat: 'json',
      traceConfig: config,
      transferMode: 'ReturnAsStream'
    },
    sessionId: -1
  };
  const result = await debugDriver.sendCustomMessageAsync({ params });
  return result;
};

export const sendIOReadMessage = (debugDriver: IDebugDriver, stream: number) => {
  const params = {
    method: 'IO.read',
    session_id: -1,
    params: { handle: stream, size: 1024 * 1024 }
  };
  return debugDriver.sendCustomMessageAsync({ params });
};