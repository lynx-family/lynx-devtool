// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import debugDriver from './debugDriver';
import { getStore } from './flooks';
import useConnection from '../hooks/connection';

function updateDeviceInfo(info: string, type: string, value: boolean) {
  const currentClientId = debugDriver.getSelectClientId();
  if (currentClientId === undefined) {
    return;
  }
  const { deviceInfoMap, setDeviceInfoMap } = getStore(useConnection);
  const newDeviceInfoMap = { ...deviceInfoMap };
  const deviceInfo = newDeviceInfoMap[currentClientId];
  if (deviceInfo === undefined) {
    return;
  }

  if (info === 'stopAtEntry') {
    if (type === 'MTS') {
      deviceInfo.stopLepusAtEntry = value;
    } else if (type === 'DEFAULT') {
      deviceInfo.stopAtEntry = value;
    }
  } else if (info === 'fetchDebugInfo') {
    if (type === 'MTS') {
      deviceInfo.fetchMTSDebugInfo = value;
    }
  }

  setDeviceInfoMap(newDeviceInfoMap);
}

export async function getStopAtEntry(type: string) {
  try {
    const result = await debugDriver.sendCustomMessageAsync({
      type: 'GetStopAtEntry',
      params: { type }
    });
    const { value } = result;
    if (value === undefined) {
      return;
    }
    updateDeviceInfo('stopAtEntry', type, value);
  } catch (error: any) {
    console.error('getStopAtEntry error:', type, error);
  }
}

export async function getFetchDebugInfo(type: string) {
  try {
    const result = await debugDriver.sendCustomMessageAsync({
      type: 'GetFetchDebugInfo',
      params: { type }
    });
    const { value } = result;
    if (value === undefined) {
      return;
    }
    updateDeviceInfo('fetchDebugInfo', type, value);
  } catch (error: any) {
    console.error('getFetchDebugInfo error:', type, error);
  }
}

export async function setStopAtEntry(type: string, value: boolean) {
  try {
    const result = await debugDriver.sendCustomMessageAsync({
      type: 'SetStopAtEntry',
      params: { type, value }
    });
    const { value: resultValue } = result;
    if (resultValue === undefined) {
      return;
    }
    updateDeviceInfo('stopAtEntry', type, resultValue);
    getFetchDebugInfo(type);
  } catch (error: any) {
    console.error('setStopAtEntry error:', type, value, error);
  }
}

export async function setFetchDebugInfo(type: string, value: boolean) {
  try {
    const result = await debugDriver.sendCustomMessageAsync({
      type: 'SetFetchDebugInfo',
      params: { type, value }
    });
    const { value: resultValue } = result;
    if (resultValue === undefined) {
      return;
    }
    updateDeviceInfo('fetchDebugInfo', type, resultValue);
  } catch (error: any) {
    console.error('setFetchDebugInfo error:', value, error);
  }
}