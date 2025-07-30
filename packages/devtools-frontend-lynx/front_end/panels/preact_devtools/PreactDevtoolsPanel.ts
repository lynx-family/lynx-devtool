// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as UI from '../../ui/legacy/legacy.js';

declare global {
  interface Window {
    React: typeof import('react');
    ReactDOM: typeof import('react-dom');
  }
}

let preactDevtoolsPanelInstance: PreactDevtoolsPanel;

const remoteListenerMap: Record<string, ((message: any) => void)[]> = {};
const extensionListenerMap: Record<string, { listener: (message: any) => void, receiver: string }[]> = {};

const addRemoteListener = (type: string, listener: (message: any) => void) => {
  if (!remoteListenerMap[type]) {
    remoteListenerMap[type] = [];
  }
  remoteListenerMap[type].push(listener);
};
const addExtensionListener = (type: string, listener: { listener: (message: any) => void, receiver: string }) => {
  if (!extensionListenerMap[type]) {
    extensionListenerMap[type] = [];
  }
  extensionListenerMap[type].push(listener);
};


export const addEventListener = (id: string) => (type: string, listener: (message: any) => void) => {
  const domains = type.split(".");
  if (domains[0] === "Remote") {
    addRemoteListener(type, listener);
  } else if (domains[0] === "Extensions") {
    addExtensionListener(type, { listener, receiver: id });
  }
};

export const postMessage = (id: string) => (type: string, message: any) => {
  const domains = type.split(".");
  if (domains[0] === "Remote") {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    window.parent.postMessage(
      { type: "send_message", content: { type: domains[2], message } },
      "*"
    );
  } else if (domains[0] === "LDT") {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    window.parent.postMessage(
      {
        type: "plugin",
        content: {
          type: domains[1],
          message,
        },
      },
      "*"
    );
  } else if (domains[0] === "Extensions") {
    if (domains.length > 1) {
      extensionListenerMap[`Extensions.${id}`]?.forEach((i) => {
        if (i.receiver === domains[1]) {
          i.listener(message);
        }
      });
    } else {
      if (extensionListenerMap[`Extensions.${id}`]) {
        extensionListenerMap[`Extensions.${id}`]?.forEach((i) =>
          i.listener(message)
        );
      }
    }
  }
};

export class PreactDevtoolsPanel extends UI.Panel.Panel {
  static id = 'preact_devtools';
  static PREACT_DEVTOOLS_BUNDLE_URL = 'https://unpkg.com/@lynx-js/preact-devtools@latest/dist/index.js'
  
  onScreenCastPanelUINodeIdSelectedListeners: ((UINodeId: string) => void)[] = [];
  
  constructor() {
    super('preact_devtools');
    
    window.addEventListener("message", (event) => {
      if (!event.data) {
        return;
      }
      switch (event.data.type) {
        case "lynx_message":
          const type = `Remote.Customized.${event.data.content.type}`;
          remoteListenerMap[type]?.forEach((listener) =>
            listener(event.data.content.message)
          );
          break;
        case "panel:preact_devtools":
          if (event.data.content.type === 'ScreenCastPanelUINodeIdSelected') {
            this.onScreenCastPanelUINodeIdSelectedListeners.forEach((listener) =>
              listener(event.data.content.message.UINodeId)
            );
          }
          break;
      }
    });
    
    const div = document.createElement('div');
    const text = document.createTextNode('Preact Devtools Panel is initializing...');
    div.appendChild(text);
    this.contentElement.appendChild(
      div
    );
    
    this.loadPreactDevtoolsBundle();
  }
  
  async loadPreactDevtoolsBundle() {
    const preactDevtoolsBundle = await import(PreactDevtoolsPanel.PREACT_DEVTOOLS_BUNDLE_URL);
    const PreactDevtoolsApp = preactDevtoolsBundle.default;
    window.ReactDOM.render(
      window.React.createElement(PreactDevtoolsApp, {
        isOSSLynxDevtool: true,
        addEventListener: addEventListener(PreactDevtoolsPanel.id),
        postMessage: postMessage(PreactDevtoolsPanel.id),
        addOnScreenCastPanelUINodeIdSelectedListener: (listener: (UINodeId: string) => void) => {
          this.onScreenCastPanelUINodeIdSelectedListeners.push(listener);
        },
        onPreactDevtoolsPanelUINodeIdSelected: (UINodeId: string) => {
          this.onPreactDevtoolsPanelUINodeIdSelected(UINodeId);
        }
      }),
      this.contentElement
    );
  }
  
  onPreactDevtoolsPanelUINodeIdSelected(UINodeId: string) {
    window.postMessage({
      type: 'panel:preact_devtools',
      content: {
        type: 'PreactDevtoolsPanelUINodeIdSelected',
        message: {
          UINodeId,
        },
      },
    }, '*')
  }

  static instance(opts: {
    forceNew: boolean | null,
  } = { forceNew: null }): PreactDevtoolsPanel {
    const { forceNew } = opts;
    if (!preactDevtoolsPanelInstance || forceNew) {
      preactDevtoolsPanelInstance = new PreactDevtoolsPanel();
    }

    return preactDevtoolsPanelInstance;
  }
}
