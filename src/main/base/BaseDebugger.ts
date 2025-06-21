// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BrowserWindow, ipcMain, IpcMainEvent, WebContents } from 'electron';
// import bridgeManger from '../simulator/bridge/bridge';
// import globalPropsManager from '../simulator/globalprops/globalprops';
// import proxyManager from '../simulator/proxy/proxy';
import { getOsType } from '../utils/const';
import { MultiResponse } from './BaseHandler';
import type { IBaseDebugger, BaseHandler, IDebuggerOptions } from '@lynx-js/devtool-plugin-core/main';

abstract class BaseDebugger implements IBaseDebugger {
  protected _target: any;
  protected _win: BrowserWindow | undefined;
  protected _inspectContents: WebContents | undefined;
  protected _options: IDebuggerOptions;
  protected appInfo: any;
  private _messageHandlerMap = new Map<string, BaseHandler[]>();
  private _isStarted = false;
  private _containerId: string | undefined;
  private _scheme: string | undefined;
  private _containerChangeListeners: ((data: any) => void)[] = [];

  constructor() {
    this.listenContainerChange = this.listenContainerChange.bind(this);
    // TODO(sunkai.dev): update appInfo
    this.appInfo = {
      App: 'Lynx DevTool',
      appId: 'com.lynx.devtool',
      ldtVersion: '',
      sdkVersion: '',
      deviceType: 'mobile',
      osType: getOsType()
    };
  }

  start(options: IDebuggerOptions) {
    this._options = options;
    this._target = options.target;
    this._containerId = options.containerId;
    this._win = options.win;
    this.stop();
    this._attachDebugger();
    this._isStarted = true;
  }

  stop() {
    this._detachDebugger();
    this._isStarted = false;
  }

  isStarted() {
    return this._isStarted;
  }

  getMessageHandler(name: string): BaseHandler[] {
    return this._messageHandlerMap.get(name) || [];
  }

  getTarget() {
    return this._target;
  }

  getContainerId() {
    return this._containerId;
  }

  getAppInfo() {
    return this.appInfo;
  }

  getScheme() {
    return this._scheme;
  }

  setInspectContents(conetnets: WebContents) {
    this._inspectContents = conetnets;
  }

  addMessageHandler(handler: BaseHandler) {
    if (!this._messageHandlerMap.has(handler.getName())) {
      this._messageHandlerMap.set(handler.getName(), []);
    }
    this._messageHandlerMap.get(handler.getName())?.push(handler);
  }

  removeMessageHandler(handler: BaseHandler) {
    const handlers = this._messageHandlerMap.get(handler.getName());
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  removeMessageHandlers(handlerName: string) {
    this._messageHandlerMap.delete(handlerName);
  }

  removeAllMessageHandlers() {
    this._messageHandlerMap.clear();
  }

  handleMessage(type: string, data: any) {
    const params = typeof data === 'string' ? JSON.parse(data) : data;
    this.getMessageHandler(type)?.forEach((handler) => {
      handler
        .handle(params)
        .then((res) => {
          if (res instanceof MultiResponse) {
            res.getData().forEach((item) => {
              this.sendMessage(type, item);
            });
          } else {
            this.sendMessage(type, res);
          }
        })
        .catch(() => {
          //
        });
    });
  }

  /**
   * Remote call to the corresponding target method. remoteCall('openUrl', `https://www.baidu.com`)
   * @param method Method name
   * @param params Method parameters
   */
  callContainerMethod(method: string, ...params: any) {
    this._target[method](...params);
  }

  openCard(schema: string) {
    this._win?.webContents?.send('simulator-open-card', {
      schema
    });
  }

  addContainerChangeListener(listener: (data: any) => void) {
    this._containerChangeListeners.push(listener);
  }
  removeContainerChangeListener(listener: (data: any) => void) {
    const index = this._containerChangeListeners.indexOf(listener);
    if (index !== -1) {
      this._containerChangeListeners.splice(index, 1);
    }
  }

  // Listen for containerId changes in LynxView/WebView
  protected listenContainerChange(event: IpcMainEvent, data: any) {
    this._containerId = data.containerId;
    this._scheme = data.scheme;
    event.sender.send('simulator-container-change', data);
    this._containerChangeListeners.forEach((listener) => {
      listener(data);
    });
  }

  private _attachDebugger() {
    // bridgeManger.attachJsbDebugger(this);
    // globalPropsManager.attachGlobalPropsDebugger(this);
    // proxyManager.attachProxyDebugger(this);
    ipcMain.on('container-change', this.listenContainerChange);
  }

  private _detachDebugger() {
    // bridgeManger.detachJsbDebugger(this);
    // globalPropsManager.detachGlobalPropsDebugger(this);
    // proxyManager.detachProxyDebugger(this);
    ipcMain.off('container-change', this.listenContainerChange);
  }

  // Send message to platform
  abstract sendMessage(type: string, data: any);
}

export default BaseDebugger;
