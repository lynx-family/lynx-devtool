// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { EventEmitter } from 'node:events';

let nextId = 100;
export const handlers = new Map();
export const protocol = {
  isProtocolHandled: (scheme) => handlers.has(scheme),
  handle: (scheme, handler) => handlers.set(scheme, handler),
  unhandle: (scheme) => handlers.delete(scheme),
};

export class LynxWindow extends EventEmitter {
  id = ++nextId;
  loads = [];

  loadURL(url) {
    this.loads.push({ kind: 'url', target: url });
    return true;
  }

  loadFile(path) {
    this.loads.push({ kind: 'file', target: path });
    return true;
  }

  close() {
    this.emit('closed', {});
  }
}
