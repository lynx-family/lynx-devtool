// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import DebugSvg from '@/assets/icons/debug.svg';
import { canUseCardDebug } from '@/services/device';
import useConnection from '@/store/connection';
import { IDeviceInfo } from '@/types/device';
import { getDebugMode } from '@/utils/const';
import { sendStatisticsEvent } from '@/utils/statisticsUtils';
import { Button, message } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './TestBenchButton.scss';

const DebugButton = (props: any) => {
  const { selectedDevice, deviceInfoMap, setCardDebugMode } = useConnection();
  const [isLoading, setLoading] = useState(false);
  const { t } = useTranslation();

  const switchCardDebugMode = async (deviceInfo: IDeviceInfo) => {
    if (isLoading || !selectedDevice.clientId) {
      return;
    }
    const categories: any = {};
    const { isCardDebugMode } = deviceInfo;
    categories.action = isCardDebugMode ? 'stop' : 'start';

    if (!canUseCardDebug(selectedDevice)) {
      message.warning(t('debug_mode_not_support')!);
      categories.result = t('debug_mode_not_support');
    } else {
      setLoading(true);
      try {
        await setCardDebugMode(selectedDevice.clientId, !isCardDebugMode, true);
        categories.result = 'success';
      } catch (e: any) {
        message.error(e.message);
        categories.result = e.message;
      }
      setLoading(false);
    }

    sendStatisticsEvent({ name: 'set_card_debug_mode', categories });
  };

  if (getDebugMode() !== 'card') {
    return null;
  }

  if (selectedDevice.clientId) {
    const deviceInfo = deviceInfoMap[selectedDevice.clientId];
    if (deviceInfo?.sessions) {
      return (
        <Button
          {...props}
          loading={isLoading}
          type={deviceInfo.isCardDebugMode ? 'default' : 'text'}
          danger={deviceInfo.isCardDebugMode}
          onClick={() => switchCardDebugMode(deviceInfo)}
          icon={<img src={DebugSvg} className="devtool-nav-debug" />}
        />
      );
    }
  }
  return null;
};

export default DebugButton;
