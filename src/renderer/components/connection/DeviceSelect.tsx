// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable max-lines-per-function */
// import DeviceEditGroup from '@/renderer/ldt/components/device/DeviceEditGroup';
import xdbDriver from '@/renderer/ldt/utils/xdbDriver';
import useConnection from '@/renderer/hooks/connection';
import { viewMode } from '@/renderer/utils';
import debugDriver from '@/renderer/utils/debugDriver';
import { setSimulatorViewMode } from '@/renderer/utils/ldtApi';
import { IDevice } from '@lynx-js/devtool-plugin-core/renderer';
import { DesktopOutlined, MobileOutlined } from '@ant-design/icons';
import { Dropdown, Button } from 'antd';
import { MenuProps } from 'antd';
import { useEffect, useMemo } from 'react';
import './DeviceSelect.scss';
import IconPlatform from './IconPlatform/IconPlatform';
import useldtConnection from '@/renderer/ldt/store/ldtConnection';
import { getStopAtEntry } from '@/renderer/utils/switchUtils';

export default function DeviceSelect() {
  const { deviceList, selectedDevice, setSelectedDevice } = useConnection();
  const { selectedDevice: currentDevice, setCurrentDevice } = useldtConnection();

  useEffect(() => {
    setCurrentDevice(xdbDriver.getCurrentDevice());
    getStopAtEntry('DEFAULT');
    getStopAtEntry('MTS');
  }, [selectedDevice]);

  function combieDevices(groupKey: 'App' | 'deviceModel' = 'App'): IDevice[] {
    const sortList = deviceList
      .filter((item) => item.clientId && item.info?.deviceType !== 'simulator')
      .sort((d0, d1) => {
        if (d0.info?.deviceType === 'simulator') {
          return -1;
        }
        return d0.info[groupKey]?.localeCompare(d1.info[groupKey] ?? '') ?? 0;
      });
    return sortList.map((device, index) => {
      let top = false;
      if (index === 0) {
        top = true;
      } else {
        const preDevice = sortList[index - 1];
        if (preDevice.info[groupKey] !== device.info[groupKey]) {
          top = true;
        }
      }
      return {
        ...device,
        top
      };
    });
  }

  const isSelectedDevice = (device: IDevice) => {
    return selectedDevice?.clientId === device.clientId;
  };

  const groupDevices = useMemo(() => {
    return combieDevices('deviceModel');
  }, [deviceList]);

  const handleSelectDevice = (device: IDevice) => {
    setSelectedDevice(device);
    setSimulatorViewMode('mobile');
  };

  const switchViewMode = (mode) => {
    setSimulatorViewMode(mode);
  };

  const getDeviceName = () => {
    if (viewMode === 'mobile' || viewMode === 'lynx') {
      if (currentDevice.info && (currentDevice.clientId || currentDevice.xdbOnline)) {
        return (
          <>
            <IconPlatform
              osType={currentDevice.info?.osType}
              style={{ width: 18, height: 18 }}
              className={currentDevice.clientId ? '' : 'disable'}
            />
            <span className={currentDevice.clientId ? '' : 'disable'}>
              {`${currentDevice.info?.deviceModel}(${currentDevice.info?.App})`}
            </span>
          </>
        );
      }
      return (
        <>
          <MobileOutlined />
          Please connect device
        </>
      );
    }
    return (
      <>
        <DesktopOutlined style={{ marginRight: 5 }} />
        {viewMode === 'lynx' ? 'lynxview' : 'webview'}
      </>
    );
  };

  const dropdownItems: MenuProps['items'] = [];
  
  if (groupDevices.length > 0) {
    let currentGroup = '';
    groupDevices.forEach((device: any, index: number) => {
      // if it's the first device of a new group and not the first device overall, add a separator
      if (device.top && index !== 0) {
        dropdownItems.push({ type: 'divider', key: `divider-${index}` });
      }
      
      // if it's the first device of a new group, add group title
      if (device.top) {
        currentGroup = device.info.deviceModel;
        dropdownItems.push({
          type: 'group',
          label: device.info.deviceModel,
          key: `group-${device.info.deviceModel}`,
        });
      }
      
      // add device item
      dropdownItems.push({
        key: device.clientId,
        label: (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            width: '100%',
            padding: '4px 0',
            backgroundColor: isSelectedDevice(device) ? 'var(--ant-primary-1)' : 'transparent',
            borderRadius: '4px'
          }}>
            <span style={{
              color: isSelectedDevice(device) ? 'var(--ant-primary-6)' : 'inherit',
              fontWeight: isSelectedDevice(device) ? 'bold' : 'normal'
            }}>
              {`${device.info?.App}${debugDriver.getAppProcess(device) || ''}`}
            </span>
            {isSelectedDevice(device) && (
              <span style={{ 
                color: 'var(--ant-primary-6)', 
                fontSize: '12px',
                marginLeft: '8px'
              }}>
                ✓
              </span>
            )}
          </div>
        ),
        onClick: () => handleSelectDevice(device),
        style: {
          backgroundColor: isSelectedDevice(device) ? 'var(--ant-primary-1)' : undefined
        }
      });
    });
  }

  return (
    <Button className="device-select">
      <Dropdown
        trigger={['click']}
        menu={{
          items: dropdownItems,
          style: { width: 220 }
        }}
        disabled={groupDevices.length === 0}
      >
        <div className="device-platform">{getDeviceName()}</div>
      </Dropdown>
    </Button>
  );
}
