// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { IDebugDriver } from "@lynx-js/devtool-plugin-core/renderer";

export async function setGlobalSwitch(debugDriver: IDebugDriver, params: any) {
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
export async function getGlobalSwitch(debugDriver: IDebugDriver, params: any) {
  try {
    const result = await debugDriver.sendCustomMessageAsync({ params, type: 'GetGlobalSwitch' });
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

export async function openDevtool(debugDriver: IDebugDriver, open: boolean) {
  try {
    const params = {
      global_key: 'enable_devtool',
      global_value: open
    };
    const result = await setGlobalSwitch(debugDriver, params);
    if (result !== open) {
      return false;
    }
  } catch (error) {
    console.error('openDevtool error', error);
    return false;
  }
  return true;
}
export async function getSwitchStatus(debugDriver: IDebugDriver, key: string) {
  const params = {
    global_key: key
  };
  return await getGlobalSwitch(debugDriver, params);
}
export async function openDomTree(debugDriver: IDebugDriver, open: boolean) {
  try {
    const params = {
      global_key: 'enable_dom_tree',
      global_value: open
    };
    const result = await setGlobalSwitch(debugDriver, params);
    if (result !== open) {
      return false;
    }
  } catch (error) {
    console.error('openDomTree error', error);
    return false;
  }
  return true;
}