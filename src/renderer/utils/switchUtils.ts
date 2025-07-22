// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import debugDriver from './debugDriver';
import { getStore } from './flooks';
import useConnection from '../hooks/connection';

function updateStopAtEntry(type: string, value: boolean) {
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
  if (type === 'MTS') {
    deviceInfo.stopLepusAtEntry = value;
  } else if (type === 'DEFAULT') {
    deviceInfo.stopAtEntry = value;
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
    updateStopAtEntry(type, value);
  } catch (error: any) {
    console.error('getStopAtEntry error:', type, error);
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
    updateStopAtEntry(type, resultValue);
  } catch (error: any) {
    console.error('setStopAtEntry error:', type, value, error);
  }
}