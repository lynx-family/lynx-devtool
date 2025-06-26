// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import create from '../utils/flooks';

export interface LynxRecorderItem {
  id: number;
  pic: string;
  url: string;
  cdn: string;
  appName?: string;
  deviceModel?: string;
  osType?: string;
  isValid: boolean;
  message: any;
}

export interface LynxRecorderDeviceInfo {
  lynxrecorderStarting: boolean;
  lynxrecorderLoading: boolean;
  lynxrecorderTimer: NodeJS.Timeout | null;
}

export type LynxRecorderStoreType = ReturnType<typeof lynxrecorderStore>;
const lynxrecorderStore = (store: any) => ({
  starting: false,
  loading: false,
  lynxrecorderList: [] as LynxRecorderItem[],
  screenshotMap: {} as any,
  deviceMap: {} as Record<number, LynxRecorderDeviceInfo>,
  setLynxRecorderList: (lynxrecorderList: LynxRecorderItem[]) => {
    store({ lynxrecorderList: [...lynxrecorderList] });
  },
  addLynxRecorderData: (lynxrecorderItem: LynxRecorderItem) => {
    const { lynxrecorderList } = store() as LynxRecorderStoreType;
    lynxrecorderList.unshift(lynxrecorderItem);
    store({ lynxrecorderList: [...lynxrecorderList] });
  },
  removeLynxRecorder: (lynxrecorderId: number) => {
    if (lynxrecorderId) {
      const { lynxrecorderList } = store() as LynxRecorderStoreType;
      store({ lynxrecorderList: lynxrecorderList.filter((lynxrecorder) => lynxrecorder.id !== lynxrecorderId) });
    }
  },
  addScreenshot: (sessionId: number, data: any) => {
    if (sessionId && data) {
      const { screenshotMap } = store() as LynxRecorderStoreType;
      screenshotMap[sessionId.toString()] = data;
      store({ screenshotMap: { ...screenshotMap } });
    }
  },
  removeAllLynxRecorder: () => {
    store({ lynxrecorderList: [] });
  },

  setlynxrecorderStarting: (clientId: number, value: boolean) => {
    const { deviceMap } = store() as LynxRecorderStoreType;
    const deviceInfo = deviceMap[clientId];
    if (deviceInfo) {
      deviceInfo.lynxrecorderStarting = value;
    } else {
      deviceMap[clientId] = {
        lynxrecorderStarting: value,
        lynxrecorderLoading: false,
        lynxrecorderTimer: null
      };
    }
    store({ deviceMap: { ...deviceMap } });
  },
  setlynxrecorderLoading: (clientId: number, value: boolean) => {
    const { deviceMap } = store() as LynxRecorderStoreType;
    const deviceInfo = deviceMap[clientId];
    if (deviceInfo) {
      deviceInfo.lynxrecorderLoading = value;
    } else {
      deviceMap[clientId] = {
        lynxrecorderStarting: false,
        lynxrecorderLoading: value,
        lynxrecorderTimer: null
      };
    }
    store({ deviceMap: { ...deviceMap } });
  },
  setlynxrecorderTimer: (clientId: number, timer: NodeJS.Timeout | null) => {
    const { deviceMap } = store() as LynxRecorderStoreType;
    const deviceInfo = deviceMap[clientId];
    if (deviceInfo) {
      deviceInfo.lynxrecorderTimer = timer;
    } else {
      deviceMap[clientId] = {
        lynxrecorderStarting: false,
        lynxrecorderLoading: false,
        lynxrecorderTimer: timer
      };
    }
    store({ deviceMap: { ...deviceMap } });
  }
});

const useLynxRecorder = create(lynxrecorderStore);
export default useLynxRecorder;
