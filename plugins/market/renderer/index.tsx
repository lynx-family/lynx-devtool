// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable max-lines-per-function */
import { Col, Row, Card, Button, Switch, Dropdown, Modal, Input, message } from 'antd';
import { MenuProps } from 'antd';
import React, { useEffect, useState } from 'react';
import type { AsyncBridgeType } from '../bridge';
import './index.scss';
import { sortToolsByPriority } from '../../../src/renderer/utils/plugin';
import { definePlugin } from '@lynx-js/devtool-plugin-core/renderer';
const FORCED_INSTALL_PLUGIN_ID_LIST = ['market', 'plugin-group-container'];
export default definePlugin<AsyncBridgeType>((context) => {
  return () => {
    const [plugins, setPlugins] = useState<
      { id: string; name: string; description: string; isInternal?: boolean; disable?: boolean; path?: string }[]
    >([]);
    const [localPluginPath, setLocalPluginPath] = useState('');
    useEffect(() => {
      context.asyncBridge.getPluginConfig().then((plugin) => {
        setPlugins(plugin.plugins);
      });
    }, []);
    const togglePluginDisable = (pluginName) => {
      const selectedPlugin = plugins.find((plugin) => plugin.name === pluginName);
      context.logger.sendEvent({
        name: 'action',
        categories: {
          action: selectedPlugin?.disable ? 'show-entry' : 'hide-entry',
          plugin: selectedPlugin?.id ?? ''
        }
      });
      setPlugins(
        plugins.map((plugin) => (plugin.name === pluginName ? { ...plugin, disable: !plugin.disable } : plugin))
      );
    };

    const handlePluginAdd = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target && target.files) {
          const files = Array.from(target.files);
          const packageJsonFile = files.find((file) => file.name === 'package.json');
          if (packageJsonFile) {
            const path = require('path');
            const dirPath = path.dirname(packageJsonFile.path);
            setLocalPluginPath(dirPath);
          } else {
            message.error('Please select a folder containing package.json');
          }
        } else {
          message.error('Please select a folder');
        }
      };
      input.click();
    };
    const handlePluginDelete = (pluginName) => {
      setPlugins(plugins.filter((plugin) => plugin.name !== pluginName));
    };
    const saveConfig = () => {
      context.asyncBridge
        .savePluginConfig({
          plugins
        })
        .then(() => {
          console.log('Saved');
        });
      context.logger.sendEvent({
        name: 'action',
        categories: {
          action: 'save'
        }
      });
    };

    const [onlineConfigVisible, setOnlineConfigVisible] = useState(false);
    const [localConfigVisible, setLocalConfigVisible] = useState(false);
    const [pkgName, setPkgName] = useState('@lynx-js/plugin-demo');
    const [pkgVersion, setPkgVersion] = useState('latest');
    const [saveLoading, setSaveLoading] = useState(false);
    const showOnlineConfig = () => {
      setOnlineConfigVisible(true);
    };
    const showLocalConfig = () => {
      setLocalPluginPath('');
      setLocalConfigVisible(true);
    };
    const handleLocalPkgOk = async () => {
      setSaveLoading(true);
      try {
        const pluginMeta = await context.asyncBridge.getPluginMeta(localPluginPath);

        if (pluginMeta.platformPlugin) {
          // copy platform plugin to plugins folder
          await context.asyncBridge.updatePlatformPlugin(pluginMeta);
        }

        setPlugins((prevPlugins) => [...prevPlugins, pluginMeta]);
        setLocalConfigVisible(false);
        context.logger.sendEvent({
          name: 'action',
          categories: {
            action: 'add'
          }
        });
      } catch (e) {
        message.error('Plugin import failed: ' + e.message);
        console.error('Plugin import failed', e);
      } finally {
        setSaveLoading(false);
      }
    };

    const handleOk = async () => {
      setSaveLoading(true);
      try {
        const pluginPath = await context.asyncBridge.installPlugin({ pkgName, pkgVersion });
        const pluginMeta = await context.asyncBridge.getPluginMeta(pluginPath);
        setOnlineConfigVisible(false);
        if (plugins.some((plugin) => plugin.id === pluginMeta.id)) {
          setPlugins(plugins.map((plugin) => (plugin.id === pluginMeta.id ? pluginMeta : plugin)));
        } else {
          setPlugins((prevPlugins) => [...prevPlugins, pluginMeta]);
        }
        context.logger.sendEvent({
          name: 'action',
          categories: {
            action: 'add-online'
          }
        });
        message.success('Success');
      } catch (e) {
        message.error('Plugin installation failed: ' + e.message);
        console.error('Plugin installation failed', e);
      } finally {
        setSaveLoading(false);
      }
    };
    const handleCancel = () => {
      setOnlineConfigVisible(false);
      setLocalConfigVisible(false);
    };
    const dropdownItems: MenuProps['items'] = [
      {
        key: 'local',
        label: 'Add plugin (local package)',
        onClick: showLocalConfig,
      },
      {
        key: 'online',
        label: 'Add plugin (online package)',
        onClick: showOnlineConfig,
      }
    ];

    return (
      <>
        <Row gutter={16} className="market-row">
          {sortToolsByPriority(plugins).map((plugin, _) => (
            <Col span={12} key={plugin.id} className="market-col">
              <Card
                title={
                  <div className="market-title-container">
                    {plugin.version ? (
                      <>
                        <div>
                          <span style={{ fontSize: '16px', fontWeight: 500 }}>{plugin.name}</span>
                        </div>
                        <span style={{ fontSize: '12px', overflow: 'auto', wordBreak: 'break-all' }}>
                          {plugin.version}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: '16px', fontWeight: 500 }}>{plugin.name}</span>
                    )}
                  </div>
                }
                extra={
                  <Switch
                    disabled={FORCED_INSTALL_PLUGIN_ID_LIST.includes(plugin.id)}
                    checked={!plugin.disable}
                    onChange={() => togglePluginDisable(plugin.name)}
                    className="market-toggle-button"
                    key={`toggle-${plugin.id}`}
                  />
                }
                actions={[
                  <Button
                    size="small"
                    onClick={() => handlePluginDelete(plugin.name)}
                    className="market-delete-button"
                    key={`delete-${plugin.id}`}
                    disabled={plugin.isInternal}
                  >
                    Delete
                  </Button>
                ]}
              >
                <div className="market-description">{plugin.description}</div>
              </Card>
            </Col>
          ))}
        </Row>
        <Row className="market-button-container">
          <Dropdown
            trigger={['hover']}
            placement={'bottomLeft'}
            menu={{ items: dropdownItems }}
          >
            <Button className="market-add-button">Add</Button>
          </Dropdown>
          <Button onClick={saveConfig} style={{ backgroundColor: '#007bff', color: '#fff' }}>
            Save
          </Button>
          <Modal
            title="Import local package"
            open={localConfigVisible}
            onOk={handleLocalPkgOk}
            onCancel={handleCancel}
            okButtonProps={{ loading: saveLoading }}
          >
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Input disabled={true} value={localPluginPath} />
              <Button onClick={handlePluginAdd}>Import</Button>
            </div>
          </Modal>
          <Modal
            title="Import online package"
            open={onlineConfigVisible}
            onOk={handleOk}
            onCancel={handleCancel}
            okButtonProps={{ loading: saveLoading }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="market-input-container">
                Package name:
                <Input 
                  style={{ width: '300px' }} 
                  placeholder="Please enter npm package name" 
                  value={pkgName} 
                  onChange={(e) => setPkgName(e.target.value)} 
                />
              </div>
              <div className="market-input-container">
                Version:
                <Input
                  style={{ width: '300px' }}
                  placeholder="Please enter npm package version"
                  prefix={'@'}
                  value={pkgVersion}
                  onChange={(e) => setPkgVersion(e.target.value)}
                />
              </div>
            </div>
          </Modal>
        </Row>
      </>
    );
  };
});