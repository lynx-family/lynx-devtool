#!/usr/bin/env node

// Check if running on Windows
if (process.platform === 'win32') {
  console.log('');
  console.log('⚠️  lynx-trace build is not supported on Windows platform.');
  console.log('   Please use macOS or Linux to build lynx-trace.');
  console.log('   Skipping lynx-trace build...');
  console.log('');
  process.exit(0);
}

// On non-Windows platforms, run the actual build script
const { execSync } = require('child_process');
const path = require('path');

try {
  const buildScript = path.join(__dirname, 'build-lynx-trace-output.js');
  execSync(`node "${buildScript}"`, { stdio: 'inherit' });
} catch (error) {
  process.exit(error.status || 1);
}

