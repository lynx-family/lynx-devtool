// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BrowserWindow } from 'electron';
import { PageMode, ViewMode } from '@lynx-js/devtool-plugin-core/main';

export interface IPageParams {
  ldtUrl: string; // lynx-devtool-web address
  schema?: URL; // deep-link
  pageMode?: PageMode; // Real device or simulator
  viewMode?: ViewMode; // lynx or web
  forceRefresh?: boolean;
}

abstract class BasePage<T extends BrowserWindow> {
  win: T | null;
  isDev = process.env.NODE_ENV === 'development';
  pageParams: IPageParams;

  create(params: IPageParams): T {
    if (!this.pageParams) {
      this.pageParams = params;
    }
    const url = new URL(params.ldtUrl);
    // Pass pageMode to lynx-devtool-web
    url.searchParams.set('pageMode', '0');
    // Pass viewMode to lynx-devtool-web

    url.searchParams.set('viewMode', 'lynx');
    params.ldtUrl = url.toString();
    if (this.win) {
      this.onRestart(params);
    } else {
      this.win = this.onCreate(params);
      this.win.on('close', () => {
        this.destroy();
      });
    }
    Object.assign(this.pageParams, params);

    return this.win;
  }

  destroy() {
    if (this.win) {
      this.onDestroy();
      const window = this.win;
      this.win = null;
      window.close();
    }
  }

  protected onDestroy() {
    console.log(`${this.getPageMode()} onDestroy`);
  }

  abstract getPageMode(): PageMode;
  protected abstract onRestart(params: IPageParams);
  protected abstract onCreate(params: IPageParams): T;
}

export default BasePage;
