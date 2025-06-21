// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { definePlugin, MainContext } from '@lynx-js/devtool-plugin-core/main';
import axios from 'axios';
import { compareVersions, validate } from 'compare-versions';

let _params: any, cliVersion: string | undefined;

const semverCompare = (a: string, b: string): number => {
  if (validate(a) && validate(b)) {
    return compareVersions(a, b);
  }
  // If a or b doesn't conform to semantic version format, fallback to use localeCompare to prevent code errors
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

const getCliVersion = async (host: string) => {
  if (cliVersion) {
    return Promise.resolve(cliVersion);
  }
  try {
    const rt = await axios.get(`http://${host}/getVersion`);
    cliVersion = rt.data?.data;
    return cliVersion;
  } catch (_) {
    return undefined;
  }
};

const isLDT3 = async (host: string) => {
  try {
    const version = await getCliVersion(host);
    if (!version) {
      return true;
    }
    return semverCompare(version, '0.0.64') > 0;
  } catch (_) {
    return true;
  }
};

const bridge = (_: MainContext) => ({
  getInspectUrl: async (type?: 'web' | 'lynx') => {
    try {
      console.log('bridge', _params);
      
      // Validate if necessary parameters exist
      if (!_params || !_params.ldtUrl) {
        console.warn('Missing required parameters for getInspectUrl');
        return undefined;
      }
      
      const { viewMode, ldtUrl } = _params;
      const { host } = new URL(ldtUrl);
      if (viewMode === 'mobile') {
        if (type) {
          return `http://${host}/localResource/devtool/${type}/inspector.html`;
        } else {
          return undefined;
        }
      }
      const res = (await isLDT3(host)) ? 'devtools_app' : 'inspector';
      return `http://${host}/localResource/devtool/${viewMode}/${res}.html`;
    } catch (error) {
      console.error('Failed to construct inspect URL:', error);
      // Return a default URL or undefined
      return undefined;
    }
  }
});

export type AsyncBridgeType = ReturnType<typeof bridge>;

export default definePlugin<AsyncBridgeType>({
  asyncBridge: bridge,
  onCreate(_, params) {
    _params = params;
  },
  onRestart(_, params) {
    _params = params;
  }
});
