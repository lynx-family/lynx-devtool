// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { message } from 'antd';
import debugDriver from './debugDriver';
import * as reduxUtils from './storeUtils';

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
