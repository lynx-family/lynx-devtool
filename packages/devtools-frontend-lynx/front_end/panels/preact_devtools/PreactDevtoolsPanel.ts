// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as UI from '../../ui/legacy/legacy.js';

type ReactRuntime = {
  createElement: (type: unknown, props?: Record<string, unknown> | null) => unknown,
};

type ReactDOMRuntime = {
  render: (element: unknown, container: Element) => void,
};

type RuntimeScriptDescriptor = {
  src: string,
  integrity: string,
};

declare global {
  interface Window {
    React?: ReactRuntime;
    ReactDOM?: ReactDOMRuntime;
  }
}

let preactDevtoolsPanelInstance: PreactDevtoolsPanel;

const runtimeScriptLoads = new Map<string, Promise<void>>();
const reactRuntimeScripts: RuntimeScriptDescriptor[] = [
  {
    src: 'https://cdn.jsdelivr.net/npm/react@17.0.2/umd/react.production.min.js',
    integrity: 'sha384-7Er69WnAl0+tY5MWEvnQzWHeDFjgHSnlQfDDeWUvv8qlRXtzaF/pNo18Q2aoZNiO',
  },
  {
    src: 'https://cdn.jsdelivr.net/npm/react-dom@17.0.2/umd/react-dom.production.min.js',
    integrity: 'sha384-vj2XpC1SOa8PHrb0YlBqKN7CQzJYO72jz4CkDQ+ePL1pwOV4+dn05rPrbLGUuvCv',
  },
];

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

const loadRuntimeScript = ({ src, integrity }: RuntimeScriptDescriptor): Promise<void> => {
  const existingLoad = runtimeScriptLoads.get(src);
  if (existingLoad) {
    return existingLoad;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const selector = `script[data-ldt-runtime="${src}"]`;
    const existingScript = document.querySelector<HTMLScriptElement>(selector);
    if (existingScript) {
      if (existingScript.dataset.ldtRuntimeReady === 'true') {
        resolve();
        return;
      }
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error(`Failed to load runtime script: ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.ldtRuntime = src;
    script.integrity = integrity;
    script.src = src;
    script.addEventListener('load', () => {
      script.dataset.ldtRuntimeReady = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load runtime script: ${src}`)), { once: true });
    (document.head || document.documentElement).appendChild(script);
  });

  runtimeScriptLoads.set(src, promise);
  return promise;
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
  static PREACT_DEVTOOLS_BUNDLE_URL = 'https://unpkg.com/@lynx-js/preact-devtools@latest/dist/index.js';
  static #reactRuntimePromise: Promise<void> | null = null;

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

    this.renderStatus('Preact Devtools Panel is initializing...');
    void this.loadPreactDevtoolsBundle();
  }

  static async ensureReactRuntime(): Promise<void> {
    if (window.React && window.ReactDOM) {
      return;
    }

    if (!PreactDevtoolsPanel.#reactRuntimePromise) {
      PreactDevtoolsPanel.#reactRuntimePromise = (async () => {
        for (const script of reactRuntimeScripts) {
          await loadRuntimeScript(script);
        }
        if (!window.React || !window.ReactDOM) {
          throw new Error('React runtime is unavailable after loading the panel dependencies.');
        }
      })().catch(error => {
        PreactDevtoolsPanel.#reactRuntimePromise = null;
        throw error;
      });
    }

    await PreactDevtoolsPanel.#reactRuntimePromise;
  }

  renderStatus(message: string): void {
    this.contentElement.textContent = '';
    const div = document.createElement('div');
    div.textContent = message;
    this.contentElement.appendChild(div);
  }

  async loadPreactDevtoolsBundle() {
    try {
      this.renderStatus('Loading Preact Devtools Panel...');
      await PreactDevtoolsPanel.ensureReactRuntime();
      const preactDevtoolsBundle = await import(PreactDevtoolsPanel.PREACT_DEVTOOLS_BUNDLE_URL);
      const PreactDevtoolsApp = preactDevtoolsBundle.default;

      if (!window.React || !window.ReactDOM) {
        throw new Error('React runtime is unavailable.');
      }

      this.contentElement.textContent = '';
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
    } catch (error) {
      console.error('Failed to initialize Preact Devtools panel', error);
      this.renderStatus('Preact Devtools is unavailable. Check network access and reload the panel.');
    }
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
