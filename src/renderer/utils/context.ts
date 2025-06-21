// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  PLUGIN_EVENT_ASYNC_BRIDGE,
  PLUGIN_EVENT_CUSTOM_EVENT_RESPONSE,
  PLUGIN_EVENT_ENV_LOG,
  PLUGIN_EVENT_SWITCH_VIEW
} from '@/constants/event';
import useUser, { UserStoreType } from '@/renderer/ldt/store/user';
import debugDriver from '@/renderer/utils/debugDriver';
import {
  IDebugDriver,
  RendererContext as IPluginRendererContext,
  PluginEnvLog,
  PluginTrackEvent
} from '@lynx-js/devtool-plugin-core/renderer';
import { AxiosRequestConfig } from 'axios';
const { ipcRenderer } = window.ldtElectronAPI;
import ConnectionView from '../ldt/components/device/ConnectionEmpty';
// import LoginView from '../ldt/components/login';
// import useldtConnection, { XdbConnectionStoreType } from '../ldt/store/ldtConnection';
import xdbDriver from '../ldt/utils/xdbDriver';
import useConnection from '../hooks/connection';
import { getStore, InitStore, State } from './flooks';
import { sendStatisticsEvent } from './statisticsUtils';
// import HostSelectView from '../ldt/components/host/HostSelect';

const getAppPath = (() => {
  let appPath: string;
  return () => {
    if (appPath) {
      return appPath;
    }
    appPath = `file://${ipcRenderer.sendSync('getAppPath')}`;
    return appPath;
  };
})();

export interface PluginEvent {
  id?: number;
  pluginId: string;
  eventName: string;
  params: any;
  isAsync?: boolean;
  timeout?: number;
}

// TODO: fix all types
export class RendererContext implements IPluginRendererContext {
  asyncBridge: any;
  plugin: any;
  appPath: string;
  debugDriver: IDebugDriver;
  logger: {
    sendEvent: (event: PluginTrackEvent) => void;
    sendEnvLog: (log: PluginEnvLog) => void;
  };
  switchView: (options: { pluginId: string }) => void;
  ldt: {
    xdbDriver: typeof xdbDriver;
    useUser: (initStore: InitStore<UserStoreType>) => UserStoreType;
  };
  components: {
    ConnectionView: () => JSX.Element;
  };
  useConnection: any;
  getStore: <T extends State>(initStore: InitStore<T>) => T;

  private _pluginEventListeners = new Map<string, ((event: PluginEvent) => Promise<any> | any)[]>();
  constructor({ plugin }: { plugin: any }) {
    this.plugin = plugin;
    this.debugDriver = debugDriver;
    this.appPath = getAppPath();
    this.logger = {
      sendEvent: ({ name, categories, metrics }) => {
        return sendStatisticsEvent({ name: `plugin-${plugin.id}-${name}`, categories, metrics });
      },
      sendEnvLog: (log) => {
        ipcRenderer.invoke(PLUGIN_EVENT_ENV_LOG, plugin.id, log);
      }
    };
    this.switchView = ({ pluginId }) => {
      console.log('switchView', pluginId);
      ipcRenderer.invoke(PLUGIN_EVENT_SWITCH_VIEW, { pluginId });
    };
    this.asyncBridge = new Proxy(
      {},
      {
        get: (_, methodName) => {
          return async (...args) => {
            return await ipcRenderer.invoke(
              PLUGIN_EVENT_ASYNC_BRIDGE,
              { pluginId: this.plugin.id, groupPluginIds: this.plugin.groupPlugins?.map(({ id }) => id) },
              methodName,
              ...args
            );
          };
        }
      }
    );
    this.useConnection = useConnection;
    this.getStore = getStore;
    this.ldt = {
      xdbDriver,
      useUser,
    };
    this.components = {
      ConnectionView
    };
  }

  publishPluginEvent(event: PluginEvent) {
    this._pluginEventListeners.get(event.eventName)?.forEach((listener) => {
      const resp = listener(event);
      if (event.isAsync && event.id) {
        if (resp instanceof Promise) {
          resp.then((data) => {
            ipcRenderer.invoke(PLUGIN_EVENT_CUSTOM_EVENT_RESPONSE, { id: event.id, data });
          });
        } else {
          ipcRenderer.invoke(PLUGIN_EVENT_CUSTOM_EVENT_RESPONSE, { id: event.id, data: resp });
        }
      }
    });
  }

  addPluginEventListener(eventName: string, listener: (event: PluginEvent) => void) {
    if (this._pluginEventListeners.has(eventName)) {
      this._pluginEventListeners.get(eventName)?.push(listener);
    } else {
      this._pluginEventListeners.set(eventName, [listener]);
    }
  }

  removePluginEventListener(eventName: string, listener: (event: PluginEvent) => void) {
    if (this._pluginEventListeners.has(eventName)) {
      const listeners = this._pluginEventListeners.get(eventName);
      if (listeners) {
        const index = listeners?.indexOf(listener);
        if (index !== -1) {
          listeners?.splice(index, 1);
        }
      }
    }
  }
}
