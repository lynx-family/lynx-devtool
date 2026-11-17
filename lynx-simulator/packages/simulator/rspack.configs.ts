// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Shared rspack configs for the simulator desktop app, CLI and web host.
//
// rspack.config.ts builds the public package with these configs. Another
// distribution can build the same sources into its own package by passing a
// different packageRoot, module aliases and externals.

import { defineConfig } from '@rspack/cli';
import { rspack, type Configuration, type RuleSetRule } from '@rspack/core';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { pluginLynxtron } from '@lynx-js/lynxtron-dev-plugins/rspack';

export type SimulatorBuildTarget = 'desktop' | 'cli' | 'web';

export interface SimulatorConfiguration {
  // Package that receives dist/ and whose package.json is shipped with the app.
  packageRoot: string;
  targets: SimulatorBuildTarget[];
  isDev?: boolean;
  // Module replacements, keyed by absolute source path.
  alias?: Record<string, string>;
  // Extra or replacement externals, merged over the public ones.
  externals?: Record<string, string>;
  // Directory of the built Lynx bundles for the desktop app. Lynx templates are
  // host specific, so a distribution with its own Lynxtron host builds its own.
  lynxBundleDirectory?: string;
}

// Root of the public simulator sources.
export const simulatorSourceRoot = path.dirname(fileURLToPath(import.meta.url));

const typescriptRule: RuleSetRule = {
  test: /\.ts$/,
  exclude: [/node_modules/],
  loader: 'builtin:swc-loader',
  options: {
    jsc: {
      parser: {
        syntax: 'typescript',
      },
    },
  },
  type: 'javascript/auto',
};

export function createSimulatorRspackConfigs(options: SimulatorConfiguration): Configuration[] {
  const { packageRoot, isDev = false } = options;
  const sourcePath = (...segments: string[]) => path.join(simulatorSourceRoot, ...segments);
  const resolve = {
    extensions: ['.ts', '.js', '.json'],
    alias: options.alias ?? {},
  };

  const desktopConfig = defineConfig({
    context: simulatorSourceRoot,
    target: 'electron-main',
    devtool: isDev ? 'source-map' : false,
    entry: {
      main: sourcePath('src/main/desktop/main.ts'),
      preload: sourcePath('src/main/desktop/preload.ts'),
    },
    output: {
      path: path.join(packageRoot, 'dist/desktop/'),
      filename: '[name].js',
      module: true,
      clean: true,
    },
    devServer: {
      devMiddleware: {
        writeToDisk: true,
      },
    },
    watchOptions: {
      ignored: [
        '**/src/app/**',
        '**/output/bundle/lynx/**',
        // Lynxtron AutoLink rewrites its generated entry module on every
        // watchRun; watching it would rebuild in an endless loop.
        '**/node_modules/.cache/lynxtron-dev-plugins/**',
      ],
    },
    module: {
      rules: [
        typescriptRule,
        {
          test: /\.svg$/,
          type: 'asset',
        },
      ],
    },
    plugins: [
      new rspack.CopyRspackPlugin({
        patterns: [
          { from: path.join(packageRoot, 'package.json'), to: 'package.json' },
          { from: sourcePath('resources/lynx-simulator.png'), to: 'lynx-simulator.png' },
          {
            from: options.lynxBundleDirectory ?? sourcePath('output/bundle/lynx/'),
            to: '.',
          },
        ],
      }),
      ...(isDev
        ? [
            pluginLynxtron({
              isDev,
              entry: path.join(packageRoot, 'dist/desktop'),
              args: ['--inspect=9222'],
            }),
          ]
        : []),
    ],
    externalsPresets: { node: true },
    // Keep dependencies as runtime packages so desktop and CLI share the
    // installed copies, and package-relative assets such as built-in pages keep
    // stable paths.
    externals: {
      '@lynx-js/lynx-simulator-core': 'module @lynx-js/lynx-simulator-core',
      // Keep Lynxtron external so its package-relative runtime paths are resolved
      // from the installed package instead of being written into the desktop bundle
      // at build time.
      '@lynx-js/lynxtron': 'module @lynx-js/lynxtron',
      '@lynx-js/lynxtron/context-bridge': 'module @lynx-js/lynxtron/context-bridge',
      ...options.externals,
    },
    resolve,
  });

  const cliConfig = defineConfig({
    context: simulatorSourceRoot,
    target: 'node',
    devtool: false,
    entry: {
      main: sourcePath('src/cli/main.ts'),
      'update-check-worker': sourcePath('src/cli/update/worker.ts'),
    },
    output: {
      path: path.join(packageRoot, 'dist/cli/'),
      filename: '[name].js',
      module: true,
      clean: true,
    },
    module: {
      rules: [typescriptRule],
    },
    externalsPresets: { node: true },
    externals: {
      '@lynx-js/lynx-simulator-core': 'module @lynx-js/lynx-simulator-core',
      ...options.externals,
    },
    resolve,
  });

  const webConfig = defineConfig({
    context: simulatorSourceRoot,
    target: 'web',
    entry: {
      'web-host': sourcePath('src/main/web/web-host.ts'),
      'nodejs-adapter-web': sourcePath('src/main/web/nodejs_adapter_web.ts'),
    },
    output: {
      path: path.join(packageRoot, 'dist/web/'),
      filename: '[name].js',
    },
    experiments: {
      asyncWebAssembly: true,
      css: true,
    },
    module: {
      rules: [
        typescriptRule,
        {
          test: /\.css$/,
          type: 'css',
        },
        {
          test: /\.(png|svg|jpg)$/,
          type: 'asset',
        },
      ],
    },
    plugins: [
      new rspack.HtmlRspackPlugin({
        template: sourcePath('src/main/web/index.html'),
        filename: 'index.html',
        chunks: ['web-host'],
      }),
      new rspack.CopyRspackPlugin({
        patterns: [{ from: sourcePath('output/bundle/web/'), to: '.' }],
      }),
    ],
    resolve: {
      ...resolve,
      extensions: ['.ts', '.js', '.tsx'],
    },
    optimization: {
      minimize: !isDev,
    },
    devServer: {
      port: 8080,
      historyApiFallback: true,
      proxy: [
        {
          context: (pathname: string) => {
            return (
              pathname.endsWith('.bundle') ||
              pathname.endsWith('.map') ||
              pathname.includes('__rspeedy') ||
              pathname.includes('/static/')
            );
          },
          target: 'http://localhost:3000',
          pathRewrite: {
            '^/web/': '/',
          },
        },
      ],
    },
  });

  const configs: Record<SimulatorBuildTarget, Configuration> = {
    desktop: desktopConfig,
    cli: cliConfig,
    web: webConfig,
  };
  return options.targets.map((target) => configs[target]);
}

export function getBuildTargets(): SimulatorBuildTarget[] {
  return (process.env.TARGET_ENV || 'desktop,cli,web').split(',') as SimulatorBuildTarget[];
}
