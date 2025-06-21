// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

type ActionHandler = (params?: any) => void;

class DevtoolActionHandler {
  private _handlers: Map<string, ActionHandler[]>;

  constructor() {
    this._handlers = new Map();
  }

  // register handler
  registerHandler(action: string, handler: ActionHandler) {
    if (this._handlers.has(action)) {
      const handlers = this._handlers.get(action);
      handlers?.push(handler);
    } else {
      this._handlers.set(action, [handler]);
    }
  }
  removeHandler(action: string, handler: ActionHandler) {
    if (this._handlers.has(action)) {
      const handlers = this._handlers.get(action);
      if (handlers) {
        const idx = handlers.findIndex((h) => h === handler);
        handlers?.splice(idx, 1);
      }
    }
  }

  // handle action
  handle(action: string, params?: any) {
    if (!this._handlers.has(action)) {
      // console.error(`Handler for action ${action} is not registered.`);
      return;
    }
    const handlers = this._handlers.get(action);
    handlers?.forEach((handler) => {
      handler(params);
    });
  }
}

export const devtoolActionHandler = new DevtoolActionHandler();
