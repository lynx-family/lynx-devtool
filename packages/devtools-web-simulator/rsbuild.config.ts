import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

// Ensure GitHub Pages assets are served under /devtools-web-simulator/ in production
const assetPrefix = process.env.ASSET_PREFIX || (process.env.NODE_ENV === 'production' ? '/devtools-web-simulator/' : '/');

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/main.tsx',
    },
  },
  dev: {
    port: 5174,
    strictPort: true,
  },
  output: {
    assetPrefix,
  },
  html: {
    template: './index.html',
  },
});


