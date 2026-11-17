// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useState } from '@lynx-js/react';
import type { SimulatorDevice } from '@lynx-js/lynx-simulator-core';
import './index.css';
import type { InputEvent, SizeMode, SizeSelection } from '../../shared/types';
import {
  createCustomDeviceName,
  getGlobalDevices,
  getGlobalTheme,
  getSizeOptionClass,
  getSizeSummary,
} from '../../shared/utils';

type SizePickerProps = {
  onChange: (selection: SizeSelection) => void;
};

export function SizePicker(props: SizePickerProps) {
  const { onChange } = props;
  const theme = getGlobalTheme();
  const isDark = theme === 'dark';
  const devices = getGlobalDevices();
  const [sizeMode, setSizeMode] = useState<SizeMode>('default');
  const [sizeOverlayOpen, setSizeOverlayOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<SimulatorDevice | undefined>();
  const [selectedCustomDevice, setSelectedCustomDevice] = useState<SimulatorDevice | undefined>();
  const [customDevices, setCustomDevices] = useState<SimulatorDevice[]>([]);
  const [customOverlayOpen, setCustomOverlayOpen] = useState(false);
  const [customError, setCustomError] = useState('');
  const [customName, setCustomName] = useState('');
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const withTheme = (className: string) => `${className} ${className}--${theme}`;
  const sizeSummary = getSizeSummary(sizeMode === 'custom' ? selectedCustomDevice : selectedDevice);

  const handleCustomNameInput = (event: InputEvent) => {
    'background only';
    setCustomName(event.detail?.value?.trim() ?? '');
    setCustomError('');
  };

  const handleCustomWidthInput = (event: InputEvent) => {
    'background only';
    setCustomWidth(event.detail?.value?.trim() ?? '');
    setCustomError('');
  };

  const handleCustomHeightInput = (event: InputEvent) => {
    'background only';
    setCustomHeight(event.detail?.value?.trim() ?? '');
    setCustomError('');
  };

  const resetCustomForm = () => {
    'background only';
    setCustomName('');
    setCustomWidth('');
    setCustomHeight('');
    setCustomError('');
  };

  const selectDefaultSize = () => {
    'background only';
    setSizeMode('default');
    setSelectedDevice(undefined);
    setSelectedCustomDevice(undefined);
    setSizeOverlayOpen(false);
    onChange({
      mode: 'default',
    });
  };

  const selectDevice = (device: SimulatorDevice) => {
    'background only';
    setSelectedDevice(device);
    setSizeMode('device');
    setSizeOverlayOpen(false);
    onChange({
      mode: 'device',
      device,
    });
  };

  const selectCustomDevice = (device: SimulatorDevice) => {
    'background only';
    setSelectedCustomDevice(device);
    setSizeMode('custom');
    setSizeOverlayOpen(false);
    setCustomOverlayOpen(false);
    resetCustomForm();
    onChange({
      mode: 'custom',
      size: device.size,
    });
  };

  const openCustomOverlay = () => {
    'background only';
    resetCustomForm();
    setSizeOverlayOpen(true);
    setCustomOverlayOpen(true);
  };

  const closeOverlays = () => {
    'background only';
    setSizeOverlayOpen(false);
    setCustomOverlayOpen(false);
    resetCustomForm();
  };

  const closeCustomOverlay = () => {
    'background only';
    setCustomOverlayOpen(false);
    resetCustomForm();
  };

  const keepOverlayOpen = () => {
    'background only';
  };

  const toggleSizeOverlay = () => {
    'background only';
    const nextOpen = !sizeOverlayOpen;
    setSizeOverlayOpen(nextOpen);
    if (!nextOpen) {
      setCustomOverlayOpen(false);
      resetCustomForm();
    }
  };

  const createCustomDevice = () => {
    'background only';
    const widthText = customWidth.trim();
    const heightText = customHeight.trim();
    if (!widthText || !heightText) {
      setCustomError('Please enter a custom width and height.');
      return;
    }

    const width = Number(widthText);
    const height = Number(heightText);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      setCustomError('Custom size requires a positive width and height.');
      return;
    }

    const label = customName.trim() || `Custom ${width}x${height}`;
    const name = createCustomDeviceName(label, width, height, devices.concat(customDevices));
    const device: SimulatorDevice = {
      name,
      label,
      size: {
        width,
        height,
      },
      platform: 'desktop',
    };

    setCustomDevices(customDevices.concat(device));
    setSelectedCustomDevice(device);
    setSizeMode('custom');
    setSizeOverlayOpen(false);
    setCustomOverlayOpen(false);
    resetCustomForm();
    onChange({
      mode: 'custom',
      size: device.size,
    });
  };

  const deleteCustomDevice = (deviceName: string) => {
    'background only';
    const nextDevices = customDevices.filter((device) => device.name !== deviceName);
    setCustomDevices(nextDevices);
    if (selectedCustomDevice?.name === deviceName) {
      const nextSelectedDevice = nextDevices[0];
      setSelectedCustomDevice(nextSelectedDevice);
      if (sizeMode === 'custom' && nextSelectedDevice) {
        onChange({
          mode: 'custom',
          size: nextSelectedDevice.size,
        });
      } else if (sizeMode === 'custom') {
        setSizeMode('default');
        onChange({
          mode: 'default',
        });
      }
    }
    setCustomError('');
  };

  return (
    <>
      {sizeOverlayOpen ? (
        <view className={withTheme('OverlayBackdrop')} bindtap={closeOverlays} />
      ) : null}
      <view className={withTheme('SizePicker')} catchtap={keepOverlayOpen}>
        <view className={withTheme('SizeTrigger')} bindtap={toggleSizeOverlay}>
          <text className={withTheme('SizeTriggerText')}>{sizeSummary}</text>
          <text className={withTheme('SizeTriggerIcon')}>{sizeOverlayOpen ? '^' : 'v'}</text>
        </view>
        {sizeOverlayOpen ? (
          <view className={withTheme('SizeOverlay')}>
            <scroll-view
              scroll-orientation="vertical"
              scroll-bar-enable={true}
              clip-radius="true"
              className={withTheme('SizeOverlayScroll')}
            >
              <view className={withTheme('SizeOverlayContent')}>
                <text className={withTheme('SizeSectionTitle')}>Default</text>
                <view
                  className={getSizeOptionClass(sizeMode === 'default', theme)}
                  bindtap={selectDefaultSize}
                >
                  <text className={withTheme('SizeOptionMark')}>
                    {sizeMode === 'default' ? '>' : ''}
                  </text>
                  <view className={withTheme('SizeOptionBody')}>
                    <text className={withTheme('SizeOptionTitle')}>Default size</text>
                    <text className={withTheme('SizeOptionMeta')}>390x844</text>
                  </view>
                </view>
                <view className={withTheme('SizeSeparator')} />
                <text className={withTheme('SizeSectionTitle')}>Devices</text>
                {devices.map((device) => (
                  <view
                    className={getSizeOptionClass(
                      sizeMode === 'device' && selectedDevice?.name === device.name,
                      theme
                    )}
                    bindtap={() => selectDevice(device)}
                    key={device.name}
                  >
                    <text className={withTheme('SizeOptionMark')}>
                      {sizeMode === 'device' && selectedDevice?.name === device.name ? '>' : ''}
                    </text>
                    <view className={withTheme('SizeOptionBody')}>
                      <text className={withTheme('SizeOptionTitle')}>
                        {device.label ?? device.name}
                      </text>
                      <text className={withTheme('SizeOptionMeta')}>
                        {device.size.width}x{device.size.height}
                      </text>
                    </view>
                  </view>
                ))}
                <view className={withTheme('SizeSeparator')} />
                <text className={withTheme('SizeSectionTitle')}>Custom</text>
                {customDevices.map((device) => (
                  <view
                    className={getSizeOptionClass(
                      sizeMode === 'custom' && selectedCustomDevice?.name === device.name,
                      theme
                    )}
                    bindtap={() => selectCustomDevice(device)}
                    key={device.name}
                  >
                    <text className={withTheme('SizeOptionMark')}>
                      {sizeMode === 'custom' && selectedCustomDevice?.name === device.name
                        ? '>'
                        : ''}
                    </text>
                    <view className={withTheme('SizeOptionBody')}>
                      <text className={withTheme('SizeOptionTitle')}>
                        {device.label ?? device.name}
                      </text>
                      <text className={withTheme('SizeOptionMeta')}>
                        {device.size.width}x{device.size.height}
                      </text>
                    </view>
                    <view
                      className={withTheme('CustomDeleteButton')}
                      catchtap={() => deleteCustomDevice(device.name)}
                    >
                      <text className={withTheme('CustomDeleteText')}>Delete</text>
                    </view>
                  </view>
                ))}
                <view className={withTheme('AddCustomOption')} bindtap={openCustomOverlay}>
                  <text className={withTheme('AddCustomIcon')}>+</text>
                  <view className={withTheme('SizeOptionBody')}>
                    <text className={withTheme('AddCustomText')}>Custom size</text>
                  </view>
                </view>
              </view>
            </scroll-view>
          </view>
        ) : null}
        {customOverlayOpen ? (
          <view className={withTheme('CustomOverlayBackdrop')} bindtap={closeCustomOverlay} />
        ) : null}
        {customOverlayOpen ? (
          <view className={withTheme('CustomOverlay')} catchtap={keepOverlayOpen}>
            <scroll-view
              scroll-orientation="vertical"
              scroll-bar-enable={true}
              clip-radius="true"
              className={withTheme('CustomOverlayScroll')}
            >
              <view className={withTheme('CustomOverlayContent')}>
                <text className={withTheme('CustomFieldLabel')}>Name</text>
                <input
                  className={withTheme('CustomInput')}
                  bindinput={handleCustomNameInput}
                  placeholder="Enter device name"
                  text-color={isDark ? '#f9fafb' : '#111827'}
                />
                <view className={withTheme('CustomDimensionRow')}>
                  <view className={withTheme('CustomDimensionField')}>
                    <text className={withTheme('CustomFieldLabel')}>Width</text>
                    <input
                      className={withTheme('CustomInput')}
                      bindinput={handleCustomWidthInput}
                      placeholder="Width"
                      text-color={isDark ? '#f9fafb' : '#111827'}
                    />
                  </view>
                  <view className={withTheme('CustomDimensionField')}>
                    <text className={withTheme('CustomFieldLabel')}>Height</text>
                    <input
                      className={withTheme('CustomInput')}
                      bindinput={handleCustomHeightInput}
                      placeholder="Height"
                      text-color={isDark ? '#f9fafb' : '#111827'}
                    />
                  </view>
                </view>
                {customError ? (
                  <view className={withTheme('CustomErrorBox')}>
                    <text className={withTheme('CustomErrorText')}>{customError}</text>
                  </view>
                ) : null}
                <view className={withTheme('CustomConfirmButton')} bindtap={createCustomDevice}>
                  <text className="CustomConfirmText">OK</text>
                </view>
              </view>
            </scroll-view>
          </view>
        ) : null}
      </view>
    </>
  );
}
