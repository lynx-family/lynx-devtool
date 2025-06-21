// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Button, Empty, Spin } from 'antd';
import { ExclamationCircleOutlined, LoadingOutlined, InboxOutlined } from '@ant-design/icons';
import './ConnectionEmpty.scss';
import useConnection from '@/renderer/hooks/connection';
import { EConnectionState } from '@/renderer/types/connection';
import { viewMode } from '@/renderer/utils';

const ConnectionEmpty = () => {
  const { deviceInfoMap, selectedDevice, connectionState, openConnection } = useConnection();

  const selectedSession = deviceInfoMap[selectedDevice.clientId ?? 0]?.selectedSession;
  const notice: any = {
    image: <InboxOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />,
  };

  if (connectionState === EConnectionState.Unconnected) {
    notice.title = <Button onClick={() => openConnection()}>Retry</Button>;
    notice.desc = 'Connection failed, click the button to retry';
    notice.image = <ExclamationCircleOutlined style={{ fontSize: 64, color: '#ff4d4f' }} />;
  } else if (connectionState === EConnectionState.Connecting) {
    notice.title = <Spin />;
    notice.desc = 'Connecting';
    notice.image = <LoadingOutlined style={{ fontSize: 64, color: '#1890ff' }} />;
  } else if (!selectedDevice.clientId) {
    if (viewMode === 'mobile' || viewMode === 'lynx') {
      notice.title = 'Please connect to App';
      notice.desc = 'Connect to App via USB cable';
    } else {
      notice.title = 'Cannot connect to simulator';
      notice.desc = '';
    }
  } else if (!selectedSession) {
    notice.title = 'Please open LynxView';
  }

  return (
    <Empty
      className="connection-empty"
      image={notice.image}
      description={notice.desc}
    >
      {notice.title}
    </Empty>
  );
};

export default ConnectionEmpty;
