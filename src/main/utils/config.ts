// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ILDTConfig, OnChangeListener } from '@lynx-js/lynx-devtool-utils';
import { LDT_CONFIG_FILE } from './const';
import fs from 'fs';

class LDTConfig implements ILDTConfig {
  private config = {};
  private _changeListenerMap = new Map<string, OnChangeListener[]>();

  constructor() {
    if (!fs.existsSync(LDT_CONFIG_FILE)) {
      this._writeConfig(true);
    } else {
      this.config = JSON.parse(fs.readFileSync(LDT_CONFIG_FILE, 'utf-8'));
    }
  }

  getConfig<T>(key: string, defaultValue?: T): T {
    return this.config[key] ?? defaultValue;
  }

  setConfig(key: string, value: any) {
    this.config[key] = value;
    this._writeConfig();
    this._changeListenerMap.get(key)?.forEach((listener) => listener(key, value));
  }

  addChangeListener(key: string, listener: OnChangeListener) {
    if (!this._changeListenerMap.has(key)) {
      this._changeListenerMap.set(key, []);
    }
    this._changeListenerMap.get(key)?.push(listener);
  }

  removeChangeListener(key: string, listener: OnChangeListener) {
    const changeListeners = this._changeListenerMap.get(key);
    if (changeListeners) {
      const index = changeListeners.indexOf(listener);
      if (index !== -1) {
        changeListeners.splice(index, 1);
      }
    }
  }

  private _writeConfig(sync = false) {
    if (sync) {
      fs.writeFileSync(LDT_CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } else {
      fs.writeFile(LDT_CONFIG_FILE, JSON.stringify(this.config, null, 2), (err) => {
        if (err) {
          console.log(`Error writing config file: ${err}`);
        }
      });
    }
  }
}

const ldtConfig = new LDTConfig();

export default ldtConfig;
