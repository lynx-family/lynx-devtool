// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { message } from 'antd';
import debugDriver from './debugDriver';
import * as reduxUtils from './storeUtils';
import useConnection from '@/renderer/store/connection';
import { getStore } from './flooks';
import { getSelectClientId } from '@/renderer/utils/storeUtils';

export async function setGlobalSwitch(params: any) {
  try {
    const result = await debugDriver.sendCustomMessageAsync({ params, type: 'SetGlobalSwitch' });
    if (typeof result === 'object') {
      return result?.global_value === 'true' || result?.global_value === true;
    } else {
      return result === 'true' || result === true;
    }
  } catch (error) {
    console.error('setGlobalSwitch error', error);
    return false;
  }
}

export async function getGlobalSwitch(params: any) {
  try {
    const result = await debugDriver.sendCustomMessageAsync({ params, type: 'GetGlobalSwitch' }, 10000);
    if (typeof result === 'object') {
      return result?.global_value === 'true' || result?.global_value === true;
    } else {
      return result === 'true' || result === true;
    }
  } catch (error) {
    console.error('getGlobalSwitch error', error);
    return true;
  }
}

export async function isDebugMode() {
  const params = {
    global_key: 'enable_debug_mode'
  };
  const result = await debugDriver.sendCustomMessageAsync({ params, type: 'GetGlobalSwitch' });
  if (typeof result === 'object') {
    return result?.global_value === 'true' || result?.global_value === true;
  } else {
    return result === 'true' || result === true;
  }
}

async function openDebugModeImp() {
  const currentClient = reduxUtils.getSelectClient();
  const sdkVersion = currentClient?.info?.sdkVersion;
  let osType = currentClient?.info?.osType;
  // osType is empty in some cases, and the system type needs to be determined based on the deviceModel field.
  if (!osType) {
    const diveceModel = currentClient?.info?.deviceModel;
    osType = diveceModel?.indexOf('iPhone') >= 0 || diveceModel?.indexOf('iPad') >= 0 ? 'iOS' : 'Android';
  }

  if (osType === 'Android') {
    const debugModeValue = await isDebugMode();
    if (!debugModeValue) {
      const params = {
        global_key: 'enable_debug_mode',
        global_value: true
      };
      const debugResult = await setGlobalSwitch(params);
      if (debugResult) {
        message.warning('Have open debug mode, Please restart app!');
        return false;
      }
    }
  }
  return true;
}

export async function openDevtool(open: boolean) {
  try {
    const params = {
      global_key: 'enable_devtool',
      global_value: open
    };
    const result = await setGlobalSwitch(params);
    if (result !== open) {
      return false;
    }
  } catch (error) {
    console.error('openDevtool error', error);
    return false;
  }
  return true;
}

export async function getSwitchStatus(key: string) {
  const params = {
    global_key: key
  };
  return await getGlobalSwitch(params);
}

export async function openDomTree(open: boolean) {
  try {
    const params = {
      global_key: 'enable_dom_tree',
      global_value: open
    };
    const result = await setGlobalSwitch(params);
    if (result !== open) {
      return false;
    }
  } catch (error) {
    console.error('openDomTree error', error);
    return false;
  }
  return true;
}

export async function openDebugMode() {
  try {
    const result = await openDebugModeImp();
    if (!result) {
      return false;
    }
  } catch (error) {
    message.error('Failed to open DebugMode, please manually open it on the App side');
    return false;
  }
  return true;
}


function updateStopAtEntry(type: string, value: boolean) {
  const currentClientId = getSelectClientId();
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
