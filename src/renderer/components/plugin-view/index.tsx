// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  PLUGIN_EVENT_MODAL_SHOW,
  PLUGIN_EVENT_PLUGIN_CHANGED,
  PLUGIN_EVENT_CUSTOM_EVENT,
  PLUGIN_EVENT_PLUGIN_CREATED
} from '@/constants/event';
import { RendererContext } from '@/renderer/utils/context';
import { Drawer } from 'antd';
const ipcRenderer = window.ldtElectronAPI;
import { useEffect, useRef, useState } from 'react';
import './index.scss';
import { KEY_CURRENT_PLUGIN_ID } from '../../constants';
import { sendStatisticsEvent, STATISTICS_EVENT_NAME } from '@/renderer/utils/statisticsUtils';
import { usePluginUsageTracker } from '@/renderer/hooks/usage-tracker';

export default function RendererPluginView(props: { plugins: any[] }) {
  const { plugins } = props;
  if (plugins.length === 0) {
    return null;
  }
  const filteredPlugins = plugins.filter((plugin) => !plugin.disable && plugin.valid);

  const [currentPluginId, setCurrentPluginId] = useState();
  const [currentModalPlugin, setCurrentModalPlugin] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const componentCacheRef = useRef<Record<string, React.ReactElement>>({});
  const contextCacheRef = useRef<Record<string, RendererContext>>({});

  const produceComponent = (plugin: any) => {
    if (plugin.plugin && !componentCacheRef.current[plugin.id]) {
      const rendererContext = new RendererContext({ plugin });
      const PluginComponent = plugin.plugin(rendererContext);
      componentCacheRef.current[plugin.id] = <PluginComponent />;
      contextCacheRef.current[plugin.id] = rendererContext;
    }
    return componentCacheRef.current[plugin.id];
  };

  const renderSwitchComponent = (plugin: any) => {
    if (plugin.id === currentPluginId) {
      // No need to track here when modal is open, as there will be separate tracking
      if (!modalVisible) {
        sendStatisticsEvent({
          name: STATISTICS_EVENT_NAME.SIMULATOR,
          categories: {
            action: 'show',
            plugin: plugin.id
          }
        });
      }
      return produceComponent(plugin);
    }
    return componentCacheRef.current[plugin.id];
  };

  useEffect(() => {
    const listener = (_, { pluginId }) => {
      console.log('listener', pluginId);
      setCurrentPluginId(pluginId);
      sessionStorage.setItem(KEY_CURRENT_PLUGIN_ID, pluginId);
    };
    const modalListener = (_, { pluginId }) => {
      console.log('modalListener', pluginId);
      const plugin = filteredPlugins.find((p) => p.id === pluginId);
      sendStatisticsEvent({
        name: STATISTICS_EVENT_NAME.SIMULATOR,
        categories: {
          action: 'show',
          plugin: plugin.id
        }
      });
      setCurrentModalPlugin(plugin);
      setModalVisible(true);
    };
    const pluginEventListener = (_, event) => {
      const { pluginId } = event;
      // If no targetContainerID is passed, broadcast to all plugins
      if (pluginId) {
        const context = contextCacheRef.current[pluginId];
        if (context) {
          context.publishPluginEvent(event);
        }
      } else {
        Object.values?.(contextCacheRef.current)?.forEach((context) => {
          context.publishPluginEvent(event);
        });
      }
    };
    ipcRenderer.invoke(PLUGIN_EVENT_PLUGIN_CREATED, {});
    ipcRenderer.on(PLUGIN_EVENT_PLUGIN_CHANGED, listener);
    ipcRenderer.on(PLUGIN_EVENT_MODAL_SHOW, modalListener);
    ipcRenderer.on(PLUGIN_EVENT_CUSTOM_EVENT, pluginEventListener);
    return () => {
      ipcRenderer.off(PLUGIN_EVENT_PLUGIN_CHANGED, listener);
      ipcRenderer.off(PLUGIN_EVENT_MODAL_SHOW, modalListener);
      ipcRenderer.off(PLUGIN_EVENT_CUSTOM_EVENT, pluginEventListener);
    };
  }, []);

  usePluginUsageTracker(currentPluginId);

  return (
    <div className="ldt-container">
      <div className="overlay-component">
        {filteredPlugins.map((plugin) => (
          <div
            key={plugin.id}
            className="plugin-container"
            style={{ display: currentPluginId === plugin.id ? 'block' : 'none' }}
          >
            {renderSwitchComponent(plugin)}
          </div>
        ))}
      </div>
      {currentModalPlugin && (
        <Drawer
          width={'50vw'}
          open={modalVisible}
          title={currentModalPlugin.name}
          onClose={() => setModalVisible(false)}
        >
          {produceComponent(currentModalPlugin)}
        </Drawer>
      )}
    </div>
  );
}
