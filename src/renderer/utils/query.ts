// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { v4 } from 'uuid';

class QueryService {
  private _randomRoomId: string = v4();

  getQuery(key: string) {
    return new URLSearchParams(location.search).get(key);
  }

  setQuery(key: string, value: string) {
    const urlComponents = new URLSearchParams(location.search);
    urlComponents.set(key, value);
    history.pushState({}, document.title, `?${urlComponents.toString()}`);
  }

  getRoomId(): string {
    return this.getQuery('room') || this._randomRoomId;
  }

  getWSUrlInQuery(): string {
    return decodeURIComponent(this.getQuery('ws') || '');
  }
  setRoomId(roomId: string): void {
    this.setQuery('room', roomId);
  }
  setWSUrl(ws: string | undefined): void {
    if (ws) {
      this.setQuery('ws', ws);
    }
  }
  getInspectorUrl(): string {
    return this.getQuery('inspector') || '';
  }
  getDevStatus(): string {
    return this.getQuery('dev') || '';
  }

  isUsbConnect(): boolean {
    return this.getQuery('usbConnect') === 'true';
  }

  getUsbType(): boolean {
    return this.getQuery('usbType') === 'ldt';
  }

  getCardFilter(): string {
    return decodeURIComponent(this.getQuery('cardFilter') || '');
  }

  getUID(): string {
    return this.getQuery('uid') || '';
  }

  setUID(uid: string): void {
    this.setQuery('uid', uid);
  }

  getOfflinelogsQuery(): any {
    return this.getQuery('offlinelogsQuery') || '';
  }

  setOfflinelogsQuery(data: any): any {
    this.setQuery('offlinelogsQuery', data);
  }
}

export const queryService = new QueryService();
