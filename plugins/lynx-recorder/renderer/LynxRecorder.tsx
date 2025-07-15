// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable max-lines-per-function */
import React, { useEffect, useMemo, useRef } from 'react';
import globalContext from './utils/globalContext';
import useLynxRecorder, { LynxRecorderDeviceInfo, LynxRecorderStoreType } from './store/lynxrecorder';
import { Button, Image, notification, Table, message, Flex } from 'antd';
import { CloseCircleOutlined, LoadingOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import * as switchUtils from './utils/switchUtils';
import './LynxRecorder.scss';
import copyTextToClipboard from 'copy-text-to-clipboard';
import { downloadFile, getFileName } from './utils/common';
import UnknownScreenImg from './assets/unknown_screen.png';
import { checkValid } from './utils/helper';
import { ERemoteDebugDriverExternalEvent } from '@lynx-js/remote-debug-driver';
import { getStore } from './utils/flooks';

const LynxRecorder: React.FC = () => {
  const { selectedDevice } = globalContext.useConnection();
  const { debugDriver } = globalContext;
  const prevClientIdRef = useRef<number | undefined>();
  const {
    lynxrecorderList,
    removeLynxRecorder,
    removeAllLynxRecorder,
    setlynxrecorderStarting,
    setlynxrecorderLoading,
    setlynxrecorderTimer,
    deviceMap,
    addLynxRecorderData,
    addScreenshot
  } = useLynxRecorder() as LynxRecorderStoreType;

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const showNotImplementedError = (type: string) => {
    const deviceModel = selectedDevice?.info?.deviceModel;
    if (deviceModel.indexOf('iPhone') >= 0) {
      // eslint-disable-next-line max-len
      const msg =
        'The current app does not support LynxRecorder. Please refer to the link below to build an installation package that supports LynxRecorder.';
      const href = 'How to build an application that supports LynxRecorder?';
      const title = 'How to build an application that supports LynxRecorder?';
      showLinkNotice(title, msg, href);
      return;
    }
    message.error('Please restart app to enable debug mode');
  };

  const showTimeoutError = () => {
    message.error('Timeout! Please make sure the App is in the foreground and try again ');
  };

  const onLynxRecorderAction = async (start: boolean) => {
    const selectClientId = selectedDevice?.clientId;
    if (!selectClientId) {
      message.error('Please connect the app first!');
      return;
    }

    if (start) {
      await switchUtils.openDevtool(true);
      const startParams = {
        method: 'Recording.start',
        params: {}
      };
      try {
        const startRes = await debugDriver.sendCustomMessageAsync({ params: startParams });
        console.info('Recording.start', startRes);
        if (startRes.error) {
          setlynxrecorderStarting(selectClientId, false);

          // eslint-disable-next-line max-depth
          if (startRes?.error?.message?.indexOf('Not implemented:') >= 0) {
            showNotImplementedError('LynxRecorder');
          } else {
            message.error(startRes.error.message);
          }
          return;
        }
        message.success({ content: 'LynxRecorder start record!', duration: 2 });
        setlynxrecorderStarting(selectClientId, true);
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
          setlynxrecorderStarting(selectClientId, false);
          return;
        }
        message.success({ content: 'LynxRecorder stop record!', duration: 2 });
        setlynxrecorderStarting(selectClientId, false);
        setlynxrecorderLoading(selectClientId, true);
        const timer = setTimeout(() => {
          console.warn('LynxRecorder timeout');
          if (deviceMap[selectClientId ?? 0]?.lynxrecorderLoading) {
            console.warn('LynxRecorder timeout toast');
            setlynxrecorderLoading(selectClientId, false);
            message.warning('Loading LynxRecorder data timeout, please try again later!');
          }
          setlynxrecorderTimer(selectClientId, 0 as any);
        }, 100000);
        setlynxrecorderTimer(selectClientId, timer);
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
        const msg = await debugDriver.sendCustomMessageAsync({ params });
        if (!msg.result) {
          return Promise.reject(new Error('no data'));
        }
        const chunk = Buffer.from(msg?.result?.data ?? '', 'base64');
        dataChunks.push(chunk);
        hasEnd = msg.result.eof;
      }
      return Promise.resolve(dataChunks);
    } catch (e) {
      return Promise.reject(e);
    }
  };

  const handleLynxRecorderData = async (buffers: Array<Buffer>, sessionId: number) => {
    const filename = `${getFileName(selectedDevice)}__${sessionId}.json`;
    const fileRes = await globalContext.asyncBridge.uploadFileToLocal(buffers, filename);
    if (!fileRes?.url) {
      console.warn(`fileRes url is incorrect:${fileRes?.url}`);
      return;
    }
    const appName = selectedDevice?.info?.App;
    const deviceModel = selectedDevice?.info?.deviceModel;
    const osType = selectedDevice?.info?.osType;
    
    console.log('[LynxRecorder] Adding data with device info:', {
      sessionId,
      appName,
      deviceModel,
      osType,
      clientId: selectedDevice?.clientId
    });
    const PIC_URL_PREFIX = 'data:image/jpeg;base64,';
    const qr_url = `file://lynxrecorder?url=${fileRes?.url}`;
    const { screenshotMap: m } = getStore(useLynxRecorder);
    const pic = m[sessionId.toString()];
    const pic_src = pic ? PIC_URL_PREFIX + pic : UnknownScreenImg;
    const concatenatedBuffer = Buffer.concat(buffers);
    const [isValid, msg] = checkValid(concatenatedBuffer.buffer);
    addLynxRecorderData({
      id: sessionId,
      pic: pic_src,
      url: qr_url,
      cdn: fileRes?.url,
      appName,
      deviceModel,
      osType,
      isValid,
      message: msg
    });
  };

  const handleLynxRecorderComplete = async (msg: any, clientId: number) => {
    console.log('has receive LynxRecorderComplete', msg);
    const streams = msg?.params?.stream;
    const sessionIds = msg?.params?.sessionIDs;
    if (streams) {
      const allStreams: Promise<any>[] = [];
      streams.forEach((streamId: number, index: number) => {
        const session_id = sessionIds[index];
        if (session_id !== -1) {
          console.log('start read LynxRecorder data:');
          allStreams.push(
            readStreamDataPromise(streamId).then((dataChunks) => {
              if (dataChunks) {
                return handleLynxRecorderData(dataChunks, session_id);
              } else {
                console.warn(`dataChunks is ${dataChunks}`);
                return undefined;
              }
            })
          );
        } else {
          console.warn(`invalid msg format: session_id:${session_id}`);
        }
      });
      await Promise.all(allStreams);
      setlynxrecorderLoading(clientId, false);
    } else {
      setlynxrecorderLoading(clientId, false);
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
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let { message } = data?.data ?? {};
    if (!message) {
      return;
    }
    if (typeof message === 'string') {
      try {
        message = JSON.parse(message);
      } catch (e) {
        console.log('LynxRecorder parse message error:', e);
        return;
      }
    }
    const clientId = data?.data?.client_id;
    const method = message?.method;
    if (method === 'Recording.recordingComplete') {
      handleLynxRecorderComplete(message, clientId);
    } else if (method === 'Lynx.screenshotCaptured') {
      const sessionId = data?.data?.session_id;
      console.log(sessionId, message);
      addScreenshot(sessionId, message?.params?.data);
    }
  };

  useEffect(() => {
    debugDriver.on(ERemoteDebugDriverExternalEvent.All, handleDriverMessage);

    return () => {
      debugDriver.off(ERemoteDebugDriverExternalEvent.All, handleDriverMessage);
    };
  }, []);

  // clean devices when device switched
  useEffect(() => {
    const currentClientId = selectedDevice?.clientId;
    console.log('[LynxRecorder] Device check:', {
      prevClientId: prevClientIdRef.current,
      currentClientId
    });
    
    // always clear list when device switched (not initialization)
    if (prevClientIdRef.current !== undefined && 
        prevClientIdRef.current !== currentClientId) {
      console.log('[LynxRecorder] Device switched, clearing list');
      removeAllLynxRecorder();
    }
    
    // update prevClientId
    prevClientIdRef.current = currentClientId;
  }, [selectedDevice?.clientId, removeAllLynxRecorder]);

  const renderTopBar = () => {
    const deviceInfo: LynxRecorderDeviceInfo = useMemo(() => {
      return (
        deviceMap[selectedDevice?.clientId ?? 0] ?? {
          LynxRecorderLoading: false,
          LynxRecorderStarting: false,
          LynxRecorderTimer: null
        }
      );
    }, [selectedDevice.clientId, deviceMap]);

    const getBtnName = () => {
      let btnName = 'Start';
      if (deviceInfo?.lynxrecorderStarting) {
        btnName = 'Stop';
      } else if (deviceInfo?.lynxrecorderLoading) {
        btnName = 'Loading';
      }
      return btnName;
    };

    const showClearButton = () => {
      return !(deviceInfo?.lynxrecorderStarting || deviceInfo?.lynxrecorderLoading || lynxrecorderList.length === 0);
    };

    return (
      <>
        <Button
          type="primary"
          style={{
            marginTop: 10,
            marginBottom: 5
          }}
          loading={deviceInfo?.lynxrecorderLoading}
          icon={deviceInfo?.lynxrecorderStarting ? <LoadingOutlined spin /> : <PlayCircleOutlined />}
          onClick={() => {
            if (deviceInfo?.lynxrecorderLoading) {
              message.warning('Loading LynxRecorder record data, please wait!');
              return;
            }
            onLynxRecorderAction(!deviceInfo?.lynxrecorderStarting);
          }}
        >
          {getBtnName()}
        </Button>
        {showClearButton() ? (
          <Button
            className="clear-btn"
            onClick={() => {
              removeAllLynxRecorder();
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
      '- If the page is loaded when the APP is started, you can try LynxRecorder starting recording function;\n';
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
        // show current device App info instead of record info, ensure info is always correct
        render: () => selectedDevice?.info?.App || 'Unknown'
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (_: any, { isValid, msg }: any) => {
          if (isValid) {
            return (
              <div style={{ color: 'green' }}>
                <CheckCircleOutlined />
              </div>
            );
          } else {
            let hint = msg;
            if (!(lynxVersion === 'unknown')) {
              const indexForFirstDot = lynxVersion.indexOf('.');
              const indexForSecondDot = lynxVersion.indexOf('.', indexForFirstDot + 1);
              const version = parseFloat(lynxVersion.substring(0, indexForSecondDot));
              if (version >= 2.2 && version < 2.11) {
                hint = msg + introduction + generalHint;
              } else if (version >= 2.11) {
                hint = msg + introduction + aboveLynx2_11Hint + generalHint;
              }
            }

            return (
              <div style={{ color: 'red' }}>
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
      // {
      //   title: 'QRCode',
      //   dataIndex: 'url',
      //   key: 'url',
      //   width: 150,
      //   render: (_: any, { url }: any) => {
      //     return (
      //       <Popover
      //         content={
      //           <div className="lynxrecorder-qrcode-pop">
      //             <div>Use the LynxExplorer App to scan the QR code</div>
      //             <QRCode value={url} size={320} style={{ marginTop: 10 }} />
      //           </div>
      //         }
      //       >
      //         <Button>QRCode</Button>
      //       </Popover>
      //     );
      //   }
      // },
      {
        title: 'Action',
        key: 'action',
        width: 150,
        render: (_: any, record: any) => (
          <Flex gap="small" vertical>
            <Button onClick={() => handleCopy(record.url)}>Copy link</Button>
            <Button
              onClick={() => {
                downloadFile(record.cdn, `LynxRecorder_${new Date().toISOString()}.json`);
              }}
            >
              Download
            </Button>
            <Button
              onClick={() => {
                removeLynxRecorder(record.id);
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
        className="lynxrecorder-content"
        bordered
        dataSource={lynxrecorderList}
        columns={columns}
        scroll={{
          scrollToFirstRowOnChange: true
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

export default LynxRecorder;
