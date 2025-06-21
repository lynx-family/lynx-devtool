// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const fs = require('fs');
const path = require('path');

const getPluginInfo = (pluginDir, dir, type) => {
  const jsonPath = path.join(pluginDir, dir, 'plugin.json');
  const codePath = path.join(pluginDir, dir, type, `index.${type === 'renderer' ? 'tsx' : 'ts'}`);
  const config = {
    json: JSON.parse(fs.readFileSync(jsonPath, 'utf-8')),
    path: fs.existsSync(codePath) ? codePath : undefined
  };

  if (type === 'renderer') {
    const entryPath = path.join(pluginDir, dir, 'renderer', 'entry.tsx');
    if (fs.existsSync(entryPath)) {
      config.entryPath = entryPath;
    }
    const iconPath = path.join(pluginDir, dir, 'renderer', 'icon.tsx');
    if (fs.existsSync(iconPath)) {
      config.iconPath = iconPath;
    }
  }

  return config;
};

const generateImports = (plugins, type) => {
  return plugins
    .map((p, i) => {
      const lines = [];
      if (p.path) {
        lines.push(`import P${i} from '${p.path}';`);
      }
      if (type === 'renderer') {
        if (p.entryPath) {
          lines.push(`import E${i} from '${p.entryPath}';`);
        }
        if (p.iconPath) {
          lines.push(`\nimport I${i} from '${p.iconPath}';`);
        }
      }
      return lines.join('\n');
    })
    .join('\n');
};

const generateMeta = (plugins, type) => {
  return plugins
    .map((p, i) => {
      const entry = type === 'renderer' && p.entryPath ? `,entry: E${i}` : '';
      const icon = type === 'renderer' && p.iconPath ? `icon: I${i},` : '';
      const plugin = p.path ? `,plugin:P${i}` : '';
      return `{${icon}...${JSON.stringify(p.json)} ${plugin}${entry}}`;
    })
    .join(',\n');
};

const generateVirtualModule = (dirname, type) => {
  const pluginDir = path.resolve(dirname, 'plugins');
  const plugins = fs
    .readdirSync(pluginDir)
    .filter((file) => fs.existsSync(path.join(pluginDir, file, 'plugin.json')))
    .map((dir) => getPluginInfo(pluginDir, dir, type));

  const imports = generateImports(plugins, type);
  const meta = generateMeta(plugins, type);

  console.log('webpackage-imports', imports);
  console.log('webpackage-meta', meta);

  return `${imports}\nexport const meta = [${meta}];`;
};

module.exports.generateRendererVirtualModule = (dirname) => generateVirtualModule(dirname, 'renderer');
module.exports.generateMainVirtualModule = (dirname) => generateVirtualModule(dirname, 'main');
