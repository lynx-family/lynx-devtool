// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const currentDir = process.cwd();

// More robust OS detection
const detectOS = () => {
  const platform = process.platform;
  if (platform === 'darwin') {return 'darwin';}
  if (platform === 'linux') {return 'linux';}
  if (platform === 'win32' || platform.match(/^(msys|cygwin)$/)) {return 'windows_nt';}
  return 'unknown';
};

// More robust architecture detection
const detectArch = () => {
  const arch = process.arch;
  if (arch === 'x64' || arch === 'amd64') {return 'x86_64';}
  if (arch === 'arm64' || arch === 'aarch64') {return 'arm64';}
  return arch;
};

const OS_TYPE = detectOS();
const ARCH = detectArch();

const resolve = relativePath => path.resolve(currentDir, relativePath);

const fetchDepotTools = () => {
  const depotToolsPath = resolve('buildtools/depot_tools');
  if (!fs.existsSync(depotToolsPath)) {
    console.log('Downloading depot_tools...');
    execSync('git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git ' + depotToolsPath + ' --depth=1');
    console.log('depot_tools downloaded successfully to: ' + depotToolsPath);

    // Initialize depot_tools
    if (OS_TYPE === 'windows_nt') {
      try {
        execSync('python -m pip install pywin32', { cwd: depotToolsPath, stdio: 'inherit' });
        // Create gclient.bat if it doesn't exist
        const gclientBat = path.join(depotToolsPath, 'gclient.bat');
        if (!fs.existsSync(gclientBat)) {
          fs.writeFileSync(gclientBat, '@echo off\npython %~dp0\\gclient.py %*');
        }
      } catch (error) {
        console.error('Failed to initialize depot_tools:', error);
      }
    }
  }

  // Update PATH and env vars
  const pathSep = OS_TYPE === 'windows_nt' ? ';' : ':';
  process.env.PATH = depotToolsPath + pathSep + process.env.PATH;
  process.env.DEPOT_TOOLS_WIN_TOOLCHAIN = '0';
  process.env.DEPOT_TOOLS_UPDATE = '0';

  console.log('Added depot_tools to PATH:', depotToolsPath);
};

const fetchNinja = () => {
  const thirdPartyPath = resolve('third_party');
  const ninjaPath = path.join(thirdPartyPath, 'ninja');

  if (!fs.existsSync(ninjaPath)) {
    console.log('Downloading ninja...');
    fs.mkdirSync(ninjaPath, { recursive: true });
    let ninjaPackage;
    switch (OS_TYPE) {
      case 'darwin':
        ninjaPackage = ARCH === 'arm64' ? 'fuchsia/third_party/ninja/mac-arm64' : 'fuchsia/third_party/ninja/mac-amd64';
        brseak;
      case 'linux':
        ninjaPackage = ARCH === 'arm64' ? 'fuchsia/third_party/ninja/linux-arm64' : 'fuchsia/third_party/ninja/linux-amd64';
        break;
      case 'windows_nt':
        ninjaPackage = 'fuchsia/third_party/ninja/windows-amd64';
        break;
      default:
        console.error('Unsupported operating system: ' + OS_TYPE);
        process.exit(1);
    }

    console.log('Using ninja package: ' + ninjaPackage);

    // Create temporary ensure file with heredoc-style content
    const ensureContent = `${ninjaPackage} latest\n`;
    const ensureFilePath = path.join(thirdPartyPath, 'ninja_ensure_file');
    fs.writeFileSync(ensureFilePath, ensureContent);

    try {
      execSync(`cipd ensure -root "${ninjaPath}" -ensure-file "${ensureFilePath}"`, { stdio: 'inherit' });
      console.log('ninja downloaded successfully to: ' + ninjaPath);
    } finally {
      fs.unlinkSync(ensureFilePath);
    }
  } else {
    console.log('ninja already exists at: ' + ninjaPath);
  }
};

const main = () => {
  fetchDepotTools();
  fetchNinja();
};

main();
