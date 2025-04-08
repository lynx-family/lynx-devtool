// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os'); // Add this for temp directory access

// Detect OS - match the bash script exactly
const detectOS = () => {
  switch (process.platform) {
    case 'darwin':
      return 'darwin';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows_nt';
    default:
      return 'unknown';
  }
};

// Detect architecture - match the bash script exactly
const detectArch = () => {
  const arch = process.arch;
  switch (arch) {
    case 'x64':
      return 'x86_64';
    case 'arm64':
      return 'arm64';
    default:
      return arch;
  }
};

const OS_TYPE = detectOS();
const ARCH = detectArch();

console.log(`Detected OS: ${OS_TYPE}`);
console.log(`Detected architecture: ${ARCH}`);

const currentDir = process.cwd();
const staticPath = path.join(currentDir, 'static');

// This resolves paths the same way as the bash script
const resolve = relativePath => path.resolve(currentDir, relativePath);

const fetchDepotTools = () => {
  const depotToolsPath = resolve('buildtools/depot_tools');
  if (!fs.existsSync(depotToolsPath)) {
    console.log('Downloading depot_tools...');
    execSync('git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git ' + depotToolsPath + ' --depth=1');
    console.log('depot_tools downloaded successfully to: ' + depotToolsPath);
  } else {
    console.log('depot_tools already exists at: ' + depotToolsPath);
  }
  process.env.PATH = depotToolsPath + path.delimiter + process.env.PATH;
};

// Download GN tool - matching the bash script's functionality
const fetchGnTool = () => {
  const gnDir = path.join(currentDir, 'buildtools', OS_TYPE, 'gn');
  const gnPath = path.join(gnDir, OS_TYPE === 'windows_nt' ? 'gn.exe' : 'gn');

  if (!fs.existsSync(gnPath)) {
    console.log('Downloading gn tool...');
    fs.rmSync(gnDir, { recursive: true, force: true });
    fs.mkdirSync(gnDir, { recursive: true });

    let gnPackage;
    switch (OS_TYPE) {
      case 'darwin':
        gnPackage = ARCH === 'arm64' ? 'gn/gn/mac-arm64' : 'gn/gn/mac-amd64';
        break;
      case 'linux':
        gnPackage = ARCH === 'x86_64' ? 'gn/gn/linux-amd64' : 'gn/gn/linux-arm64';
        break;
      case 'windows_nt':
        gnPackage = 'gn/gn/windows-amd64';
        break;
      default:
        console.error('Unsupported operating system: ' + OS_TYPE);
        process.exit(1);
    }

    console.log('Detected system:', OS_TYPE, ', architecture:', ARCH);
    console.log('Using package:', gnPackage);

    // Create a temporary file for the ensure-file content instead of using heredoc
    const tempFile = path.join(os.tmpdir(), `gn-ensure-file-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, `${gnPackage} latest`);

    try {
      execSync(`cipd ensure -root "${gnDir}" -ensure-file "${tempFile}"`, { stdio: 'inherit' });
    } finally {
      // Clean up the temporary file
      fs.rmSync(tempFile, { force: true });
    }
  }

  return gnPath;
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
        break;
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

    // Use the same approach for ninja - temporary file instead of heredoc
    const tempFile = path.join(os.tmpdir(), `ninja-ensure-file-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, `${ninjaPackage} latest`);

    try {
      execSync(`cipd ensure -root "${ninjaPath}" -ensure-file "${tempFile}"`, { stdio: 'inherit' });
    } finally {
      // Clean up the temporary file
      fs.rmSync(tempFile, { force: true });
    }

    console.log('ninja downloaded successfully to: ' + ninjaPath);
  } else {
    console.log('ninja already exists at: ' + ninjaPath);
  }
};

const buildDevtool = (mode = 'release') => {
  console.log(`\nPreparing build mode: ${mode}`);

  // Get the GN tool path
  const gnPath = fetchGnTool();

  // Make executable
  try {
    fs.chmodSync(gnPath, '755');
  } catch (err) {
    console.warn('Could not change file permissions:', err.message);
  }

  // Build args match exactly what's in the bash script
  const isOfficialBuild = mode === 'release' ? 'true' : 'false';
  const isDebug = mode === 'debug' ? 'true' : 'false';

  // Create output directory if it doesn't exist
  const outDir = path.join(currentDir, 'out', 'Default');
  fs.mkdirSync(outDir, { recursive: true });

  // Fix Windows path handling
  if (OS_TYPE === 'windows_nt') {
    // Windows requires different argument formatting
    const argsString = `is_official_build=${isOfficialBuild} is_debug=${isDebug}`;
    console.log(`Running GN with args: ${argsString}`);

    // Use cmd.exe to avoid quoting issues on Windows
    execSync(`"${gnPath}" gen "out\\Default" --args="${argsString}"`, {
      stdio: 'inherit',
      shell: true
    });
  } else {
    // Unix systems
    const args = `is_official_build=${isOfficialBuild} is_debug=${isDebug}`;
    execSync(`"${gnPath}" gen out/Default --args='${args}'`, { stdio: 'inherit' });
  }

  console.log('\nBuilding...');

  // Also handle ninja command with proper paths for Windows
  if (OS_TYPE === 'windows_nt') {
    execSync('autoninja -C out\\Default', { stdio: 'inherit', shell: true });
  } else {
    execSync('autoninja -C out/Default', { stdio: 'inherit' });
  }
};

const copyStaticFilesToDir = () => {
  const dirPath = path.join(currentDir, 'out/Default/gen/front_end');
  fs.mkdirSync(path.join(dirPath, 'plugin'), { recursive: true });
  fs.mkdirSync(path.join(dirPath, 'trace'), { recursive: true });

  if (fs.existsSync(staticPath)) {
    // Copy directories
    if (fs.existsSync(path.join(staticPath, 'plugin'))) {
      fs.cpSync(path.join(staticPath, 'plugin'), path.join(dirPath, 'plugin'), { recursive: true });
    }
    if (fs.existsSync(path.join(staticPath, 'trace'))) {
      fs.cpSync(path.join(staticPath, 'trace'), path.join(dirPath, 'trace'), { recursive: true });
    }

    // Copy individual files
    const filesToCopy = ['apexcharts.js', 'base64js.min.js', 'inflate.min.js', 'compare-versions.js'];
    filesToCopy.forEach(file => {
      if (fs.existsSync(path.join(staticPath, file))) {
        fs.copyFileSync(path.join(staticPath, file), path.join(dirPath, file));
      }
    });
  }

  console.log('Copying static files to directory...');
  fs.rmSync(path.join(currentDir, 'output'), { recursive: true, force: true });
  fs.mkdirSync(path.join(currentDir, 'output'), { recursive: true });

  const timestamp = Date.now();
  const outputDir = path.join(currentDir, 'output', `front_end_${timestamp}`);
  fs.mkdirSync(outputDir, { recursive: true });

  // Copy files from build output to timestamped directory
  fs.cpSync(path.join(currentDir, 'out/Default/gen/front_end'), outputDir, { recursive: true });

  // Copy inspector.html
  fs.copyFileSync(
    path.join(currentDir, 'out/Default/gen/front_end/inspector.html'),
    path.join(currentDir, 'output/inspector.html')
  );

  // Update paths in inspector.html
  const inspectorHtmlPath = path.join(currentDir, 'output', 'inspector.html');
  const inspectorHtmlContent = fs.readFileSync(inspectorHtmlPath, 'utf8')
    .replace(/\.\/front_end\//g, `./front_end_${timestamp}/`)
    .replace(/\.\//g, `./front_end_${timestamp}/`);
  fs.writeFileSync(inspectorHtmlPath, inspectorHtmlContent);

  console.log('Packaging...');
  // Change to output directory for tar command
  const originalDir = process.cwd();
  process.chdir(path.join(currentDir, 'output'));

  try {
    if (fs.existsSync(`front_end_${timestamp}`) && fs.existsSync('inspector.html')) {
      execSync(`tar -czf devtool.frontend.lynx_1.0.${timestamp}.tar.gz inspector.html front_end_${timestamp}`, { stdio: 'inherit' });
    } else {
      console.error('Error: Required files not found for packaging');
      process.exit(1);
    }
  } finally {
    process.chdir(originalDir);
  }
};

const main = mode => {
  fetchDepotTools();
  fetchNinja();
  buildDevtool(mode);
  copyStaticFilesToDir();
};

main(process.argv[2]);
