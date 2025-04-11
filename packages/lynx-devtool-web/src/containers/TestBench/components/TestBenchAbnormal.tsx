// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { sendStatisticsEvent } from '@/utils/statisticsUtils';
import { Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const DevToolAbnormal = (props: { data: any; onDiagnose: any; onDismiss: any }) => {
  const { onDiagnose, onDismiss, data } = props;
  const { t } = useTranslation();
  const { type } = data;
  const msg = t('devtool_abnormal_notice', { type });

  const handleDismiss = () => {
    sendStatisticsEvent({
      name: 'devtool_abnormal',
      categories: {
        eventType: 'dismiss',
        type
      }
    });
    onDismiss?.();
  };

  const handleDiagnose = () => {
    sendStatisticsEvent({
      name: 'devtool_abnormal',
      categories: {
        eventType: 'diagnose',
        type
      }
    });
    onDiagnose?.();
  };

  return (
    <div>
      <Text
        mark
        style={{
          backgroundColor: type === 'lynx' ? '#faad14' : '#1890ff',
          color: '#fff',
          padding: '2px 4px',
          borderRadius: 4
        }}
      >
        {msg}
      </Text>
      <div style={{ marginTop: 8 }}>
        <Button onClick={handleDiagnose}>{t('diagnose')}</Button>
        <Button style={{ marginLeft: 20 }} onClick={handleDismiss}>
          {t('devtool_abnormal_close_notice')}
        </Button>
      </div>
    </div>
  );
};

export default DevToolAbnormal;
