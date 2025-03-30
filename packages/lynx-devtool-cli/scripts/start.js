const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// make sure cli has been built
if (!fs.existsSync('dist')) {
  console.log('lynx-devtool-cli not built. running build first.');
  execSync('emo run build', { stdio: 'inherit' });
}

// start lynx-devtool-web
const PATH_LDT_PC = path.resolve(__dirname, '../../../packages/lynx-devtool-web');
if (!fs.existsSync(PATH_LDT_PC)) {
  console.error('lynx-devtool-web directory not found. make sure you have setup ldt-res repo correctly.');
  process.exit(1);
}

const CMD_RUN_CLI = 'node bin/ldt.js start --upgradeChannel debug';
const RUN_MODE = process.argv[2];

if (RUN_MODE === 'cli') {
  execSync(CMD_RUN_CLI, { stdio: 'inherit' });
} else if (RUN_MODE === 'cli+pc') {
  execSync(`concurrently "emo run wait && ${CMD_RUN_CLI} --debug true" "cd ${PATH_LDT_PC} && pnpm run start:offline"`, { stdio: 'inherit' });
}
