import React, { useEffect, useMemo } from 'react';
import useConnection from '@/renderer/store/connection';
import useTestbench, { TestBenchDeviceInfo, TestbenchStoreType } from '@/renderer/store/testbench';
import { Button, Empty, Image, notification, Popover, Table, message, Flex } from 'antd';
import { CloseCircleOutlined, InfoCircleOutlined, LoadingOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import * as switchUtils from '@/renderer/utils/switchUtils';
import QRCode from 'qrcode.react';
import './index.scss';
import copyTextToClipboard from 'copy-text-to-clipboard';
import { uploadFileBuffer } from '@/renderer/utils/upload';
import { downloadFile, getFileName } from '@/renderer/utils/common';
import UnknownScreenImg from '@/renderer/assets/imgs/unknown_screen.png';
import { checkValid } from '@/renderer/utils/testbench';
import { ERemoteDebugDriverExternalEvent } from '@lynx-js/remote-debug-driver';
import debugDriver from '@/renderer/utils/debugDriver';
import { getStore } from '@/renderer/utils/flooks';

const tableHeight = document.body.clientHeight - 250;

const TestBench: React.FC = () => {
  const { selectedDevice } = useConnection();
  const {
    testbenchList,
    removeTestbench,
    removeAllTestBench,
    setTestbenchStarting,
    setTestbenchLoading,
    setTestbenchTimer,
    deviceMap,
    screenshotMap,
    addTestbenchData
  } = useTestbench() as TestbenchStoreType;

  const showLinkNotice = (title: string, msg: string, href: string) => {
    notification.warning({
      message: 'Notice',
      description: (
        <>
          <div>{msg}</div>,
          <a target="_blank" rel="noreferrer" href={href}>
            {title}
          </a>
        </>
      ),
      duration: 6
    });
  };

  const showNotImplementedError = (type: string) => {
    const deviceModel = selectedDevice?.info?.deviceModel;
    if (deviceModel.indexOf('iPhone') >= 0) {
      // eslint-disable-next-line max-len
      const msg = 'The current app does not support TestBench. Please refer to the link below to build an installation package that supports TestBench.';
      const href = 'How to build an application that supports TestBench?';
      const title = 'How to build an application that supports TestBench?';
      showLinkNotice(title, msg, href);
      return;
    }
    message.error('Please restart app to enable debug mode');
  };

  const showTimeoutError = () => {
    message.error('Timeout! Please make sure the App is in the foreground and try again ');
  };

  const onTestbenchAction = async (start: boolean) => {
    const selectClientId = selectedDevice?.clientId;
    if (!selectClientId) {
      message.error('Please connect the app first!');
      return;
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
          setTestbenchStarting(selectClientId, false);

          // eslint-disable-next-line max-depth
          if (startRes?.error?.message?.indexOf('Not implemented:') >= 0) {
            showNotImplementedError('testbench');
          } else {
            message.error(startRes.error.message);
          }
          return;
        }
        message.success({ content: 'TestBench start record!', duration: 2 });
        setTestbenchStarting(selectClientId, true);
      } catch (e) {
        console.log(e.message);
        showTimeoutError();
      }
    } else {
      const endParams = { method: 'Recording.end', params: {} };
      try {
        const endRes = await debugDriver.sendCustomMessageAsync({ params: endParams });
        console.info('Recording.end', endRes);
        if (endRes.error) {
          message.error({ content: endRes.error.message, duration: 2 });
          setTestbenchStarting(selectClientId, false);
          return;
        }
        message.success({ content: 'TestBench stop record!', duration: 2 });
        setTestbenchStarting(selectClientId, false);
        setTestbenchLoading(selectClientId, true);
        const timer = setTimeout(() => {
          console.warn('testbench timeout');
          if (deviceMap[selectClientId ?? 0]?.testbenchLoading) {
            console.warn('testbench timeout toast');
            setTestbenchLoading(selectClientId, false);
            message.warning('Loading testbench data timeout, please try again later!');
          }
          setTestbenchTimer(selectClientId, 0 as any);
        }, 100000);
        setTestbenchTimer(selectClientId, timer);
      } catch (__) {
        showTimeoutError();
      }
    }
  };

  const handleCopy = (text: string) => {
    copyTextToClipboard(text);
    message.success('Link has copied to clipboard！');
  };


  const readStreamDataPromise = async (stream: number): Promise<Array<Buffer>> => {
    const dataChunks: Array<Buffer> = [];
    try {
      let hasEnd = false;
      while (!hasEnd) {
        const params = {
          method: 'IO.read',
          session_id: -1,
          params: { handle: stream, size: 1024 * 1024 }
        };
        const message = await debugDriver.sendCustomMessageAsync({ params });
        if (!message.result) {
          return Promise.reject(new Error('no data'));
        }
        const chunk = Buffer.from(message?.result?.data ?? '', 'base64');
        dataChunks.push(chunk);
        hasEnd = message.result.eof;
      }
      return Promise.resolve(dataChunks);
    } catch (e) {
      return Promise.reject(e);
    }
  };

  const handleTestbenchData = async (buffers: Array<Buffer>, sessionId: number) => {
    const filename = `${getFileName(selectedDevice)}__${sessionId}.json`;
    const cdnRes = await uploadFileBuffer(buffers, filename);
    if (!cdnRes?.url) {
      console.warn('cdnRes url is incorrect:' + cdnRes?.url);
      return;
    }
    const appName = selectedDevice?.info?.App;
    const deviceModel = selectedDevice?.info?.deviceModel;
    const osType = selectedDevice?.info?.osType;
    const PIC_URL_PREFIX = 'data:image/jpeg;base64,';
    const qr_url = `file://testbench?url=${cdnRes?.url}`;
    const {screenshotMap:m} = getStore(useTestbench);
    const pic = m[sessionId.toString()];
    const pic_src = pic ? PIC_URL_PREFIX + pic : UnknownScreenImg;
    const concatenatedBuffer = Buffer.concat(buffers);
    const [isValid, message] = checkValid(concatenatedBuffer.buffer);
    addTestbenchData({
      id: sessionId,
      pic: pic_src,
      url: qr_url,
      cdn: cdnRes?.url,
      appName,
      deviceModel,
      osType,
      isValid: isValid,
      message
    });
  };

  const handleTestbenchComplete = async (msg: any, clientId: number) => {
    console.log('has receive TestbenchComplete', msg);
    const streams = msg?.params?.stream;
    const sessionIds = msg?.params?.sessionIDs;
    if (streams) {
      const allStreams: Promise<any>[] = [];
      streams.forEach((streamId: number, index: number) => {
        const session_id = sessionIds[index];
        if (session_id !== -1) {
          console.log('start read testbench data:');
          allStreams.push(
            readStreamDataPromise(streamId).then((dataChunks) => {
              if (dataChunks) {
                return handleTestbenchData(dataChunks, session_id);
              } else {
                console.warn('dataChunks is ' + dataChunks);
                return undefined;
              }
            })
          );
        } else {
          console.warn('invalid msg format: session_id:' + session_id);
        }
      });
      await Promise.all(allStreams);
      setTestbenchLoading(clientId, false);
    } else {
      setTestbenchLoading(clientId, false);
      notification.warning({
        message: 'Notice',
        description: <div>{'No valid data recorded! Please start record before opening the lynx page'}</div>,
        duration: 6
      });
    }
  };

  const handleDriverMessage = (msg?: any) => {
    const { event, data } = msg ?? {};
    if (event !== 'Customized' || !data) {
      return;
    }
    let { message } = data?.data ?? {};
    if (!message) {
      return;
    }
    if (typeof message === 'string') {
      try {
        message = JSON.parse(message);
      } catch (e) {
        console.log('testbench parse message error:', e);
        return;
      }
    }
    const clientId = data?.data?.client_id;
    const method = message?.method;
    if (method === 'Recording.recordingComplete') {
      handleTestbenchComplete(message, clientId);
    }
  };

  useEffect(() => {
    debugDriver.on(ERemoteDebugDriverExternalEvent.All, handleDriverMessage);

    return () => {
      debugDriver.off(ERemoteDebugDriverExternalEvent.All, handleDriverMessage);
    };
  }, []);

  const renderTopBar = () => {
    const deviceInfo: TestBenchDeviceInfo = useMemo(() => {
      return (
        deviceMap[selectedDevice?.clientId ?? 0] ?? {
          testbenchLoading: false,
          testbenchStarting: false,
          testbenchTimer: null
        }
      );
    }, [selectedDevice.clientId, deviceMap]);

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
          style={{
            marginLeft: 5
          }}
          loading={deviceInfo?.testbenchLoading}
          icon={deviceInfo?.testbenchStarting ? <LoadingOutlined spin /> : <PlayCircleOutlined />}
          onClick={() => {
            if (deviceInfo?.testbenchLoading) {
              message.warning('Loading testbench record data, please wait!');
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
        key: 'id',
        width: 100
      },
      {
        title: 'Device',
        dataIndex: 'deviceModel',
        key: 'deviceModel'
      },
      {
        title: 'App',
        dataIndex: 'appName',
        key: 'appName',
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (_: any, { isValid, message }: any) => {
          if (isValid) {
            return (
              <div style={{color: 'green'}}>
                <CheckCircleOutlined />
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
              <div style={{color: 'red'}}>
                <CloseCircleOutlined />
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
        width: 150,
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
              <Button>QRCode</Button>
            </Popover>
          );
        }
      },
      {
        title: 'Action',
        key: 'action',
        width: 150,
        render: (_: any, record: any) => (
            <Flex gap="small" vertical>
                <Button  onClick={() => handleCopy(record.url)}>
                Copy link
                </Button>
                <Button
                onClick={() => {
                    downloadFile(record.cdn, `HDT_Lynx_TestBench_${new Date().toISOString()}.json`);
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
          </Flex>

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
      {renderTopBar()}
      {renderResultView()}
    </>
  );
};

export default TestBench;
