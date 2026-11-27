const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// 获取项目根目录
const rootDir = process.cwd();
const depotToolsPath = path.join(rootDir, 'packages', 'devtools-frontend-lynx', 'buildtools', 'depot_tools');

// 构建新的 PATH 环境变量
const isWindows = os.platform() === 'win32';
const pathSeparator = isWindows ? ';' : ':';
const newPath = `${depotToolsPath}${pathSeparator}${process.env.PATH}`;

// 要执行的命令列表
const commands = [
  'pnpm run fetch:depot_tools',
  'pnpm run sync:devtools-gn',
  'pnpm run build:devtools',
  'pnpm run sync:devtools-dist'
];

console.log('Building devtools-frontend-lynx with updated PATH...');
console.log(`depot_tools path: ${depotToolsPath}`);

// 执行命令
commands.forEach((command, index) => {
  console.log(`\n[${index + 1}/${commands.length}] Executing: ${command}`);
  try {
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, PATH: newPath },
      cwd: rootDir
    });
  } catch (error) {
    console.error(`Failed to execute: ${command}`);
    process.exit(1);
  }
});

console.log('\nBuild completed successfully!');
