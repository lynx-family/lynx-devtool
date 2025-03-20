// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable max-len */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-nested-ternary */
// TODO: Optimize the devtool props.info type definition and delete this line
/* eslint-disable @typescript-eslint/ban-ts-comment */

import useConnection from '@/store/connection';
import './TestBench.scss';
import * as utils from '@/utils';
import { Header } from 'antd/lib/layout/layout';
import { Image } from "antd";
import * as  storeUtils from '@/utils/storeUtils';
import * as switchUtils from '@/utils/switchUtils';
import { showNotImplementedError, showTimeoutError } from '@/utils/notice';
import debugDriver from '@/utils/debugDriver';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useTestbench, { TestbenchStoreType } from '@/store/testbench';
import { Button, Empty, notification, Popover, Table, Tabs, Tag, Tooltip } from 'antd';
import QRCode from 'qrcode.react';
import ButtonGroup from 'antd/lib/button/button-group';
import { CheckOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons';
const tableHeight = document.body.clientHeight - 175;

const TestBench = () => {
  const {
    selectedDevice,
    deviceInfoMap,
    setTestbenchStarting,
    setTestbenchLoading,
    connectRemoteDevice,
    setTestbenchTimer
  } = useConnection();

  const { testbenchList, removeTestbench, removeAllTestBench } = useTestbench() as TestbenchStoreType;

  const { loading } = connectRemoteDevice as any;

  const { t } = useTranslation();

  const onTestbenchAction = async (start: boolean) => {
    let selectClientId = storeUtils.getSelectClientId();
    if (!selectClientId) {
      if (selectedDevice.xdbOnline) {
        // eslint-disable-next-line max-depth
        try {
          await connectRemoteDevice(true);
          selectClientId = storeUtils.getSelectClientId();
        } catch (e) {
          // Toast.error(t('connect_timeout_tips')!);
          return;
        }
      } else {
        // Toast.error(t('connect_device_first')!);
        return;
      }
    }

    if (start) {
      await switchUtils.openDevtool(true);
      const debugModeResult = await switchUtils.openDebugMode();
      if (!debugModeResult) {
        console.warn('testbench: debug-mode open failed');
        return;
      }

      const startParams = {
        method: 'Recording.start',
        params: {}
      };
      try {
        const startRes = await debugDriver.sendCustomMessageAsync({ params: startParams });
        console.info('Recording.start', startRes);
        if (startRes.error) {
          setTestbenchStarting(selectClientId!!, false);

          // eslint-disable-next-line max-depth
          if (startRes?.error?.message?.indexOf('Not implemented:') >= 0) {
            showNotImplementedError('testbench');
          } else {
            // Toast.error(startRes.error.message);
          }
          return;
        }
        // notification.success({ content: 'TestBench start record!', duration: 2 });
        setTestbenchStarting(selectClientId!!, true);
      } catch (e) {
        showTimeoutError();
      }
    } else {
      const endParams = { method: 'Recording.end', params: {} };
      try {
        const endRes = await debugDriver.sendCustomMessageAsync({ params: endParams });
        console.info('Recording.end', endRes);
        if (endRes.error) {
          // Toast.error({ content: endRes.error.message, duration: 2 });
          setTestbenchStarting(selectClientId!!, false);
          return;
        }
        // Toast.success({ content: 'TestBench stop record!', duration: 2 });
        setTestbenchStarting(selectClientId!!, false);
        setTestbenchLoading(selectClientId!!, true);
        const timer = setTimeout(() => {
          console.warn('testbench timeout');
          if (storeUtils.getClientWithId(selectClientId!!)?.testbenchLoading) {
            console.warn('testbench timeout toast');
            setTestbenchLoading(selectClientId!!, false);
            // Toast.warning('Loading testbench data timeout, please try again later!');
          }
          setTestbenchTimer(selectClientId!!, null);
        }, 100000);
        setTestbenchTimer(selectClientId!!, timer);
      } catch (e) {
        showTimeoutError();
      }
    }
  };

  const handleCopy = (text: string) => {
    // copyTextToClipboard(text);
    // Toast.success('Link has copied to clipboard！');
  };

  const renderTopBar = () => {
    const deviceInfo = useMemo(() => {
      if (selectedDevice.clientId) {
        return deviceInfoMap[selectedDevice.clientId];
      }
    }, [selectedDevice.clientId, deviceInfoMap]);

    const getBtnName = () => {
      let btnName = 'Start';
      if (deviceInfo?.testbenchStarting) {
        btnName = 'Stop';
      } else if (deviceInfo?.testbenchLoading) {
        btnName = 'Loading';
      }
      return btnName;
    };

    const showClearButton = () => {
      return !(deviceInfo?.testbenchStarting || deviceInfo?.testbenchLoading || testbenchList.length === 0);
    };

    return (
      <>
        <Button
          type="primary"
          loading={loading || deviceInfo?.testbenchLoading}
          // icon={loading || deviceInfo?.testbenchStarting ? <IconLoading spin /> : <IconPlayCircle />}
          onClick={() => {
            if (deviceInfo?.testbenchLoading) {
              // Toast.warning('Loading testbench record data, please wait!');
              return;
            }
            onTestbenchAction(!deviceInfo?.testbenchStarting);
          }}
        >
          {getBtnName()}
        </Button>
        {showClearButton() ? (
          <Button
            className="clear-btn"
            onClick={() => {
              removeAllTestBench();
            }}
          >
            Clear
          </Button>
        ) : (
          <span />
        )}
      </>
    );
  };

  const renderResultView = () => {
    const introduction = '\nIf you had opened page before starting record,the possible reasons are as follows:\n';
    const aboveLynx2_11Hint =
      '- If the page is loaded when the APP is started, you can try TestBench starting recording function;\n';
    const generalHint = '- Clear the APP cache, restart the APP and start recording;';

    const lynxVersion = selectedDevice.info?.sdkVersion ?? 'unknown';
    const columns = [
      {
        title: 'Id',
        dataIndex: 'id',
        key: 'id'
      },
      {
        title: 'Device',
        dataIndex: 'deviceModel',
        key: 'deviceModel'
      },
      {
        title: 'App',
        dataIndex: 'appName',
        key: 'appName'
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (_: any, { isValid, message }: any) => {
          if (isValid) {
            return (
              <div className="status-success">
                <CheckOutlined />
              </div>
            );
          } else {
            let hint = message;
            if (!(lynxVersion === 'unknown')) {
              const indexForFirstDot = lynxVersion.indexOf('.');
              const indexForSecondDot = lynxVersion.indexOf('.', indexForFirstDot + 1);
              const version = parseFloat(lynxVersion.substring(0, indexForSecondDot));
              if (version >= 2.2 && version < 2.11) {
                hint = message + introduction + generalHint;
              } else if (version >= 2.11) {
                hint = message + introduction + aboveLynx2_11Hint + generalHint;
              }
            }

            return (
              <div className="status-failure">
                <CloseOutlined />
                <span style={{ display: 'inline-block', whiteSpace: 'pre-line' }}>{hint}</span>
              </div>
            );
          }
        }
      },
      {
        title: 'Preview',
        dataIndex: 'pic',
        key: 'pic',
        render: (_: any, { pic }: any) => {
          return (
            <Image
              style={{
                maxWidth: 200,
                maxHeight: 200,
                border: 'solid',
                borderRadius: 2,
                borderWidth: 1,
                borderColor: 'rgb(240,240,240)'
              }}
              src={pic}
              preview={{ src: pic }}
            />
          );
        }
      },
      {
        title: 'QRCode',
        dataIndex: 'url',
        key: 'url',
        render: (_: any, { url }: any) => {
          return (
            <Popover
              content={
                <div className="testbentch-qrcode-pop">
                  <div>Use the LynxExample App to scan the QR code</div>
                  <QRCode value={url} size={320} style={{ marginTop: 10 }} />
                </div>
              }
            >
              <Button >Show QRCode</Button>
            </Popover>
          );
        }
      },
      {
        title: 'Action',
        key: 'action',
        width: 280,
        render: (_: any, record: any) => (
          <ButtonGroup>
            <Button onClick={() => handleCopy(record.url)}>
              Copy link
            </Button>
            <Button
              onClick={() => {
                utils.downloadFile(record.cdn);
              }}
            >
              Download
            </Button>
            <Button

              onClick={() => {
                removeTestbench(record.id);
              }}
            >
              Delete
            </Button>
          </ButtonGroup>
        )
      }
    ];
    return (
      <Table
        className="testbench-content"
        bordered
        dataSource={testbenchList}
        columns={columns}
        scroll={{
          scrollToFirstRowOnChange: true,
          y: tableHeight
        }}
      />
    );
  };

  return (
    <>
      <Header>{renderTopBar()}</Header>
      {renderResultView()}
    </>
  );
};

export default TestBench;
