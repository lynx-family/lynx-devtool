// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  PLUGIN_EVENT_PLUGIN_CHANGED,
  PLUGIN_EVENT_SELECTOR_CHANGED,
  PLUGIN_EVENT_SHOW,
  PLUGIN_EVENT_SHOW_MODAL,
  PLUGIN_EVENT_SWITCH_VIEW
} from '@/constants/event';
import { RendererContext } from '@/renderer/utils/context';
import { sortToolsByPriority } from '@/renderer/utils/plugin';
import { sendStatisticsEvent, STATISTICS_EVENT_NAME } from '@/renderer/utils/statisticsUtils';
import { FileTextOutlined } from '@ant-design/icons';
import { Select } from 'antd';
const ipcRenderer = window.ldtElectronAPI;
import { useEffect, useMemo, useState } from 'react';
import { KEY_CURRENT_PLUGIN_ID } from '../../constants';
import ConnectionStatus from '../connection/ConnectionStatus';
import DeviceSelect from '../connection/DeviceSelect';
import SessionSelect from '../connection/SessionSelect';
import { iconMap } from './icons';
import './index.scss';

const SelectorComponent = function (props) {
  const { tool } = props;
  const [value, setValue] = useState(tool.options?.[0].value || null);

  const onChange = (data) => {
    setValue(data);
    ipcRenderer.invoke(PLUGIN_EVENT_SELECTOR_CHANGED, { pluginId: tool.id, value: data });
  };

  useEffect(() => {
    const renderContext = new RendererContext({ plugin: tool });
    renderContext.asyncBridge.getViewMode().then((res) => {
      setValue(res.mode);
    });
  }, []);

  return (
          <Select className="plugin-select" placeholder="Please select" value={value} onChange={onChange}>
      {tool.options.map((option) => (
        <Select.Option value={option.value} key={option.value}>
          {option.label}
        </Select.Option>
      ))}
    </Select>
  );
};

const PluginIcon = function (props) {
  const { tool } = props;
  const CustomIcon = typeof tool.icon === 'function' ? tool.icon : iconMap[tool.icon];
  return <div className="plugin-icon">{CustomIcon ? <CustomIcon /> : <FileTextOutlined />}</div>;
};

const ButtonComponent = function (props) {
  const { tool, selectedButton, onShow } = props;
  return (
    <>
      <div
        className={`plugin-button-icon-group ${selectedButton === tool.id ? 'active' : ''}`}
        onClick={() => onShow(tool.id)}
      >
        <PluginIcon tool={tool} />
        <button className={`plugin-button`}></button>
      </div>
      <span className="plugin-label">{tool.name}</span>
    </>
  );
};

const RadioComponent = function (props) {
  const { tool, selectedButton, onSwitch, onShow } = props;
  return (
    <>
      <div
        className={`plugin-button-icon-group ${selectedButton === tool.id ? 'active' : ''}`}
        onClick={() => {
          onSwitch(tool.id);
          onShow(tool.id);
        }}
      >
        <PluginIcon tool={tool} />
        <button className="plugin-button"></button>
      </div>
      <span className="plugin-label">{tool.name}</span>
    </>
  );
};

const SideSheetComponent = function (props) {
  const { tool, selectedButton, onShow } = props;
  const onClick = (pluginId) => {
    ipcRenderer.invoke(PLUGIN_EVENT_SHOW_MODAL, { pluginId });
    onShow(pluginId);
  };
  return (
    <>
      <div
        className={`plugin-button-icon-group ${selectedButton === tool.id ? 'active' : ''}`}
        onClick={() => {
          onClick(tool.id);
        }}
      >
        <PluginIcon tool={tool} />
        <button className={`plugin-button`}></button>
      </div>
      <span className="plugin-label">{tool.name}</span>
    </>
  );
};

const Tool = function (props) {
  const { tool, selectedButton, onSwitch } = props;

  const onShow = (pluginId) => {
    ipcRenderer.invoke(PLUGIN_EVENT_SHOW, { pluginId });
  };

              // Fix the issue of repeated initialization of custom type plugins
  const custom = useMemo(() => {
    if (tool.mode === 'custom' && tool.entry) {
      const CustomEntry = tool.entry(new RendererContext({ plugin: tool }));
      return <CustomEntry />;
    }
    return null;
  }, [tool]);

  if (tool.mode === 'selector') {
    return <SelectorComponent tool={tool} />;
  }

  if (tool.mode === 'button') {
    return <ButtonComponent tool={tool} selectedButton={selectedButton} onShow={onShow} />;
  }

  if (tool.mode === 'radio') {
    return <RadioComponent tool={tool} selectedButton={selectedButton} onSwitch={onSwitch} onShow={onShow} />;
  }

  if (tool.mode === 'side-sheet') {
    return <SideSheetComponent tool={tool} onSwitch={onSwitch} onShow={onShow} />;
  }

  return custom;
};

export default function PluginEntry(props) {
  const { tools } = props;
  console.log('tools--->:', tools);
  if (tools.length === 0) {
    return null;
  }
  const leftTools = tools.filter(
    (tool) => tool.valid && !tool.disable && (tool.position === 'left' || tool.position === undefined)
  );
  const rightTools = tools.filter((tool) => tool.valid && !tool.disable && tool.position === 'right');
  const sortedLeftTools = sortToolsByPriority(leftTools);
  const sortedRightTools = sortToolsByPriority(rightTools);
  let selectPluginId = sessionStorage.getItem(KEY_CURRENT_PLUGIN_ID);
  if (!selectPluginId || !sortedLeftTools.find((tool) => tool.id === selectPluginId)) {
    selectPluginId = sortedLeftTools[0]?.id;
  }

  const [selectedButton, setSelectedButton] = useState(selectPluginId);
  const handleButtonClick = (buttonName, isFromInit) => {
    console.log('handleButtonClick', buttonName, isFromInit);
    ipcRenderer.invoke(PLUGIN_EVENT_SWITCH_VIEW, { pluginId: buttonName }).then((isSucceed) => {
      if (isSucceed && !isFromInit) {
        sendStatisticsEvent({
          name: STATISTICS_EVENT_NAME.PLUGIN,
          categories: {
            action: 'switch',
            plugin: buttonName
          }
        });
        setSelectedButton(buttonName);
      }
    });
  };
  useEffect(() => {
    if (selectPluginId) {
      const isFromInit = true;
      handleButtonClick(selectPluginId, isFromInit);
    }
    const listener = (_, { pluginId }) => {
      setSelectedButton(pluginId);
    };
    ipcRenderer.on(PLUGIN_EVENT_PLUGIN_CHANGED, listener);
    return () => {
      ipcRenderer.off(PLUGIN_EVENT_PLUGIN_CHANGED, listener);
    };
  }, []);
  return (
    <div className="plugin-buttons-container">
      <div className="plugin-entry-container">
        <div className="plugin-entry-left">
          {sortedLeftTools.map((tool) => {
            console.log('tool', tool);
            return (
              <div className={`plugin-button-container`} key={tool.id}>
                <Tool tool={tool} selectedButton={selectedButton} onSwitch={handleButtonClick} />
              </div>
            );
          })}
        </div>
        <div className="plugin-entry-right">
          <SessionSelect />
          <DeviceSelect />
          <ConnectionStatus />
          {sortedRightTools.map((tool) => {
            console.log('tool', tool);
            return (
              <div className={`plugin-button-container`} key={tool.id}>
                <Tool tool={tool} selectedButton={selectedButton} onSwitch={handleButtonClick} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
