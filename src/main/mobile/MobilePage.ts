// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BrowserWindow, ipcMain, IpcMainEvent, screen } from 'electron';
import BasePage, { IPageParams } from '../base/BasePage';
import PluginManager from '../plugin/plugin-manager';
import { enable } from '@electron/remote/main';
import path, { join } from 'path';
import BaseDebugger from '../base/BaseDebugger';
import { ViewMode } from '@lynx-js/devtool-plugin-core/main';
import LynxDebugger from '../debugger/LynxDebugger';
import { getAppPath } from '@/utils/paths';
import ldtServer from '../utils/server';

class MobilePage extends BasePage<BrowserWindow> {
  _debuggerMap = new Map<ViewMode, BaseDebugger>();

  getPageMode(): number {
    return 0; // mobile
  }

  onCreate(params: IPageParams): BrowserWindow {
    const screenWidth = screen?.getPrimaryDisplay()?.size?.width ?? 1920;
    const width = Math.floor((screenWidth * 3) / 4);
    const height = Math.floor(screenWidth / 2);
    console.log('preload path'+path.join(__dirname, 'preload.js'));
    const window = new BrowserWindow({
      title: 'Lynx DevTool',
      width,
      height,
      center: true,
      webPreferences: {
        sandbox: false,
        backgroundThrottling: false,
        webSecurity: false,
        scrollBounce: true,
        experimentalFeatures: true,
        nodeIntegration: true,
        webviewTag: true,
        contextIsolation: false,
        nodeIntegrationInWorker: false,
        allowRunningInsecureContent: true,
        preload: path.join(__dirname, 'preload.js'),
        partition: 'persist:ldt-mobile'
      }
    });

    PluginManager.getInstance().install({
      browserWindow: window,
      debugger: {
        get: () => this._getDebugger()
      }
    });
    PluginManager.getInstance().create(params);

    ipcMain.on('getAppPath', this._onGetAppPath);
    ipcMain.on('getAppInfo', this._onGetAppInfo);

    enable(window.webContents);
    window.loadURL(params.ldtUrl);

    return window;
  }

  protected onDestroy(): void {
    ipcMain.off('getAppPath', this._onGetAppPath);
    ipcMain.off('getAppInfo', this._onGetAppInfo);
    this._releaseDebugger();
  }

  onRestart(params: IPageParams) {
    // If viewMode changes, close the old debugger first, then reload the page
    if (this.pageParams.viewMode !== params.viewMode || params.forceRefresh) {
      params.forceRefresh = false;
      this._getDebugger().stop();
      PluginManager.getInstance().restart(params);
      this.win?.loadURL(params.ldtUrl)?.then(() => this.win?.show());
    }
  }

  private _onGetAppPath(event: IpcMainEvent) {
    event.returnValue = getAppPath();
  }

  private _onGetAppInfo(event: IpcMainEvent) {
    event.returnValue = this._getDebugger().getAppInfo();
  }

  private _releaseDebugger() {
    this._debuggerMap.forEach((_debugger) => _debugger.stop());
    this._debuggerMap.clear();
  }

  private _getDebugger(): BaseDebugger {
    // TODO(talisk): Temporarily set to Lynx mode
    const viewMode = ViewMode.LYNX;
    if (!this._debuggerMap.has(viewMode)) {
      let _debugger: BaseDebugger = new LynxDebugger();
      this._debuggerMap.set(viewMode, _debugger);
    }
    return this._debuggerMap.get(viewMode) as BaseDebugger;
  }
}
export default MobilePage;
