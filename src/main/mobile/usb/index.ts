// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import ldtServer from '../../utils/server';
import { DeviceChangeListener, DeviceStatus, IUsbDevice, IUsbManager } from '@lynx-js/devtool-plugin-core/main';

class UsbManager implements IUsbManager {
  private _deviceChangeListeners: DeviceChangeListener[] = [];

  constructor() {
    ldtServer.getDebugDriverAsync().then((driver) => {
      driver.on('device-connected', (device) => {
        this._deviceChangeListeners.forEach((listener) => {
          listener(DeviceStatus.CONNECTED, device);
        });
      });
      driver.on('device-disconnected', (device) => {
        this._deviceChangeListeners.forEach((listener) => {
          listener(DeviceStatus.DISCONNECTED, device);
        });
      });
    });
  }

  getDevice(deviceId: string): IUsbDevice | undefined {
    return ldtServer.getDebugDriver().devices?.get(deviceId);
  }

  getDevices(): any[] {
    return Array.from(ldtServer.getDebugDriver().devices?.values() || []);
  }

  getDeviceByClientId(clientId: number): IUsbDevice | undefined {
    const deviceId = ldtServer.getDebugDriver().usbClients.get(clientId)?.deviceId();
    if (deviceId) {
      return this.getDevice(deviceId);
    }
    return undefined;
  }

  addDeviceChangeListener(listener: DeviceChangeListener) {
    this._deviceChangeListeners.push(listener);
  }

  removeDeviceChangeListener(listener: DeviceChangeListener) {
    const index = this._deviceChangeListeners.indexOf(listener);
    if (index !== -1) {
      this._deviceChangeListeners.splice(index, 1);
    }
  }

  shell(deviceId: string, cmd: string): Promise<string> {
    const device = this.getDevice(deviceId);
    return device?.executeShell(cmd) || Promise.reject(new Error('device not found!'));
  }

  async click(deviceId: string, x: number, y: number) {
    await this.shell(deviceId, `input tap ${x} ${y}`);
  }
  async swipe(deviceId: string, startX: number, startY: number, endX: number, endY: number, duration: number) {
    await this.shell(deviceId, `input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`);
  }
  async inputText(deviceId: string, text: string) {
    await this.shell(deviceId, `input text ${text}`);
  }

  async captureScreen(deviceId) {
    return await this.shell(deviceId, 'screencap -p | base64');
  }
}

const usbManager = new UsbManager();
export default usbManager;
