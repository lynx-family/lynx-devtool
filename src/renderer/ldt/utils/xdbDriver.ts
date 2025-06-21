// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import useConnection from '@/renderer/hooks/connection';
import debugDriver from '@/renderer/utils/debugDriver';
import { getStore } from '@/renderer/utils/flooks';
import { IDevice, IGroupDevice } from '@lynx-js/devtool-plugin-core/renderer';
import {
  ERemoteDebugDriverExternalEvent,
  IClientDescriptor,
  ISocketMessage,
  SocketEvents
} from '@lynx-js/remote-debug-driver';
import { compareVersions, validate } from 'compare-versions';

const KEY_MESSAGE = 'xdb_msg';

export interface IMessage {
  __id?: number;
  did?: string;
  roomId?: string;
  appId?: string;
  type: string;
  data?: any;
  isAsync?: boolean;
}

export interface IEvent {
  __id?: number;
  did: string;
  roomId: string;
  appId: string;
  type: string;
  data: any;
  info?: ILDTDeviceInfo;
}

interface ICacheMessage {
  message: IMessage;
  resolve?: (data: any) => void;
  reject?: (e: Error) => void;
}

interface ILDTDeviceInfo {
  version: string;
  platform: string;
  debugRouterVersion?: string;
  debugRouterId?: string;
}

export type OnMessageListener<T> = (data: T) => void;
class XdbDriver {
  private _socketIO;
  private _listenerMap: WeakMap<any, OnMessageListener<any>> = new WeakMap();
  private _debugListenerMap = new WeakMap();
  private _roomMap = new Map<string, IDevice>();
  private _cacheMessages: Array<ICacheMessage> = [];
  private _index = 0;
  private _onClientListTimer: any;
  private _timeout: any;

  sendMessage(message: IMessage, msgTimeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      message.__id = this._index++;
      if (!message.appId || !message.did) {
        const selectedDevice = this.getCurrentDevice();
        const { info, clientId } = selectedDevice;
        if (info || clientId) {
          message.appId = info.appId;
          message.did = info.did;
          if ((!message.appId || !message.did) && !clientId) {
            reject(new Error('Please open LDT on the device first!'));
            return;
          }
        } else {
          reject(new Error('Please open LDT on the device first!'));
          return;
        }
      }
      message.roomId = this.getRoomId(message.appId, message.did);
      // When sending messages, first check if the room has been joined. If not, cache the messages first, and send them all at once after joining
      const isRoomJoined = this._roomMap.has(this.getRoomId(message.appId, message.did));
      if (isRoomJoined || this.canUseDebugDriver(message.appId, message.did)) {
        this._handleMessage(message, resolve, reject, msgTimeout);
      } else {
        this._cacheMessages.push({ message, resolve, reject });
      }
    });
  }

  sendMessageToDevice(device: IDevice, type: string, data: any, isAsync = false) {
    return this.sendMessage({
      appId: device.info?.appId,
      did: device.info?.did,
      type,
      data,
      isAsync
    });
  }

  sendMessageToCurrentDevice(type: string, data: any, isAsync = false) {
    const device = this.getCurrentDevice();
    return this.sendMessageToDevice(device, type, data, isAsync);
  }

  subscribeMessage(listener: OnMessageListener<IEvent>) {
    this.on(KEY_MESSAGE, listener);
  }

  on(key: string, listener: OnMessageListener<IEvent>, roomId?: string) {
    // Need to distinguish messages for target device including network logs/client logs/platform relay ('xdb_msg' type)
    if (key === KEY_MESSAGE) {
      const socketListener = (event: IEvent) => {
        // Only handle messages targeting the current device
        const rId = roomId ?? this.getCurrentRoomId();
        if (rId === `${event.appId}:${event.did}`) {
          listener(event);
        }
      };
      this._listenerMap.set(listener, socketListener);
      this._socketIO.on(key, socketListener);

      // TODO: The any type here needs optimization
      const debugSocketListener = (event: ISocketMessage<any>) => {
        if (event.event !== SocketEvents.Customized || event.data.type !== KEY_MESSAGE) {
          return;
        }
        const message = event.data.data?.message as IEvent;
        socketListener(message);
      };
      this._debugListenerMap.set(listener, debugSocketListener);
      debugDriver.on(ERemoteDebugDriverExternalEvent.All, debugSocketListener);
    } else {
      this._socketIO.on(key, listener);
    }
  }

  off(key: string, listener: OnMessageListener<IEvent>) {
    if (key === KEY_MESSAGE) {
      const socketListener = this._listenerMap.get(listener);
      if (socketListener) {
        this._socketIO.off(key, socketListener);
        this._listenerMap.delete(listener);
      }
      const debugListener = this._debugListenerMap.get(listener);
      if (debugListener) {
        debugDriver.off(ERemoteDebugDriverExternalEvent.All, debugListener);
        this._debugListenerMap.delete(listener);
      }
    } else {
      this._socketIO.off(key, listener);
    }
  }

  offAll(key: string) {
    this._socketIO.off(key);
  }

  emit(key: string, event: any) {
    this._socketIO.emit(key, event);
  }

  joinRoom(device: IDevice) {
    const { info } = device;
    if (info?.appId && info?.did) {
      this.emit('xdb_join', { did: info?.did, appId: info?.appId });
    }
  }

  leaveRoom(device: IDevice) {
    const { info } = device;
    if (info?.appId && info?.did) {
      this.emit('xdb_leave', { did: info?.did, appId: info?.appId });
    }
  }

  getRoomId(appId?: string, did?: string) {
    return `${appId}:${did}`;
  }

  getDeviceRoomId(device: IDevice) {
    return `${device.info?.appId}:${device.info?.did}`;
  }

  getCurrentRoomId(): string {
    const selectedDevice = this.getCurrentDevice();
    if (selectedDevice) {
      const { info } = selectedDevice;
      if (info) {
        return this.getRoomId(info.appId, info.did);
      }
    }
    return '';
  }

  updateDebugDriverDeviceModelName(device: IDevice) {
    const { deviceList, setDeviceList } = getStore(useConnection);
    const connectDevice = deviceList.find((d) => this.isSameDevice(device, d));
    if (connectDevice) {
      connectDevice.info.deviceModel = device.info.deviceModel;
      setDeviceList([...deviceList]);
    }
  }

  isRealOnline(device: IDevice) {
    return device.clientId || device.xdbOnline;
  }

  isDebugDriverOnline(device: IDevice) {
    const { deviceList } = getStore(useConnection);
    return Boolean(deviceList.find((d) => this.isSameDevice(d, device))?.clientId);
  }

  canUseDebugDriver(appId?: string, did?: string) {
    const { deviceList } = getStore(useConnection);
    const device = deviceList.find((d) => d.info.appId === appId && d.info.did === did);
    if (device) {
      return device.clientId && this.canUseDebugRouter(device);
    }
    return false;
  }

  // when appId and did are the same, or clientId is the same, or debugRouterId is the same, it can be considered to be the same device
  isSameDevice(first: IDevice, second: IDevice) {
    let isSame: any = first.clientId && first.clientId === second.clientId;
    if (!isSame) {
      if (first.info && second.info && debugDriver.isMainProcess(first) && debugDriver.isMainProcess(second)) {
        isSame =
          first.info.appId &&
          first.info.did &&
          first.info.appId === second.info.appId &&
          first.info.did === second.info.did;
        if (!isSame) {
          isSame = first.info.debugRouterId && first.info.debugRouterId === second.info.debugRouterId;
        }
      }
    }
    return Boolean(isSame);
  }

  isCurrentDevice(device: IDevice) {
    return this.isSameDevice(device, this.getCurrentDevice());
  }

  getCurrentDevice(): IDevice {
    const { selectedDevice } = getStore(useConnection);
    if (!selectedDevice.clientId) {
      return { info: {} } as IDevice;
    }
    return selectedDevice;
  }

  getDeviceStatus(device: IDevice, enable: boolean) {
    return new Promise<void>((resolve, reject) => {
      const { info } = device;
      const onClientList = (clients: IClientDescriptor[]) => {
        // when appid,did are the same, or debugRouterId is the same, it is considered to be the same device
        const changeDevice = clients.find(
          (client) =>
            client.info &&
            ((client.info.appId === info.appId && client.info.did === info.did) ||
              (client.info.debugRouterId && client.info.debugRouterId === info.debugRouterId))
        );
        if ((changeDevice && enable) || (!enable && !changeDevice)) {
          debugDriver.off(ERemoteDebugDriverExternalEvent.ClientList, onClientList);
          this._timeout && clearTimeout(this._timeout);
          resolve();
        }
      };
      debugDriver.on(ERemoteDebugDriverExternalEvent.ClientList, onClientList);
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      this._timeout = setTimeout(() => {
        debugDriver.off(ERemoteDebugDriverExternalEvent.ClientList, onClientList);
        reject(new Error(`Device ${enable ? 'connected' : 'disconnected'} timed out, please check the network`));
      }, 15000);
    });
  }

  groupDevices(deviceList: IDevice[], groupKey: 'App' | 'deviceModel' = 'App'): IGroupDevice[] {
    const sortList = deviceList.sort((d0, d1) => d0.info[groupKey]?.localeCompare(d1.info[groupKey] ?? '') ?? 0);
    return sortList.map((device, index) => {
      let top = false;
      if (index === 0) {
        top = true;
      } else {
        const preDevice = sortList[index - 1];
        if (preDevice.info[groupKey] !== device.info[groupKey]) {
          top = true;
        }
      }
      return {
        ...device,
        top
      };
    });
  }

  canUseDebugRouter(device: IDevice): boolean {
    const { info } = device;
    if (info?.ldtVersion) {
      if (info?.osType === 'Android') {
        return validate(info.ldtVersion) && compareVersions(info.ldtVersion, '1.5.1') >= 0;
      }
      if (info?.osType === 'iOS') {
        return validate(info.ldtVersion) && compareVersions(info.ldtVersion, '1.5.4.2') >= 0;
      }
    }
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  private _handleMessage(message: IMessage, resolve: Function, reject: Function, msgTimeout = 10000) {
    let listener: any = null;
    const rejectTimeout = setTimeout(() => {
      listener && this.off(KEY_MESSAGE, listener);
      reject(new Error(`${message.type} send timed out`));
    }, msgTimeout);
    listener = (resp: IEvent) => {
      if (resp && resp.type === 'xdb_msg_resp' && resp.__id === message.__id) {
        this.off(KEY_MESSAGE, listener);
        clearTimeout(rejectTimeout);
        resolve(resp);
      }
    };
    this.on(KEY_MESSAGE, listener, this.getRoomId(message.appId, message.did));
    if (this.canUseDebugDriver(message.appId, message.did)) {
      debugDriver.sendCustomMessage({ type: KEY_MESSAGE, params: message });
    } else {
      this.emit(KEY_MESSAGE, message);
    }
  }
}

const xdbDriver = new XdbDriver();
export default xdbDriver;
