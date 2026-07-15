// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { MainContext, MainPlugin, PluginEvent } from '@lynx-js/devtool-plugin-core/main';
import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import {
  PLUGIN_EVENT_ASYNC_BRIDGE,
  PLUGIN_EVENT_CUSTOM_EVENT,
  PLUGIN_EVENT_CUSTOM_EVENT_RESPONSE,
  PLUGIN_EVENT_ENV_LOG,
  PLUGIN_EVENT_GET_ALL_PLUGINS,
  PLUGIN_EVENT_GET_PLATFORM_PLUGINS,
  PLUGIN_EVENT_MODAL_SHOW,
  PLUGIN_EVENT_PLUGIN_CHANGED,
  PLUGIN_EVENT_PLUGIN_CREATED,
  PLUGIN_EVENT_SELECTOR_CHANGED,
  PLUGIN_EVENT_SHOW,
  PLUGIN_EVENT_SHOW_MODAL,
  PLUGIN_EVENT_SWITCH_VIEW
} from '../../constants/event';
import ldt from '../App';
import usbManager from '../mobile/usb';
import { getVersionFromPackageJson, downloadNpmPackage } from '../mobile/package';
import ldtConfig from '../utils/config';
import { LDT_DIR } from '../utils/const';
import { EnvLogManager } from '@lynx-js/lynx-devtool-cli';
import { EnvLogClient } from '@lynx-js/lynx-devtool-cli/src/types/envLog';
import fs from 'fs';
import ldtServer from '../utils/server';

const { meta } = require('virtualModules');

const INTERNAL_MAIN_PLUGINS = meta;

type PlatformPluginMeta = {
  _id: string;
  name: string;
  type: string;
  location: string;
  description: string;
  url: string;
  path: string;
  disable: boolean;
  visible: boolean;
  isValid: string;
  /**
   * Plugin grouping field
   * Plugins with the same group will be merged into one entry, with name as the navigation bar name
   * Used to satisfy cases where multiple plugins want to share one entry (such as Lynx's TestBench, Trace, etc.)
   * groupId must be globally unique
   * groupName will be used as the main entry name for the plugin group
   */
  groupId?: string;
  groupName?: string;
};

type PluginMeta = {
  id: string;
  name: string;
  description: string;
  mode: 'radio' | 'selector' | 'button' | 'side-sheet' | 'modal';
  hasView: boolean;
  visible?: boolean;
  plugin: MainPlugin;
  isInternal?: boolean;
  valid: boolean;
  /**
   * Plugin grouping field
   * Plugins with the same group will be merged into one entry, with name as the navigation bar name
   * Used to satisfy cases where multiple plugins want to share one entry (such as Lynx's TestBench, Trace, etc.)
   * groupId must be globally unique
   * groupName will be used as the main entry name for the plugin group
   */
  groupId?: string;
  groupName?: string;
};

const PLUGIN_MANAGER_GLOBAL_NAME = 'PLUGIN_MANAGER_GLOBAL_NAME';

export default class PluginManager {
  plugins: PluginMeta[];
  platformPlugins: PluginMeta[];
  installOptions: any;
  private win: BrowserWindow | null = null;
  private context: MainContext & { window: BrowserWindow | null };
  private pluginEnvLoggerMap: Map<string, EnvLogClient>;
  private messageIndex = 1;
  private customEventResponseMap = new Map<number, { resolve: (value: any) => void; timer: any }>();
  private cacheCustemEvents: PluginEvent[] = [];
  private renderInitialized = false;

  constructor() {
    this.pluginEnvLoggerMap = new Map();
    this.publishPluginEvent = this.publishPluginEvent.bind(this);
    this.invokePluginEvent = this.invokePluginEvent.bind(this);
    this.collect();
    this.registerEvents();
  }

  static getInstance(): PluginManager {
    if (!(global as any)[PLUGIN_MANAGER_GLOBAL_NAME]) {
      (global as any)[PLUGIN_MANAGER_GLOBAL_NAME] = new PluginManager();
    }
    return (global as any)[PLUGIN_MANAGER_GLOBAL_NAME];
  }
  registerEvents() {
    ipcMain.handle(PLUGIN_EVENT_ASYNC_BRIDGE, (_, { pluginId, groupPluginIds }, methodName, ...args) => {
      return this.callBridge({ pluginId, groupPluginIds }, methodName, ...args);
    });
    ipcMain.handle(PLUGIN_EVENT_SWITCH_VIEW, (_, { pluginId }) => {
      if (!this.win) {
        return false;
      }
      console.log('PLUGIN_EVENT_SWITCH_VIEW', pluginId);
      this.win.webContents.send(PLUGIN_EVENT_PLUGIN_CHANGED, { pluginId });
      return true;
    });
    ipcMain.handle(PLUGIN_EVENT_SHOW_MODAL, (_, { pluginId }) => {
      if (!this.win) {
        return false;
      }
      this.win.webContents.send(PLUGIN_EVENT_MODAL_SHOW, { pluginId });
      return true;
    });
    ipcMain.handle(PLUGIN_EVENT_SELECTOR_CHANGED, (_, { pluginId, value }) => {
      this.select({ pluginId, value });
    });
    ipcMain.handle(PLUGIN_EVENT_SHOW, (_, { pluginId }) => {
      this.show({ pluginId });
    });
    ipcMain.handle(PLUGIN_EVENT_GET_ALL_PLUGINS, () => {
      return this.context.plugin;
    });
    ipcMain.handle(PLUGIN_EVENT_GET_PLATFORM_PLUGINS, () => {
      return this.platformPlugins;
    });
    ipcMain.handle(PLUGIN_EVENT_CUSTOM_EVENT_RESPONSE, (_, { id, data }) => {
      const { resolve, timer } = this.customEventResponseMap.get(id) ?? {};
      if (resolve) {
        resolve(data);
      }
      if (timer) {
        clearTimeout(timer);
      }
      this.customEventResponseMap.delete(id);
    });
    ipcMain.handle(PLUGIN_EVENT_PLUGIN_CREATED, (_) => {
      this.renderInitialized = true;
      this.cacheCustemEvents.forEach((event) => {
        this.publishPluginEvent(event);
      });
      this.cacheCustemEvents.length = 0;
    });
    // env log
    ipcMain.handle(PLUGIN_EVENT_ENV_LOG, (_, pluginId, { level, msg, categories }) => {
      let envLogger = this.pluginEnvLoggerMap.get(pluginId);
      if (!envLogger) {
        envLogger = EnvLogManager.initLogClient({
          filename: `ldt-plugin-${pluginId}`
        });
        this.pluginEnvLoggerMap.set(pluginId, envLogger);
      }
      if (!envLogger) {
        // init env logger fail, error will be reported inside EnvLogManager
        return;
      }
      envLogger.log(level, msg, categories);
    });
  }
  collect() {
    const pluginConfig = ldtConfig.getConfig<any>('simulatorPlugin', { plugins: [] });
    const internalPluginsMeta = pluginConfig.plugins.filter((plugin) => plugin.isInternal);
    const externalPluginsMeta = pluginConfig.plugins.filter((plugin) => !plugin.isInternal);
    const internalPlugins = INTERNAL_MAIN_PLUGINS.map((plugin) => {
      const disable = internalPluginsMeta.find((p) => p.id === plugin.id)?.disable;
      return {
        disable: disable ?? false,
        visible: plugin.visible ?? true,
        valid: this.isValid(plugin),
        ...plugin
      };
    });
    const externalPlugins = externalPluginsMeta
      .map((plugin) => {
        try {
          const pluginPath = plugin.path;
          const valid = this.isValid(plugin);

          // @ts-ignore
          const pluginMain = valid ? __non_webpack_require__(path.join(pluginPath, 'dist', 'main', 'index.js')) : null;
          // @ts-ignore
          const pluginPkgJson = __non_webpack_require__(path.join(pluginPath, 'package.json'));
          const { simulatorPlugin = {}, name, description } = pluginPkgJson;
          console.log('pluginMainDefault', pluginMain.default);
          return {
            id: name,
            description,
            plugin: pluginMain.default,
            path: pluginPath,
            disable: plugin.disable ?? false,
            visible: plugin.visible ?? true,
            valid,
            ...simulatorPlugin
          };
        } catch (e) {
          console.error('collect plugin error: ', e);
          return null;
        }
      })
      .filter((plugin) => plugin !== null);

    const platformPlugins = externalPluginsMeta
      // @ts-ignore
      .map((plugin) => {
        try {
          const pluginPath = plugin.path;
          const isPlatformPlugin = this.isPlatformPlugin(plugin);

          if (isPlatformPlugin) {
            const platformPluginPath = path.join(pluginPath, plugin.platformPlugin.entry);
            return {
              _id: plugin.name,
              id: plugin.name,
              name: plugin.name,
              type: 'lynx',
              location: 'panel',
              description: plugin.description,
              url: `http://${ldtServer.getHost()}/plugins/${plugin.platformPlugin.entry}`,
              path: platformPluginPath,
              disable: plugin.disable ?? false,
              visible: plugin.visible ?? true,
              valid: true,
              mode: 'radio',
              hasView: false,
              plugin: {},  // required
              platformPlugin: plugin.platformPlugin
            }
          }

        } catch (e) {
          console.error('collect plugin error: ', e);
          return null;
        }
      })
      .filter((plugin) => plugin !== null);
    this.platformPlugins = platformPlugins;
    this.plugins = [...internalPlugins, ...externalPlugins, ...platformPlugins].filter((plugin) => plugin.visible);
  }
  install(options) {
    this.installOptions = options;
    this.win = options.browserWindow;
    this.context = {
      plugin: {
        plugins: this.plugins.map((meta) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { plugin, ...others } = meta;
          return others;
        }),
        currentId: this.plugins[0].id
      },
      storage: ldtConfig,
      window: this.win,
      mobile: {
        usbManager
      },
      utils: {
        package: {
          getVersionFromPackageJson,
          downloadNpmPackage
        }
      },
      // Main process sends events to renderer process
      publishPluginEvent: this.publishPluginEvent,
      invokePluginEvent: this.invokePluginEvent,
      restart: ldt.restart.bind(ldt),
      constants: {
        LDT_DIR: LDT_DIR
      }
    };
  }
  reinstall() {
    this.collect();
    this.install(this.installOptions);
    this.reset();
  }

  reset() {
    this.renderInitialized = false;
    this.cacheCustemEvents.length = 0;
    this.customEventResponseMap.forEach(({ timer }) => {
      clearTimeout(timer);
    });
    this.customEventResponseMap.clear();
  }
  async select(params: { pluginId: string; value: string }) {
    const { pluginId, value } = params;
    for (const { plugin, id, valid } of this.plugins) {
      if (pluginId === id && typeof plugin.onSelect === 'function' && valid) {
        await (plugin as MainPlugin)?.onSelect?.(this.context, { value });
      }
    }
  }
  async create(params) {
    await Promise.all(
      this.plugins
        .filter(({ plugin, valid }) => typeof plugin.onCreate === 'function' && valid)
        .map(({ plugin }) => {
          // TODO: Execute lifecycle methods of original plugins in plugin grouping scenarios
          return plugin.onCreate?.(this.context, params);
        })
    );
  }
  async restart(params) {
    this.collect();
    this.reinstall();
    await Promise.all(
      this.plugins
        .filter(({ plugin, valid }) => typeof plugin.onRestart === 'function' && valid)
        .map(({ plugin }) => {
          // TODO: Execute lifecycle methods of original plugins in plugin grouping scenarios
          return plugin.onRestart?.(this.context, params);
        })
    );
  }
  async show(params) {
    await Promise.all(
      this.plugins
        .filter(({ plugin, id, valid }) => params.pluginId === id && typeof plugin.onShow === 'function' && valid)
        .map(({ plugin }) => {
          // TODO: Execute lifecycle methods of original plugins in plugin grouping scenarios
          return plugin.onShow?.(this.context, params);
        })
    );
  }
  callBridge(sourceInfo: { pluginId: string; groupPluginIds?: string[] }, methodName: string, ...args: any[]) {
    const { pluginId, groupPluginIds = [] } = sourceInfo;
    for (const { plugin, id } of this.plugins) {
      const bridge = plugin?.asyncBridge?.(this.context);
      if (pluginId === id && bridge && typeof bridge[methodName] === 'function') {
        return bridge[methodName](...args);
      }
    }
    // In plugin grouping scenarios, try to find the bridge of grouped plugins
    if (groupPluginIds.length > 0) {
      for (const groupPluginId of groupPluginIds) {
        const rawPlugin = this.plugins.find(({ id }) => id === groupPluginId);
        const rawBridge = rawPlugin?.plugin?.asyncBridge?.(this.context);
        if (rawBridge && typeof rawBridge[methodName] === 'function') {
          return rawBridge[methodName](...args);
        }
      }
    }
    return Promise.reject(new Error(`Method ${methodName} does not exist`));
  }

  // Main process sends events to renderer process
  publishPluginEvent(event: PluginEvent) {
    if (!this.renderInitialized) {
      this.cacheCustemEvents.push(event);
      return;
    }
    this.win?.webContents?.send(PLUGIN_EVENT_CUSTOM_EVENT, event);
  }

  invokePluginEvent(event: PluginEvent): Promise<any> {
    const id = this.messageIndex++;
    event.id = id;
    event.isAsync = true;
    this.publishPluginEvent(event);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('invokePluginEvent timeout'));
        this.customEventResponseMap.delete(id);
      }, event.timeout || 30000);
      this.customEventResponseMap.set(id, { resolve, timer });
    });
  }

  isValid(plugin) {
    if (plugin.target === 'simulator' || plugin.target === 'web') {
      // TODO(talisk): hard code here temporarily
      return false;
    }
    return true;
  }

  isPlatformPlugin(plugin) {
    return plugin.platformPlugin !== undefined;
  }
}
