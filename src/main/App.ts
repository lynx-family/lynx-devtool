// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getConfigItem, setConfigItem, LDT_DIR, getCurrentChannel, defaultLogger } from '@lynx-js/lynx-devtool-cli';
import { kScopeName, kCliPackageName } from '@lynx-js/lynx-devtool-utils';
import { BrowserWindow, Menu, app, dialog, shell } from 'electron';
import ProgressBar from 'electron-progressbar';
import BasePage, { IPageParams } from './base/BasePage';
import MobilePage from './mobile/MobilePage';
import menu from './utils/menu';
import ldtServer from './utils/server';
import path from 'path';
import fs from 'fs';
import { PageMode, ViewMode } from '@lynx-js/devtool-plugin-core/main';
import { initHandlers } from './handlers';
import ldtConfig from './utils/config';

class App {
  win: BrowserWindow;
  progressBar: ProgressBar | null = null;
  isDev = process.env.NODE_ENV === 'development';
  mainPage: BasePage<any>;
  pages = new Map<number, BasePage<any>>();

  // eslint-disable-next-line max-lines-per-function
  async init() {
    if (this.isDev) {
      // only clean cache in dev mode
      const { session } = require('electron');
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({
        storages: ['appcache', 'cookies', 'local storage', 'cache', 'indexdb', 'shadercache', 'websql']
      });
    }

    app.name = 'Lynx DevTool';
    app.setName('Lynx DevTool');
    
    // check if we already have an instance of this app open
    if (!app.requestSingleInstanceLock()) {
      app.quit();
    } else {
      app.on('second-instance', (_event: any, _commandLine: any, _workingDirectory: any) => {
        if (this.win) {
          if (this.win.isMinimized()) {
            this.win.restore();
          }
          this.win.focus();
        }
      });
    }

    initHandlers();

    // configure app
    app.commandLine.appendSwitch('enable-experimental-web-platform-features');
    app.commandLine.appendSwitch('scroll-bounce');
    app.commandLine.appendSwitch('--no-sandbox');
    app.commandLine.appendSwitch('disable-web-security');

    // Register deeplink processing
    app.on('open-url', (_, url) => {
      app.focus();
      console.log('open-url', url);
      const schema = new URL(url);
      const encodedUrl = schema.searchParams.get('url');
      if (encodedUrl) {
        const ldtUrl = decodeURIComponent(encodedUrl);
        console.log('ldtUrl', ldtUrl);
        ldtServer.ldtUrl = ldtUrl;
        this.start({ ldtUrl, schema, forceRefresh: true });
      } else {
        dialog.showErrorBox('DeepLink', `Cannot handle deeplink ${url}`);
        app.quit();
      }
    });

    app.on('window-all-closed', () => {
      app.quit();
    });

    app.on('ready', async () => {
      // setup menu
      Menu.setApplicationMenu(menu);
    });
    
    await app.whenReady();
    
    const region = await getConfigItem('region');
    if (!region) {
      await setConfigItem('region', 'cn');
    }
    // start main window
    const url = await ldtServer.start({
      progressListener: (progress) => {
        if (!this.progressBar) {
          this.progressBar = new ProgressBar({
            indeterminate: false,
            text: 'Resource downloading...',
            closeOnComplete: false
          });
          this.progressBar!.on('progress', (value) => {
            this.progressBar!.detail = `Progress: ${Math.round(value)}%`;
          });
        }
        this.progressBar.value = progress * 100;
      }
    });
    this._initAboutPanel();
    // open windows
    await this.start({ ldtUrl: url });
  }

  restart() {
    this.win = this.mainPage.create({ ...this.mainPage.pageParams, forceRefresh: true });
    this.win.focus();
  }

  async start(params: IPageParams) {
    let mode = 0;
    const url = new URL(params.ldtUrl);
    const type = url.searchParams.get('type');
    const pageMode = url.searchParams.get('pageMode');
    params.viewMode = ViewMode.MOBILE;

    if (pageMode) {
      try {
        mode = parseInt(pageMode, 10) as any;
      } catch (e) {
        console.error(`pageMode: ${pageMode} is not a number`);
      }
    }
    if (!params.viewMode) {
      params.viewMode = ViewMode.LYNX;
    }
    console.log('start', type, pageMode, params.viewMode, mode);

    await app.whenReady();

    if (this.mainPage?.getPageMode() !== mode) {
      // Close the previously opened page
      this.mainPage?.destroy();
      // Open a new page
      this.mainPage = this._providePage(mode);
    }
    this.win = this.mainPage.create(params);
    if (this.progressBar) {
      this.progressBar.close();
      this.progressBar = null;
    }
    if (this.win instanceof BrowserWindow) {
      this.win.webContents.setWindowOpenHandler(({ url: link }: any) => {
        shell.openExternal(link);
        return { action: 'deny' };
      });
    }
  }

  switchPage(mode: PageMode) {
    const { pageParams } = this.mainPage;
    this.mainPage = this._providePage(mode);
    this.win = this.mainPage.create(pageParams);
    this.win.show();
    this.win.focus();
    ldtConfig.setConfig('pageMode', mode);
  }

  // Switch lynx/web mode in simulator
  switchViewMode(mode: ViewMode) {
    // TODO(talisk): We haven't support webview mode and simulator yet,
    // hard code here temporarily
    ldtConfig.setConfig('simulatorViewMode', 'lynx');
    this.mainPage = this._providePage(PageMode.SIMULATOR);
    const { pageParams } = this.mainPage;
    const params = { ...pageParams };
    params.viewMode = mode;
    this.win = this.mainPage.create(params);
    this.win.focus();
  }

  // Switch between dev mode
  switchDevMode(mode: string) {
    const newPageParams: IPageParams = {
      ...this.mainPage.pageParams
    };
    let newLDTUrl = '';
    try {
      const url = new URL(newPageParams.ldtUrl);
      const currentDevMode = url.searchParams.get('dev');
      if (currentDevMode !== mode) {
        url.searchParams.set('dev', mode);
        newLDTUrl = url.toString();
      }
    } catch (error) {}
    if (newLDTUrl) {
      newPageParams.ldtUrl = newLDTUrl;
      this.mainPage.create(newPageParams);
    }
  }

  private _providePage(mode: number) {
    let page = this.pages.get(mode);
    if (!page) {
      page = new MobilePage();
      this.pages.set(mode, page);
    }
    return page;
  }

  private async _initAboutPanel() {
    try {
      const ldtPath = path.resolve(LDT_DIR, getCurrentChannel(), kScopeName, kCliPackageName);

      const packageJsonPath = path.resolve(ldtPath, 'package.json');
      const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJsonObj = JSON.parse(packageJson);
      const version = packageJsonObj.version;

      const iconPath: string | undefined = app.isPackaged
        ? path.join(process.resourcesPath, 'icons', 'lynx-devtool_256x256.png')
        : undefined;

      app.setAboutPanelOptions({
        iconPath: iconPath,
        applicationName: 'Lynx DevTool',
        applicationVersion: `${version}`,
        copyright: 'Copyright 2024 The Lynx Authors.\nAll rights reserved.'
      });
    } catch (e) {
      console.error(`get Version error: ${e}`);
    }
  }
}

const ldt = new App();
export default ldt;

