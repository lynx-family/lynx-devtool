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

const CODEX_PLUGIN_ID = 'codex-agent';
const DEVTOOL_PLUGIN_ID = 'devtool';
const CODEX_COMPANION_EVENT_NAME = 'codex:companion-visibility';
const CODEX_COMPANION_PANEL_ID = 'uitree-drawer';

export default function RendererPluginView(props: { plugins: any[] }) {
  const { plugins } = props;
  if (plugins.length === 0) {
    return null;
  }
  const filteredPlugins = plugins.filter((plugin) => !plugin.disable && plugin.valid);
  const initialPluginId = sessionStorage.getItem(KEY_CURRENT_PLUGIN_ID) ?? filteredPlugins[0]?.id;

  const [currentPluginId, setCurrentPluginId] = useState(initialPluginId);
  const [currentModalPlugin, setCurrentModalPlugin] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() => window.innerWidth);
  const componentCacheRef = useRef<Record<string, React.ReactElement>>({});
  const contextCacheRef = useRef<Record<string, RendererContext>>({});
  const devtoolPlugin = filteredPlugins.find((plugin) => plugin.id === DEVTOOL_PLUGIN_ID);
  const currentPlugin = filteredPlugins.find((plugin) => plugin.id === currentPluginId) ?? filteredPlugins[0];
  const isCodexCompanionLayout = currentPluginId === CODEX_PLUGIN_ID && Boolean(devtoolPlugin);
  const isVerticalCodexCompanionLayout = isCodexCompanionLayout && viewportWidth < 1280;

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

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const devtoolContext = contextCacheRef.current[DEVTOOL_PLUGIN_ID];
    if (!devtoolContext) {
      return;
    }

    devtoolContext.publishPluginEvent({
      pluginId: DEVTOOL_PLUGIN_ID,
      eventName: CODEX_COMPANION_EVENT_NAME,
      params: {
        visible: isCodexCompanionLayout,
        focusPanelId: CODEX_COMPANION_PANEL_ID
      }
    });
  }, [isCodexCompanionLayout]);

  usePluginUsageTracker(currentPluginId);

  return (
    <div className="ldt-container">
      {isCodexCompanionLayout && devtoolPlugin && currentPlugin ? (
        <div
          className="overlay-component overlay-component--companion"
          style={{ flexDirection: isVerticalCodexCompanionLayout ? 'column' : 'row' }}
        >
          <div
            className="plugin-container plugin-container--companion"
            style={{
              flex: isVerticalCodexCompanionLayout ? '0 0 45%' : '0 0 42%',
              borderRight: !isVerticalCodexCompanionLayout ? '1px solid #d9d9d9' : undefined,
              borderBottom: isVerticalCodexCompanionLayout ? '1px solid #d9d9d9' : undefined
            }}
          >
            {produceComponent(devtoolPlugin)}
          </div>
          <div
            className="plugin-container plugin-container--active"
            style={{ flex: isVerticalCodexCompanionLayout ? '1 1 55%' : '1 1 58%' }}
          >
            {renderSwitchComponent(currentPlugin)}
          </div>
        </div>
      ) : (
        <div className="overlay-component">
          {currentPlugin && (
            <div className="plugin-container plugin-container--active">{renderSwitchComponent(currentPlugin)}</div>
          )}
        </div>
      )}
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
