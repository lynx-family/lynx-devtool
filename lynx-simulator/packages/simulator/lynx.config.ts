// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@lynx-js/rspeedy';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { pluginRspeedyDevReady } from '@lynx-js/lynxtron-dev-plugins/rspeedy';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = process.cwd();
console.log('rootPath: ', path.resolve(rootPath, './src/assets'));
export default defineConfig({
  server: {
    port: 5969,
  },
  source: {
    alias: {
      '@assets': path.resolve(rootPath, './src/assets'),
    },
  },
  output: {
    filename: '[name].[platform].bundle',
  },
  environments: {
    web: {
      source: {
        entry: {
          main: './src/app/index.tsx',
        },
      },
      output: {
        target: 'web',
        distPath: {
          root: './output/bundle/web',
        },
      },
    },
    lynx: {
      source: {
        entry: {
          main: './src/app/index.tsx',
        },
      },
      output: {
        assetPrefix: new URL('./dist/desktop/', pathToFileURL(__dirname + path.sep)).toString(),
        distPath: {
          root: './output/bundle/lynx',
        },
      },
    },
  },
  plugins: [
    pluginReactLynx(),
    (() => {
      const p = pluginRspeedyDevReady();
      // @ts-ignore
      delete p.apply;
      const originalSetup = p.setup;
      p.setup = (api: any) => {
        if (!api.onAfterDevCompile && api.onDevCompileDone) {
          api.onAfterDevCompile = api.onDevCompileDone;
        }
        return originalSetup(api);
      };
      return p;
    })(),
  ],
});
