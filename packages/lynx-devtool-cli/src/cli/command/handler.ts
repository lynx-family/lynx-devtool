// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as utils from '../utils';
import { FileType, FileTypes, FileSuffixs, DEFAULT_STATIC_SERVE_PORT } from '../../config';
import fs from 'fs-extra';
import execa from 'execa';
import { defaultLogger, getConfigItem, setConfigItem } from '../../utils';
import { DebugRouterConnector } from '@lynx-js/debug-router-connector';
import { EnvLogManager } from '../../utils/envLogManager';
import feEnvLogHandler from '../utils/feEnvLogHandler';
import { app } from 'electron';
import path from 'path';
import { LDT_DIR } from '../utils';
import { getCurrentChannel } from '../updator/updator';
import { kCliPackageName, kScopeName } from '@lynx-js/lynx-devtool-utils';

export const uploadFilePath = utils.getUploadFilePath();
const separator = '___';

export function uploadFileToLocal(req: any, res: any, host: string) {
  try {
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    res.send({
      code: 0,
      file: fileName,
      url: `${host}/localResource/file/${fileName}`,
      message: 'Upload successfully'
    });
  } catch (error) {
    res.send({
      code: -1,
      message: error
    });
  }
}

function fileSuffix(type: FileType) {
  if (type === FileTypes.trace) {
    return FileSuffixs.trace;
  } else if (type === FileTypes.lighthouse) {
    return FileSuffixs.lighthouse;
  } else if (type === FileTypes.testbench) {
    return FileSuffixs.testbench;
  }
  return '';
}

export function reconnect(req: any, res: any, driver: DebugRouterConnector) {
  defaultLogger.debug('handler reconnect');
  res?.send({
    code: 0,
    message: 'success'
  });
  driver.startWatchAllClients();
}

export function renameLocalFile(req: any, res: any) {
  const sendError = (error: any) => {
    res.send({
      code: -1,
      message: error
    });
  };
  try {
    const oldName = req?.query?.oldName;
    const newName = req?.query?.newName;
    const oldPath = `${uploadFilePath}/${oldName}`;
    const newPath = `${uploadFilePath}/${newName}`;
    if (oldName && newName && fs.existsSync(oldPath)) {
      fs.rename(oldPath, newPath, (error: any) => {
        if (error) {
          sendError(error);
          return;
        }
        res.send({
          code: 0,
          message: 'success'
        });
      });
    } else {
      sendError(`File not exists: ${oldPath}`);
    }
  } catch (error) {
    sendError(error);
  }
}

export async function deleteLocalFile(req: any, res: any) {
  try {
    const fileName = req?.query?.fileName;
    const filePath = `${uploadFilePath}/${fileName}`;
    await fs.remove(filePath);
    res.send({
      code: 0,
      message: 'success'
    });
  } catch (error) {
    res.send({
      code: -1,
      message: error
    });
  }
}

export async function queryIntranetIp(req: any, res: any) {
  try {
    let vpnFirst = true;
    if (req?.query?.lan && req?.query?.lan === 'true') {
      vpnFirst = false;
    }
    const currentIp = await utils.getIpAddress(vpnFirst);
    res.send({
      code: 0,
      data: currentIp,
      message: 'success'
    });
  } catch (error) {
    res.send({
      code: -1,
      message: error
    });
  }
}

export function lstIdentity(req: any, res: any) {
  res.send({
    code: 0,
    message: 'success'
  });
}

export async function checkAdb(req: any, res: any) {
  try {
    const { stdout } = await execa('which', ['adb']);
    const adbPath = stdout?.trim();
    const adbDevicePromise = execa(adbPath, ['devices']);
    const timeOutPromise = new Promise((resolve: any) => {
      setTimeout(() => {
        resolve('failed');
      }, 2000);
    });
    const result = await Promise.race([adbDevicePromise, timeOutPromise]);
    if (result === 'failed') {
      res?.send({
        code: -1,
        message: 'failed'
      });
    } else {
      res?.send({
        code: 0,
        message: 'success'
      });
    }
  } catch (error: any) {
    res?.send({
      code: -1,
      message: error
    });
  }
}

// Check if there is a surviving service
export async function checkExistServer(req: any, res: any) {
  const serverList: Promise<boolean>[] = [];
  for (let i = DEFAULT_STATIC_SERVE_PORT; i <= DEFAULT_STATIC_SERVE_PORT + 20; i++) {
    serverList.push(utils.isLSTService(`http://localhost:${i}/lstIdentity`));
  }
  const resultList = await Promise.all(serverList);
  const existList = resultList.filter((result) => result);
  const exist: boolean = existList?.length >= 2;
  res.send({
    code: exist ? 0 : -1
  });
}

// Use an external browser to open the url
export function openUrlExternal(req: any, res: any) {
  const url = req?.query?.url;
  if (url) {
    utils.openBrowser(url);
  }
}

export function getLDTVersion(req: any, res: any) {
  const ldtPath = path.resolve(LDT_DIR, getCurrentChannel(), kScopeName, kCliPackageName);

  const packageJsonPath = path.resolve(ldtPath, 'package.json');
  const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJsonObj = JSON.parse(packageJson);
  const version = packageJsonObj.version;

  res.send({
    code: 0,
    data: version
  });
}

export function getGitInfo(req: any, res: any) {
  const exec = require('child_process').execSync;
  try {
    const username = exec('git config --get user.name').toString().trim();
    const email = exec('git config --get user.email').toString().trim();
    res.send({
      code: 0,
      data: { username, email }
    });
  } catch (e) {
    res.send({
      code: -1,
      message: e
    });
  }
}

export function addEnvLogs(req: any, res: any) {
  const { batchId, logs } = req.body;
  feEnvLogHandler.addEnvLogs(batchId, logs);
  res.send({ code: 0 });
}

export async function uploadEnvLogs(req: any, res: any) {
  const { appId, did } = req.body;
  // flush buffered batches before upload
  feEnvLogHandler.flushBatchBuffer();
  const result = await EnvLogManager.uploadLogFiles(`${appId ?? 'no_appId'}-${did ?? 'no_did'}`);
  res.send({
    code: 0,
    data: result
  });
}

export async function firstConnectionMade(req: any, res: any) {
  setConfigItem('region', 'cn');
  
  res.send({ code: 0 });
}

export async function getConfigItemByKey(req: any, res: any) {
  const { key } = req.query;
  const value = await getConfigItem(key);
  if (value) {
    res.send({ value, code: 0 });
    return;
  }
  res.send({ code: -1 });
}

export function deleteCLI(req: any) {
  return new Promise((resolve, reject) => {
    const { channel = 'prod' } = req.body;
    fs.remove(`${utils.LDT_DIR}/${channel}`, (err) => {
      if (err) {
        defaultLogger.error(err);
        reject(err);
      } else {
        resolve(0);
      }
      EnvLogManager.uploadLogFiles('deleteCLI');
    });
  });
}
