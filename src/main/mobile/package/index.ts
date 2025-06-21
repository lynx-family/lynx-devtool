// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable max-depth */
import { compare, validate } from 'compare-versions';
import decompress from 'decompress';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'node:path';

import { LDT_DIR } from '@/main/utils/const';
import { createLogger } from '@/main/utils/logger';
import { IDownloadNpmPackage, IGetVersionFromPackageJson } from '@lynx-js/devtool-plugin-core/main';

type Channel = string;

const defaultLogger = createLogger('warn', { prefix: '[LDT:PackageManager]' });

async function getPkgInfoByPkgName(pkgName: string, version: string) {
  const resp = await fetch(`https://registry.npmjs.org/${pkgName}/${version}`); // ignore_security_alert_wait_for_fix SSRF
  return await resp.json();
}

async function getTagsByPkgName(pkgName: string) {
  const resp = await fetch(`https://registry.npmjs.org/-/package/${pkgName}/dist-tags`);
  return await resp.json();
}

function semverCompare(a: string, b: string): number {
  if (validate(a) && validate(b)) {
    return compare(a, b, '>') ? 1 : 0;
  }
  // If a or b doesn't conform to semantic version format, fallback to use localeCompare to prevent code errors
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Download target version to home directory
 * @param version Target version number
 * @param progressListener Progress monitoring callback, input progress range is 0~1
 * @returns Promise<boolean> indicating upgrade success/failure
 */
export async function downloadTargetVersionToHome(
  pkgName: string,
  destRelativePath: string,
  version: string,
  progressListener?: (progress: number) => void
): Promise<string | boolean> {
  try {
    const meta = await getPkgInfoByPkgName(pkgName, version);
    const tarball = meta?.dist?.tarball;
    const res = await fetch(tarball);
    if (progressListener) {
      const contentLength = res.headers.get('Content-Length');
      let receivedBytes = 0;
      res.body.on('data', (chunk) => {
        receivedBytes += chunk.length ?? 0;
        const progress = (0.4 * receivedBytes) / contentLength;
        progressListener(progress);
      });
    }
    const arrayBuffer = await res.arrayBuffer();
    const dest = path.resolve(LDT_DIR, destRelativePath, pkgName, version); // $LDT_DIR/prod

    progressListener?.(0.5);
    await decompress(Buffer.from(arrayBuffer), dest); // ignore_security_alert_wait_for_fix FILE_OPER
    progressListener?.(1);

    return dest;
  } catch (err: any) {
    defaultLogger.error(`updater: download target version failed: ${err.message}`);
    return false;
  }
}

export const getVersionFromPackageJson: IGetVersionFromPackageJson = async function (
  pkgDir: string = __dirname,
  repeatParent = true
): Promise<[string?, string?]> {
  let maxDep = repeatParent ? 100 : 1;
  let curDir = pkgDir;
  while (maxDep-- > 0) {
    const packageDir = path.resolve(curDir, 'package.json');
    if (fs.existsSync(packageDir)) {
      try {
        const json = await fs.readJSON(packageDir);
        return [json.version, json.minVersion];
      } catch (e) {
        console.warn('read package.json failed: ', e);
        return [];
      }
    }
    const newDir = path.resolve(curDir, '..');
    if (newDir === curDir) {
      // Stop searching when reaching system root directory
      break;
    } else {
      curDir = newDir;
    }
  }
  return [];
};

export type UpdateResult = {
  state: boolean;
  url?: string;
  toolkit?: any;
  versionInUse?: string;
};

export const downloadNpmPackage: IDownloadNpmPackage = async function (
  pkgName: string,
  channel: Channel,
  destRelativePath: string,
  options: {
    checkVersion?: boolean;
    localVersion?: string;
  },
  progressListener?: (progress: number) => void
): Promise<string | boolean> {
  try {
    const { localVersion, checkVersion } = options;
    const tags = await getTagsByPkgName(pkgName);
    const remoteVersion = tags[channel];
    defaultLogger.info(`updater: local version ${localVersion}, remote version ${remoteVersion}`);
    if ((checkVersion && !remoteVersion) || (localVersion && semverCompare(remoteVersion, localVersion) <= 0)) {
      // No latest version exists for the corresponding channel, or local version is already latest
      defaultLogger.info('updater: cli no need to upgrade');
      return false;
    }

    return downloadTargetVersionToHome(pkgName, destRelativePath, remoteVersion, progressListener);
  } catch (e: any) {
    defaultLogger.error(`updater download failed: ${e.message}`);
    return false;
  }
};
