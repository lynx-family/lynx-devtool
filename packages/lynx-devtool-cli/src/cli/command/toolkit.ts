// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { DebugRouterConnector, UsbClient, getDriverReportService } from '@lynx-js/debug-router-connector';
import axios, { AxiosResponse } from 'axios';
import { CliOptions, DEFAULT_ROOM_ID } from '../../config';
import { EnvLogManager, defaultLogger } from '../../utils';
import { UpdateResult, getCurrentChannel, setupResource, tryUseChannel } from '../updator/updator';
import * as utils from '../utils';
import { handleUsbMessage, initDebugRouterConnector } from '../utils/usbClient/fakeClient';
import { LDTCLIClient } from './LDTDriverClient';
import { LDTMultiOpenCallback } from './LDTMultiOpenCallback';
import httpServer from './httpServer';
import { deleteCLI } from './handler';
import path from 'node:path';
import fs from 'node:fs';
import { LDT_DIR } from '../utils';
import { kCliPackageName, kScopeName } from '@lynx-js/lynx-devtool-utils';
import { app } from 'electron';

let driver: DebugRouterConnector;

export async function restartLDTServer() {
  if (!driver?.wss) {
    // start ldt server
    await driver.startWSServer();
    return Boolean(driver?.wss);
  }
  return true;
}

/**
 *
 * closeCoverageUploadSwitch on iOS
 *
 * @param client
 * @returns 0: (default), -1:(error), 1:(close successfully)
 */
async function closeCoverageUploadSwitch(client: UsbClient) {
  if (client.info.query.os !== 'iOS') {
    return 0;
  }
  defaultLogger.debug('start closeCoverageUploadSwitch');
  const result = await client.sendCustomizedMessage('App.SetCoverageUploadSwitch', { switch: 'false' }, -1, 'App');
  try {
    const resultJson = JSON.parse(result);
    const messageJson = JSON.parse(resultJson.result);
    if (messageJson.switch !== undefined) {
      if (messageJson.switch !== '0') {
        defaultLogger.warn(`closeCoverageUploadSwitch failed:${messageJson.switch}`);
        return -1;
      } else {
        return 1;
      }
    }
  } catch (e) {
    defaultLogger.debug(`App.SetCoverageUploadSwitch return result don't match:${result}`);
  }
  return 0;
}

const FRAGMENT_SIZE = 1024000;
function handleUSBTransTemplate(disableWSS: boolean | undefined, client: UsbClient) {
  if (disableWSS) {
    // speedy mode
    defaultLogger.info(`handleUSBTransTemplate:`);
    if (process.env.USBTransTemplate === 'false') {
      defaultLogger.warn(`USBTransTemplate is closed`);
      return;
    }
    client.sendClientMessage('App.OpenUsbTransTemplateSwitch', {});
    client.on('DownloadTemplateByUsb', (...params: any[]) => {
      const requestId = params[0]?.requestId;
      let url = params[0]?.url;
      getDriverReportService()?.report('USBTransTemplateRequest', null, { requestId, url });
      // some interceptors will changed speedy's url to https
      if (url.search('https://') === 0) {
        url = url.replace('https://', 'http://');
      }
      axios
        .get(url, {
          headers: {
            'Accept-Encoding': 'identity',
            Range: 'bytes=0-'
          },
          responseType: 'arraybuffer'
        })
        .then((response: AxiosResponse) => {
          getDriverReportService()?.report('USBTransTemplateSuccess', null, { requestId, url });
          // handle success
          defaultLogger.info(`download successfully: ${url}, start to transfer template by usb`);
          let bufferData = Buffer.from(response.data);
          let seqId = 0;
          const tem_file_len = bufferData.length;
          getDriverReportService()?.report('lynx_download_res', null, { file_size: tem_file_len });
          while (bufferData.length > FRAGMENT_SIZE) {
            const willSendData = bufferData.toString('base64', 0, FRAGMENT_SIZE);
            client.sendClientMessage('App.ReceiveTemplateByUsb', {
              data: willSendData,
              seqId: seqId.toString(),
              requestId: `${requestId}`,
              url
            });
            bufferData = bufferData.slice(FRAGMENT_SIZE, bufferData.length);
            seqId++;
          }
          // last fragment
          const base64Data = bufferData.toString('base64');
          client.sendClientMessage('App.ReceiveTemplateByUsb', {
            data: base64Data,
            seqId: seqId.toString(),
            requestId: `${requestId}`,
            seq_count: (seqId + 1).toString(),
            tem_file_len: `${tem_file_len}`,
            url
          });
        })
        .catch((error) => {
          // handle error
          const errorInfo = error?.message ?? 'unknown error';
          defaultLogger.warn(`download failed: ${errorInfo}, url= ${url}`);
          client.sendClientMessage('App.ReceiveTemplateByUsb', { error: 'download failed', requestId: `${requestId}` });
          getDriverReportService()?.report('USBTransTemplateError', null, { error: errorInfo, requestId, url });
        });
    });
  }
}

async function sendRemoteIP(client: UsbClient) {
  const ip = await utils.getIpAddress();
  client.sendClientMessage('App.RemoteIP', { ip });
}

function doBusinessTask(disableWSS: boolean | undefined) {
  driver.on('client-connected', (client: UsbClient) => {
    handleUSBTransTemplate(disableWSS, client);
    closeCoverageUploadSwitch(client).then((result) => {
      defaultLogger.debug(`closeCoverageUploadSwitch result:${result}`);
    });
    sendRemoteIP(client);
  });
}

async function startLocalServer(params: CliOptions | undefined): Promise<string> {
  // start ws server or client
  let wssPath = '';
  if (params?.disableWSS && params?.wss) {
    wssPath = params.wss;
  }
  let roomId = DEFAULT_ROOM_ID;
  if (params?.disableWSS && params?.room) {
    roomId = params.room;
  }
  if (!driver) {
    driver = new DebugRouterConnector({
      enableWebSocket: true,
      enableAndroid: true,
      enableIOS: true,
      enableDesktop: true,
      websocketOption: { roomId }
    });
    doBusinessTask(params?.disableWSS);
    if (!params?.disableWSS) {
      const ldtResult = await restartLDTServer();
      if (!ldtResult) {
        throw new Error('Start ldt server faild!');
      }
      // eslint-disable-next-line prefer-destructuring
      wssPath = (driver.wss as any)?.wssPath;
    } else {
      initDebugRouterConnector(driver, wssPath, roomId);
    }
    const ldtMultiOpenCallback = new LDTMultiOpenCallback(
      new LDTCLIClient(driver, params?.disableWSS ?? false, wssPath, roomId)
    );
    driver.setMultiOpenCallback(ldtMultiOpenCallback);
    if (driver?.connectDevices) {
      setTimeout(() => {
        driver.connectDevices();
      }, 1000);
    }
  } else {
    wssPath = (driver.wss as any)?.wssPath ?? wssPath;
    roomId = driver.roomId ?? roomId;
  }

  // start http server
  const host = await httpServer.start(params);

  // If ​​wssPath is undefined, report the exception log immediately
  if (!wssPath) {
    defaultLogger.error(`wssPath is undefined. Call stack: ${new Error().stack}`, {
      module: 'cli',
      tag: 'server'
    });
    await EnvLogManager.uploadLogFiles('duplicateLDTServerCall');
  }

  let lstAddress = `${host}/devtool?ws=${encodeURIComponent(wssPath)}&room=${roomId}`;
  // runType must be spelled, otherwise it will affect the indicator statistics
  lstAddress += `&type=${params?.runType ?? 'cli'}`;

  const ldtPath = path.resolve(LDT_DIR, getCurrentChannel(), kScopeName, kCliPackageName);
  const packageJsonPath = path.resolve(ldtPath, 'package.json');
  const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJsonObj = JSON.parse(packageJson);

  lstAddress += `&version=${packageJsonObj.version ?? 'unknown'}`;
  lstAddress += `&is_prod=${app.isPackaged ?? false}`;
  // pass through query items config
  if (params?.queryItems) {
    Object.entries(params.queryItems).forEach(([queryKey, queryValue]) => {
      if (queryKey && queryValue) {
        lstAddress += `&${queryKey}=${queryValue}`;
      }
    });
  }
  defaultLogger.debug({ host, lstAddress }, { module: 'cli', tag: 'connect' });
  defaultLogger.info(`LDT server start: ${lstAddress}`);

  if (params?.openWebview !== false) {
    utils.startLDTPlatformProcess(lstAddress, params?.ignoreLDTApp);
  }
  process.send?.({ state: true, url: lstAddress } as UpdateResult);

  return lstAddress;
}

export async function toolkitExecutor(argv?: CliOptions): Promise<string> {
  // Print debug log in debug mode
  if (argv?.debug) {
    defaultLogger.setLevel('debug');
  }
  defaultLogger.info(`argv?.setupRes: ${argv?.setupRes}`);
  if (argv?.setupRes) {
    // for postinstall hook
    await setupResource();
    return ''; // Setting up resource does not start LDT itself. Let's exit early here.
  }
  // ===warning start===
  // If the following logic is changed, it may affect the compatibility of the upgrade logic
  try {
    const { state, url, toolkit } = await tryUseChannel(argv);
    if (state && url) {
      // Intercepted by the update logic
      driver = toolkit?.getDebugDriver();
      return url;
    }
  } catch (e) {
    defaultLogger.error(`tryUseChannel error:${e}`);
  }
  // ===warning end===

  // update resource silently
  await setupResource(undefined, undefined, 1);

  return startLocalServer(argv);
}

export function getDebugDriver(): any {
  return driver;
}

export function resetLDT(req: Record<string, any>) {
  return deleteCLI(req);
}

export function sendUsbMessageToWeb(id: number, message: string) {
  console.log(`[${__filename}:sendUsbMessageToWeb`);
  console.log('sendUsbMessageToWeb', id, message);
  if (driver?.wss) {
    console.log('driver?.wss', driver?.wss);
    driver.handleUsbMessage(id, message);
  } else {
    console.log('handleUsbMessage', id, message);
    handleUsbMessage({ id, message });
  }
}
