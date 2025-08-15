// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { definePlugin } from '@lynx-js/devtool-plugin-core/main';
import type { AsyncBridgeType } from '../bridge';
import fs from 'fs-extra';
import path, { join } from 'path';
import os from 'node:os';
const PLUGIN_RELATIVE_DIR = 'plugins';
export default definePlugin<AsyncBridgeType>({
  asyncBridge(context) {
    return {
      installPlugin: async ({ pkgName, pkgVersion }) => {
        const pluginPath = await context.utils.package.downloadNpmPackage(pkgName, pkgVersion, PLUGIN_RELATIVE_DIR, {
          checkVersion: false
        });
        if (!pluginPath) {
          throw new Error('install plugin failed');
        }
        return join(pluginPath as string, 'package');
      },
      getPluginMeta: async (pluginPath: string) => {
        const pkgJsonPath = path.join(pluginPath, 'package.json');
        const packageJson = await fs.readJSON(pkgJsonPath);
        return {
          id: packageJson.name,
          name: packageJson.name,
          description: packageJson.description,
          disable: false,
          path: pluginPath,
          ...(packageJson.simulatorPlugin || {})
        };
      },
      getPluginConfig: async () => {
        const plugins = await Promise.all(
          context.plugin.plugins.map(async (plugin) => {
            if (!plugin.isInternal && plugin.path) {
              [plugin.version] = await context.utils.package.getVersionFromPackageJson(plugin.path);
            }
            return plugin;
          })
        );
        return Promise.resolve({ plugins });
      },
      savePluginConfig: (plugin) => {
        context.storage.setConfig('simulatorPlugin', plugin);
        context.restart();
        return Promise.resolve();
      },

      updatePlatformPlugin: (pluginMeta: {path, platformPlugin?: {entry}}) =>  {
        const ldtPath = path.resolve(path.resolve(os.homedir(), '.lynx-devtool'), '3x', '@lynx-js', 'lynx-devtool-cli');
        // TODO(talisk): template path, and compare the key of plugins
        const pluginPath = path.resolve(ldtPath, "dist/static/ldt_home/dist/plugins", pluginMeta.platformPlugin?.entry)
        if (fs.existsSync(pluginPath)) {
          fs.removeSync(pluginPath)
        }
        fs.copySync(path.join(pluginMeta.path, pluginMeta.platformPlugin?.entry), pluginPath)
        return Promise.resolve();
      }
    };
  }
});