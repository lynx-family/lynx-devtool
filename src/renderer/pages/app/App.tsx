// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { PLUGIN_EVENT_GET_ALL_PLUGINS, UPDATER_EVENT_DOWNLOAD_PROGRESS } from '@/constants/event';
import RendererPluginEntry from '@/renderer/components/plugin-entry';
import RendererPluginView from '@/renderer/components/plugin-view';
import useConnection from '@/renderer/hooks/connection';
import { ROOM_ID, WS } from '@/renderer/utils';
const ipcRenderer = window.ldtElectronAPI;
import { useEffect, useState } from 'react';
import 'antd/dist/reset.css';
import './App.scss';
import { queryService } from '@/renderer/utils/query';
import { ConfigProvider } from 'antd';
import { ProcessedPluginMeta } from '@/types/plugin-manager';
import { organizePluginsByGroup } from '@/renderer/utils/plugin';

const { meta } = require('virtualModules');

const INTERNAL_RENDERER_PLUGINS = meta;

const requireWithCatch = (modulePath) => {
  try {
    // @ts-ignore
    return __non_webpack_require__(modulePath);
  } catch (e) {
    console.log('error', e);
    // Ingnore the error here because the entry cannot find the error that is not necessary
    return undefined;
  }
};

const App = () => {
  const [plugins, setPlugins] = useState<any[]>([]);

  const { openConnection } = useConnection();

  useEffect(() => {
    document.title = `Lynx DevTool (${queryService.getQuery('version') ?? 'unknown'})${queryService.getQuery('is_prod') === 'true' ? '' : ' (dev)'}`;
    if (WS && ROOM_ID) {
      openConnection(WS, ROOM_ID);
    }
  }, []);

  useEffect(() => {
    ipcRenderer
      .invoke(PLUGIN_EVENT_GET_ALL_PLUGINS, {})
      .then(({ plugins: allPlugins }: { plugins: ProcessedPluginMeta[] }) => {
        const internalPluginsMeta = allPlugins.filter((p) => p.isInternal);
        const externalPluginsMeta = allPlugins.filter((p) => !p.isInternal);
        const internalPlugins: ProcessedPluginMeta[] = INTERNAL_RENDERER_PLUGINS.map((plugin) => {
          // eslint-disable-next-line max-nested-callbacks
          const p = internalPluginsMeta.find((item) => item.id === plugin.id);
          return { disable: p?.disable ?? false, ...plugin, valid: p?.valid ?? true, visible: Boolean(p) || false };
        }).filter((p) => p.visible);
        const externalPlugins: ProcessedPluginMeta[] = externalPluginsMeta.map((meta) => {
          const { path, ...others } = meta;
          const entry = requireWithCatch(`${path}/dist/entry/index.js`)?.default;
          const plugin = requireWithCatch(`${path}/dist/renderer/index.js`)?.default;
          const { name, description, simulatorPlugin } = requireWithCatch(`${path}/package.json`) || ({} as any);
          console.log('--------------------------------');
          console.log(meta);
          console.log(name, description, simulatorPlugin);
          console.log('--------------------------------');

          return {
            ...others,
            entry,
            plugin,
            id: name,
            description,
            valid: meta.valid,
            ...simulatorPlugin
          };
        });
        const internalGroupedPlugins = organizePluginsByGroup(internalPlugins);
        const externalGroupedPlugins = organizePluginsByGroup(externalPlugins);

        setPlugins([...internalGroupedPlugins, ...externalGroupedPlugins]);
      });
  }, []);

  return (
    <ConfigProvider theme={{ cssVar: { key: 'lynx-devtool' } }}>
      <div className="ldt-navbar">
        <RendererPluginEntry tools={plugins} />
      </div>
      <div className="ldt-app">
        <RendererPluginView plugins={plugins} />
      </div>
    </ConfigProvider>
  );
};

export default App;
