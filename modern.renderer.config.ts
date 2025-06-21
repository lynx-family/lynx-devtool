import appTools, { defineConfig } from '@modern-js/app-tools';
import { version } from './package.json';
import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import RspackVirtualModulePlugin from 'rspack-plugin-virtual-module';
import { generateRendererVirtualModule } from './scripts/virtualModule';

export default defineConfig({
  runtime: {
    router: false
  },
  dev: {
    hmr: true
  },
  source: {
    entriesDir: './src/renderer/pages/app',
    entries: {
      'devtool': {
        'entry': './src/renderer/pages/app/index.tsx',
      }
    },
    // preEntry: './src/renderer/common/polyfill.ts',
    globalVars: {
      'process.env.LDT_BUILD_TYPE': JSON.stringify(process.env.LDT_BUILD_TYPE),
      'process.env.BUILD_VERSION': JSON.stringify(process.env.BUILD_VERSION ?? version),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
      // keep the complete definition of window.process
      'window.process': JSON.stringify({
        env: {
          NODE_ENV: process.env.NODE_ENV ?? 'development',
          LDT_BUILD_TYPE: process.env.LDT_BUILD_TYPE,
          BUILD_VERSION: process.env.BUILD_VERSION ?? version
        }
      })
    },
    alias: {
      zlib: require.resolve('browserify-zlib'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      path: require.resolve('path-browserify'),
      fs: require.resolve('memfs'),
      os: require.resolve('os-browserify/browser'),
      crypto: require.resolve('crypto-browserify'),
      util: require.resolve('util/'),
      assert: require.resolve('assert/'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      constants: require.resolve('constants-browserify'),
      process: require.resolve('process/browser'),
    }
  },
  output: {
    distPath: {
      root: './dist/lynx-devtool-web',
    },
    sourceMap: true,
    svgDefaultExport: 'component',
  },
  html: {
    templateParameters: (params) => {
      // in offline mode, disable the entry page cache to prevent automatic upgrades from causing page opening failures
      if (process.env.LDT_BUILD_TYPE === 'offline') {
        params.meta += `\n<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
          <meta http-equiv="Pragma" content="no-cache">
          <meta http-equiv="Expires" content="0">`;
      }
      params.meta += '<meta name="referrer" content="never">';
      return params;
    }
  },
  plugins: [appTools({
    bundler: 'rspack'
  })],
  builderPlugins: [
    pluginNodePolyfill()
  ],
  tools: {
    rspack: {
      plugins: [
        new RspackVirtualModulePlugin({
          virtualModules: generateRendererVirtualModule(__dirname)
        })
      ]
    }
  }
});
