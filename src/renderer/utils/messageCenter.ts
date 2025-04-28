// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import useConnection, { ConnectionStoreType } from '@/renderer/store/connection';
import { message } from 'antd';
import { Buffer } from 'buffer';
import { t } from 'i18next';
import * as utils from '.';
import LDT_CONST from './const';
import debugDriver from './debugDriver';
import { getStore } from './flooks';
import * as reduxUtils from './storeUtils';
import useUnattached, { UnattachedStoreType } from '@/renderer/store/unattached';
import envLogger from './envLogger';
import useTestbench, { TestbenchStoreType } from '@/renderer/store/testbench';

class MessageCenter {
  clientAction: ConnectionStoreType | null = null;
  unattachedAction: UnattachedStoreType | null = null;
  testbenchAction: TestbenchStoreType | null = null;

  // ********* recv from LDT server **********/
  // Process general messages.
  handleServerMessage(message: any) {
    if (!this.clientAction) {
      this.clientAction = getStore(useConnection);
    }
    if (!this.unattachedAction) {
      this.unattachedAction = getStore(useUnattached);
    }
    if (!this.testbenchAction){
      this.testbenchAction = getStore(useTestbench);
    }
    if (message) {
      const { event, data } = message;
      if (!event || !data) {
        return false;
      }

      let result = false;
      switch (event) {
        case LDT_CONST.EVENT_CUSTOMIZED:
          if (this.handleSyncUnAttachedMessage(data)) {
            result = true;
            break;
          }
          result = this.handleNodeCDPMessage(data);
          break;
        default:
          break;
      }

      // env log
      // Customized messages are truncated when they are larger than 4KB (aligned with the ALog standard)
      const customizedMsg = data.data?.message;
      let envLogMsg = message;
      if (typeof customizedMsg === 'string') {
        const msgLength = customizedMsg.length;
        if (msgLength > 4096 && typeof message === 'object') {
          const truncatedMessage = {
            ...message,
            data: {
              ...message.data,
              data: {
                ...message.data.data,
                message: `${customizedMsg.slice(0, 2048)}...message of length ${
                  msgLength - 4096
                } truncated...${customizedMsg.slice(msgLength - 2048)}`
              }
            }
          };
          envLogMsg = truncatedMessage;
        }
      }
      envLogger.info(envLogMsg, {
        module: 'Devtool',
        tag: 'onMsg'
      });

      return result;
    }
    return false;
  }
  handleSyncUnAttachedMessage(data: any): boolean {
    if (data?.type !== LDT_CONST.SYNC_UNATTACHED) {
      return false;
    }
    console.log('SYNC_UNATTACHED');
    this.unattachedAction?.display();
    return true;
  }

  // Process cdp messages
  handleNodeCDPMessage(content: any) {
    let msg = content.data?.message;
    const session_id: number = content.data?.session_id ?? -1;
    if (!msg) {
      return false;
    }
    // console.debug('receiveMessage', content);
    if (typeof msg === 'string') {
      msg = JSON.parse(msg);
    }

    const clientId = content?.data?.client_id;
    const type = content?.type;
    if (type === LDT_CONST.MSG_SELECT_SESSION) {
      this.handleSelectSession(msg, clientId);
      return true;
    }
    if (type === LDT_CONST.MSG_SET_CARD_FILTER) {
      const { cardFilter } = msg;
      this.clientAction?.setCardFilter(cardFilter);
      return true;
    }
    const method = msg?.method;
    switch (method) {
      case LDT_CONST.TRACING_EVENT_COMPLETE:
        this.handleTraceComplete(msg, clientId);
        break;
      case LDT_CONST.MSG_ScreenshotCaptured: {
        const sessionId = content?.data?.session_id;
        this.handleScreenshotCaptured(msg, sessionId);
        break;
      }
      default:
        break;
    }
    if (msg?.id && msg?.result && msg.result.engineType) {
      this.handleEngineType(msg.result.engineType, clientId, content?.data?.session_id);
    }
    return false;
  }

  async readStreamDataPromise(stream: number): Promise<Array<Buffer>> {
    const dataChunks: Array<Buffer> = [];
    try {
      let hasEnd = false;
      while (!hasEnd) {
        const message = await this.sendIOReadMessage(stream);
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
  }

  // ********* handler **********/
  async handleTraceComplete(msg: any, clientId: number) {
    console.log('has receive TraceComplete');
    const runningClient = reduxUtils.getClientWithId(clientId);
    if (runningClient?.traceStarting || runningClient?.traceLoading || msg?.params?.isStartupTracing) {
      const stream = msg?.params?.stream;
      console.log('start read trace data:');
      const dataChunks = await this.readStreamDataPromise(stream);
      const fileName = `${utils.getFileName()}.pftrace`;
      utils.uploadFileBufferToLocal(dataChunks, fileName, 'trace').then((res) => {
        const url = res?.url;
        console.log('trace url:' + url);
        if (url) {
          this.clientAction?.setTraceLoading(clientId, false);
          const timer = reduxUtils.getClientWithId(clientId)?.traceTimer;
          if (timer) {
            clearTimeout(timer);
            this.clientAction?.setTraceTimer(clientId, null);
          }
        } else {
          this.clientAction?.setTraceLoading(clientId, false);
          message.error('Failed to upload trace file, please try again');
        }
      });
    }
  }

  handleScreenshotCaptured(msg: any, sessionId: number) {
    this.testbenchAction?.addScreenshot(sessionId, msg?.params?.data);
    this.clientAction?.updateSessionScreenshot(sessionId, msg?.params?.data);
  }

  handleEngineType(engineType: string, client_id: number, sessionId: number) {
    this.clientAction?.setEngineType(client_id, engineType, sessionId);
  }

  handleSelectSession(msg?: any, clientId?: number) {
    const { session_id } = msg;
    const { deviceList, selectedDevice, setSelectedDevice, setSelectedSession } = getStore(useConnection);
    if (selectedDevice.clientId !== clientId) {
      const device = deviceList.find((d) => d.clientId === clientId);
      if (device) {
        setSelectedDevice(device, session_id);
      }
    } else {
      setSelectedSession(session_id);
    }
    message.info(t('app_select_session_success') ?? '');
  }

  sendIOReadMessage(stream: number) {
    const params = {
      method: LDT_CONST.TRACING_IO_READ,
      session_id: -1,
      params: { handle: stream, size: 1024 * 1024 }
    };
    return debugDriver.sendCustomMessageAsync({ params }, 30000);
  }
}

const messageCenter = new MessageCenter();
export default messageCenter;
