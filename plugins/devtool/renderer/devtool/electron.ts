// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

async function call<T = any>(name: string, params?: any): Promise<T> {
  if (!window.ldtElectronAPI) {
    return Promise.reject(new Error('Electron API not found'));
  }
  try {
    const { code, data, msg } = (await window.ldtElectronAPI.invoke(name, params)) || {};
    if (!code || code === 0) {
      return Promise.resolve(data as T);
    } else {
      return Promise.reject(new Error(msg));
    }
  } catch (e) {
    return Promise.reject(e);
  }
}

export function sendEventToSimulator(data: any) {
  return call('devtool-inspect-message', data);
}
