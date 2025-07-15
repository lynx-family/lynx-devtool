const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if --skip-hooks flag is provided
const skipHooks = process.argv.includes('--skip-hooks');

// Clear console to make output more readable
console.clear();
console.log('Running gclient sync...');

const devtoolsPath = path.join(__dirname, '..', 'packages', 'devtools-frontend-lynx');
process.chdir(devtoolsPath);

// Make sure depot_tools exists
const depotToolsPath = path.join(devtoolsPath, 'buildtools', 'depot_tools');
if (!fs.existsSync(depotToolsPath)) {
  console.error(`Error: depot_tools not found at ${depotToolsPath}`);
  console.log('Please run fetch:depot_tools first.');
  process.exit(1);
}

// Create or ensure .gclient file exists
const gclientFile = path.join(devtoolsPath, '.gclient');
if (!fs.existsSync(gclientFile)) {
  console.log('Creating .gclient file...');
  fs.writeFileSync(gclientFile, 'solutions = []', 'utf8');
}

try {
  // Only run gclient sync once with clean environment variables to avoid duplicate updates
  const env = { ...process.env };
  
  // Prevent depot_tools auto-update with environment variables
  env.DEPOT_TOOLS_UPDATE = '0';
  env.DEPOT_TOOLS_METRICS = '0';
  
  console.log('Running gclient sync with modified environment...');
  
  // Execute gclient command with or without --nohooks
  const gclientPath = path.join(depotToolsPath, process.platform === 'win32' ? 'gclient.bat' : 'gclient');
  const cmd = `"${gclientPath}" sync --gclientfile=.gclient --deps=all${skipHooks ? ' --nohooks' : ''}`;
  
  console.log(`Executing command: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env });
  
  // If hooks were skipped, let's run the necessary script to get clang-format
  if (skipHooks) {
    console.log('Hooks were skipped. Manually downloading clang-format...');
    execSync('node ../../scripts/manual-download-clang-format.js', { stdio: 'inherit' });
  }
  
  console.log('Successfully ran gclient');
} catch (error) {
  console.error('Failed to run gclient:', error);
  process.exit(1);
}
