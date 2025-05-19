// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable max-depth */
import { defaultLogger } from '../../utils';
import axios from 'axios';
import { execSync } from 'child_process';
import os from 'node:os';
import open from 'open';
import path from 'path';
import ping from 'ping';

export async function startLDTPlatformProcess(url: string, ignoreLDTApp = false): Promise<boolean> {
  const baseUrl = encodeURI(url.split(/((?<![\/])[\/|\?](?![\/]))/)[0]);
  const fullUrl = encodeURI(url);

  let args = [path.resolve(__dirname, '../static/openChrome.applescript'), baseUrl, fullUrl];

  if (!ignoreLDTApp) {
    const deeplinkUrl = `ldt-electron://cli/open?url=${encodeURIComponent(encodeURIComponent(url))}`;
    defaultLogger.info(`Try to open LDT App with deeplink: ${deeplinkUrl}`);
    args.push(deeplinkUrl);
  }

  try {
    const chromeRunning = require('child_process').spawnSync('ps', ['cax'], { stdio: 'pipe' });
    if (chromeRunning.status === 0 && chromeRunning.stdout.toString().includes('Google Chrome')) {
      require('child_process').spawnSync('osascript', args, {
        cwd: path.resolve(__dirname, '../static'),
        stdio: 'ignore'
      });
      return true;
    }
  } catch (err) {
    // TODO
    // Applescript seems to have some compatibility issues on macos 10.15, temporarily remove the error prompt
    // console.log(err);
  }

  try {
    await open(url);
    return true;
  } catch (err) {
    return false;
  }
}

async function aliveIp(networkInterfaces: any[], interfaceKey: string) {
  // eslint-disable-next-line no-restricted-syntax
  for (const key in networkInterfaces) {
    // Skip vmware virtual nic
    if (key.toLowerCase().indexOf('vmnet') >= 0) {
      continue;
    }
    if (key.indexOf(interfaceKey) >= 0) {
      const networks = networkInterfaces[key];
      for (const network of networks) {
        if (network.family === 'IPv4') {
          const res = await ping.promise.probe(network.address);
          if (res?.alive) {
            return network.address;
          }
        }
      }
    }
  }
  return null;
}

export const getIpAddress = async (vpnFirst = true) => {
  const networkInterfaces = require('os').networkInterfaces();
  if (networkInterfaces) {
    const vpnIp = await aliveIp(networkInterfaces, 'utun');
    const localIp = await aliveIp(networkInterfaces, 'en');
    if (vpnFirst && vpnIp) {
      return vpnIp;
    }
    return localIp;
  }
};

// Is it a lst service
export const isLSTService = async (url: string) => {
  if (!url.startsWith('http://localhost')) {
    return false;
  }
  try {
    const res = await axios.get(url); // ignore_security_alert
    if (res && res.status === 200 && res.data.code === 0) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const LDT_DIR = path.resolve(os.homedir(), '.lynx-devtool');

export const UPDATOR_DEFAULT_CHANNEL = '3x';

export const LDT_RES_CN = 'cn';

export const getUploadFilePath = () => {
  return `${LDT_DIR}/files`;
};

export const getEnvLogPath = () => {
  return `${LDT_DIR}/logs`;
};

export function openBrowser(url: any) {
  throw new Error('Function not implemented.');
}

