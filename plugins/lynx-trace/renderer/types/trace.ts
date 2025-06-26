// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface ILynxTraceProps {
  clientId: number;
  info: IDeviceInfo
}

export interface IDeviceInfo {
  clientId?: number;
  [key: string]: any;
  did?: string;
  appId?: string;
  App: string;
  AppVersion: string;
  deviceModel: string;
  network: string;
  osType?: string;
  osVersion: string;
  sdkVersion: string;
  ldtVersion?: string;
}

export interface TraceDeviceInfo {
  traceStarting: boolean;
  traceLoading: boolean;
  traceTimer: NodeJS.Timeout | null;
  startupTracingDuration: number;
}

type RecordMode = 'recordUntilFull' | 'recordContinuously' | 'recordAsMuchAsPossible' | 'echoToConsole';
type MemoryDumpConfig = any;
// type TracingBackend = 'auto' | 'chrome' | 'system';
export type TraceConfig = {
  recordMode?: RecordMode;
  enableSampling?: boolean;
  enableSystrace?: boolean;
  enableArgumentFilter?: boolean;
  includedCategories?: Array<string>;
  excludedCategories?: Array<string>;
  syntheticDelays?: Array<string>;
  memoryDumpConfig?: MemoryDumpConfig;
  bufferSize?: number;
  shmemSize?: number;
  JSProfileInterval?: number;
  JSProfileType?: string;
};

export const TracingMethodStart = 'Tracing.start';
export const TracingMethodEnd = 'Tracing.end';
export const TracingIORead = 'IO.read';
export const TracingSetStartupTracingConfig = 'Tracing.setStartupTracingConfig';
export const TracingGetStartupTracingConfig = 'Tracing.getStartupTracingConfig';
export const TracingGetStartupTracingFile = 'Tracing.getStartupTracingFile';