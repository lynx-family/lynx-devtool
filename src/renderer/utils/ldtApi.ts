// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import axios from 'axios';

async function call<T = any>(name: string, params?: any): Promise<T> {
  const global = window as any;
  if (!global.ldtElectronAPI) {
    return Promise.reject(new Error('Electron API not found'));
  }
  try {
    const { code, data, msg } = await global.ldtElectronAPI.invoke(name, params);

    if (code === 0) {
      return Promise.resolve(data as T);
    } else {
      return Promise.reject(new Error(msg));
    }
  } catch (e) {
    return Promise.reject(e);
  }
}

// switch lynx or web debug
export function setSimulatorViewMode(mode: 'lynx' | 'web' | 'mobile') {
  return call('simulator-view-mode', { action: 'set', mode });
}

export function getSimulatorViewMode() {
  return call('simulator-view-mode', { action: 'get' });
}

export function reconnectDebugDriver() {
  return call('reconnect-debug-driver');
}

export function getServerHost() {
  return call('ldt-server', { action: 'host' });
}

export function restartLDTPlatform() {
  return call('restart-ldt-platform');
}

export async function getCurrentIntranetIp(useLan = false) {
  try {
    const host = await getServerHost();
    const res = await axios.get(`http://${host}/queryIntranetIp?lan=${useLan}`);
    if (res?.status === 200) {
      return res?.data?.data;
    } else {
      console.error('queryIntranetIp error', res);
      return null;
    }
  } catch (error) {
    console.error('queryIntranetIp error', error);
    return null;
  }
}
