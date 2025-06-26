// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { TraceDeviceInfo } from '../types/trace';
import { TRACING_PREFIX } from '../utils/const';
import create from '../utils/flooks';

export type JSProfileType = 'disable' | 'primjs' | 'v8';

export type TraceStoreType = ReturnType<typeof traceStore>;
const traceStore = (store: any) => ({
  enableSystemTrace: true,
  jsProfileType: 'disable' as JSProfileType,
  categories: ['all'],
  traceUrl: null as string | null,
  tracingList: [] as any[],
  uploading: false,
  fileName: null,
  traceStartTimeStamp: 0,
  traceStopTimeStamp: 0,
  traceUploadTimeStamp: 0,
  deviceMap: {} as Record<number, TraceDeviceInfo>,

  setFileName: (fileName: string | null) => {
    store({ fileName });
  },
  setUploading: (uploading: boolean) => {
    store({ uploading });
  },
  setEnableSystemTrace: (enableSystemTrace: boolean) => {
    store({ enableSystemTrace });
  },
  setJSProfileType: (type: JSProfileType) => {
    store({ jsProfileType: type });
  },
  setCategories: (categories: string[]) => {
    store({ categories: [...categories] });
  },
  setTraceUrl: (payload: any) => {
    store({ traceUrl: `${TRACING_PREFIX}&url=${encodeURIComponent(payload)}` });
  },
  setTracingList: (tracingList: any[]) => {
    store({ tracingList: [...tracingList] });
  },
  addTracingUrl: (traceUrl: string | null) => {
    const { tracingList } = store() as TraceStoreType;
    if (!tracingList) {
      store({ tracingList: [] });
    }
    tracingList.push({
      traceUrl,
      date: new Date().toLocaleString('zh-CN', { hour12: false })
    });
  },
  setTraceStartTimeStamp: (timeStamp: number) => {
    store({ traceStartTimeStamp: timeStamp });
  },
  setTraceStopTimeStamp: (timeStamp: number) => {
    store({ traceStopTimeStamp: timeStamp });
  },
  setTraceUploadTimeStamp: (timeStamp: number) => {
    store({ traceUploadTimeStamp: timeStamp });
  },
  setTraceStarting: (clientId: number, value: boolean) => {
    const { deviceMap } = store() as TraceStoreType;
    const deviceInfo = deviceMap[clientId];
    if (deviceInfo) {
      deviceInfo.traceStarting = value;
    } else {
      deviceMap[clientId] = {
        traceStarting: value,
        traceLoading: false,
        traceTimer: null,
        startupTracingDuration: 0
      };
    }
    store({ deviceMap: { ...deviceMap } });
  },
  setTraceLoading: (clientId: number, value: boolean) => {
    const { deviceMap } = store() as TraceStoreType;
    const deviceInfo = deviceMap[clientId];
    if (deviceInfo) {
      deviceInfo.traceLoading = value;
    } else {
      deviceMap[clientId] = {
        traceStarting: false,
        traceLoading: value,
        traceTimer: null,
        startupTracingDuration: 0
      };
    }
    store({ deviceMap: { ...deviceMap } });
  },

  setTraceTimer: (clientId: number, timer: NodeJS.Timeout | null) => {
    const { deviceMap } = store() as TraceStoreType;
    const deviceInfo = deviceMap[clientId];
    if (deviceInfo) {
      deviceInfo.traceTimer = timer;
    } else {
      deviceMap[clientId] = {
        traceStarting: false,
        traceLoading: false,
        traceTimer: timer,
        startupTracingDuration: 0
      };
    }
    store({ deviceMap: { ...deviceMap } });
  },
  setStartupTracingDuration: (clientId: number, value: number) => {
    const { deviceMap } = store() as TraceStoreType;
    const deviceInfo = deviceMap[clientId];
    if (deviceInfo) {
      deviceInfo.startupTracingDuration = value;
    } else {
      deviceMap[clientId] = {
        traceStarting: false,
        traceLoading: false,
        traceTimer: null,
        startupTracingDuration: value
      };
    }
    store({ deviceMap: { ...deviceMap } });
  }
});

const useTrace = create(traceStore);
export default useTrace;
