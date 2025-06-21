// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import useConnection from '@/renderer/hooks/connection';
import { EConnectionState } from '@/renderer/types/connection';
import { restartLDTPlatform } from '@/renderer/utils/ldtApi';
import { sendStatisticsEvent } from '@/renderer/utils/statisticsUtils';
import { Modal } from 'antd';
import { useEffect, useState } from 'react';
import UnattachedDialog from './UnattachedDialog';

const ConnectionStatus = () => {
  const { connectionState } = useConnection();
  const [reconnectCount, setReconnectCount] = useState(0);
  const [restartTipsModal, setRestartTipsModal] = useState<ReturnType<typeof Modal.error> | null>(null);

  useEffect(() => {
    if (connectionState === EConnectionState.Connected) {
      setReconnectCount(1);
      if (restartTipsModal) {
        restartTipsModal.destroy();
        setRestartTipsModal(null);
      }
      return;
    }

    if (connectionState !== EConnectionState.Connecting) {
      return;
    }

    if (!restartTipsModal && reconnectCount > 2) {
      const modal = Modal.error({
        centered: true,
        width: 'fit-content',
        content: (
          <p style={{ fontSize: 16, margin: 0, fontWeight: 'bold' }}>
            Local debug service cannot connect, please check if the terminal service is still running!
          </p>
        ),
                  cancelText: 'Terminal service is running, continue trying to connect',
        cancelButtonProps: {
          type: 'default',
        },
        onCancel: () => {
          modal.destroy();
          setRestartTipsModal(null);
          sendStatisticsEvent({
            name: 'ldt_restart_tips_modal',
            categories: {
              eventType: 'continue_reconnect'
            }
          });
        },
                  okText: 'Terminal service has been terminated, but I want to continue using LDT',
        okButtonProps: {
          type: 'primary',
        },
        onOk: () => {
          modal.destroy();
          setRestartTipsModal(null);
          sendStatisticsEvent({
            name: 'ldt_restart_tips_modal',
            categories: {
              eventType: 'restart'
            }
          });
          restartLDTPlatform();
        },
        closable: false,
        maskClosable: false
      });
      sendStatisticsEvent({
        name: 'ldt_restart_tips_modal',
        categories: {
          eventType: 'show'
        }
      });
      setRestartTipsModal(modal);
      setReconnectCount(1);
      return;
    }

    setReconnectCount((prev) => prev + 1);
  }, [connectionState]);

  return <UnattachedDialog />;
};

export default ConnectionStatus;
