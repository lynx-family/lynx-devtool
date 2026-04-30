#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const { detectOS, detectArch } = require('./fetch-depot-tools.js');

const projectRoot = path.join(__dirname, '..');
const defaultDevtoolsDir = path.join(projectRoot, 'packages', 'devtools-frontend-lynx');

function parseArgs(args) {
    const options = {
        mode: 'release',
        frontendDir: process.env.LYNX_DEVTOOLS_FRONTEND_DIR || process.env.LYNX_DEVTOOLS_UPSTREAM_DIR || defaultDevtoolsDir,
        skipBuild: process.env.LYNX_DEVTOOLS_SKIP_BUILD === '1'
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--frontend-dir' || arg === '--upstream-dir') {
            options.frontendDir = path.resolve(args[++i]);
        } else if (arg.startsWith('--frontend-dir=')) {
            options.frontendDir = path.resolve(arg.slice('--frontend-dir='.length));
        } else if (arg.startsWith('--upstream-dir=')) {
            options.frontendDir = path.resolve(arg.slice('--upstream-dir='.length));
        } else if (arg === '--skip-build') {
            options.skipBuild = true;
        } else if (!arg.startsWith('--')) {
            options.mode = arg;
        }
    }

    return options;
}

const buildOptions = parseArgs(process.argv.slice(2));
const devtoolsDir = path.resolve(buildOptions.frontendDir);
process.chdir(devtoolsDir);

const currentDir = process.cwd();
const isExternalFrontend = currentDir !== path.resolve(defaultDevtoolsDir);
const OS_TYPE = detectOS();
const ARCH = detectArch();

console.log(`Detected OS: ${OS_TYPE}`);
console.log(`Detected architecture: ${ARCH}`);
console.log(`DevTools frontend directory: ${currentDir}`);

function resolve(relativePath) {
    return path.join(currentDir, relativePath);
}

// Function to run command with proper error handling
function runCommand(command, options = {}) {
    try {
        console.log(`Running: ${command}`);
        const result = execSync(command, {
            stdio: 'inherit',
            encoding: 'utf8',
            ...options
        });
        return result;
    } catch (error) {
        console.error(`Command failed: ${command}`);
        console.error(error.message);
        throw error;
    }
}

// Function to run the fetch-depot-tools script
function runFetchDepotTools() {
    console.log('Running fetch-depot-tools...');
    try {
        require('./fetch-depot-tools.js').main();
    } catch (error) {
        console.error('Failed to run fetch-depot-tools:', error.message);
        throw error;
    }
}

// Function to build devtools
function buildDevtool(mode = 'release') {
    console.log(`\nPreparing build mode: ${mode}`);

    if (isExternalFrontend) {
        buildUpstreamDevtool();
        return;
    }

    // Ensure buildtools directory exists
    const buildtoolsDir = path.join('buildtools', OS_TYPE, 'gn');
    fs.mkdirSync(buildtoolsDir, { recursive: true });

    // Download gn tool if not exists
    const gnExecutable = OS_TYPE === 'windows_nt' ? 'gn.exe' : 'gn';
    const gnPath = path.join(buildtoolsDir, gnExecutable);

    if (!fs.existsSync(gnPath)) {
        console.log('Downloading gn tool...');

        // Remove existing gn directory
        if (fs.existsSync(buildtoolsDir)) {
            fs.rmSync(buildtoolsDir, { recursive: true, force: true });
        }
        fs.mkdirSync(buildtoolsDir, { recursive: true });

        let GN_PACKAGE;
        switch (OS_TYPE) {
            case 'darwin':
                switch (ARCH) {
                    case 'arm64':
                        GN_PACKAGE = 'gn/gn/mac-arm64';
                        break;
                    case 'x86_64':
                        GN_PACKAGE = 'gn/gn/mac-amd64';
                        break;
                    default:
                        throw new Error(`Unsupported Mac architecture: ${ARCH}`);
                }
                break;
            case 'linux':
                switch (ARCH) {
                    case 'x86_64':
                        GN_PACKAGE = 'gn/gn/linux-amd64';
                        break;
                    case 'arm64':
                        GN_PACKAGE = 'gn/gn/linux-arm64';
                        break;
                    default:
                        throw new Error(`Unsupported Linux architecture: ${ARCH}`);
                }
                break;
            case 'windows_nt':
                switch (ARCH) {
                    case 'x86_64':
                        GN_PACKAGE = 'gn/gn/windows-amd64';
                        break;
                    default:
                        throw new Error(`Unsupported Windows architecture: ${ARCH}`);
                }
                break;
            default:
                throw new Error(`Unsupported operating system: ${OS_TYPE}`);
        }

        console.log(`Detected system: ${OS_TYPE}, architecture: ${ARCH}`);
        console.log(`Using package: ${GN_PACKAGE}`);

        const ensureFile = `${GN_PACKAGE} latest`;
        try {
            runCommand(`cipd ensure -root "${buildtoolsDir}" -ensure-file -`, {
                input: ensureFile,
                stdio: ['pipe', 'inherit', 'inherit']
            });
        } catch (error) {
            console.warn('Failed to download gn via cipd, trying alternative approach...');
            // Could implement alternative download method here if needed
            throw error;
        }
    }

    // Set executable permissions
    if (OS_TYPE !== 'windows_nt') {
        try {
            fs.chmodSync(gnPath, '755');
        } catch (error) {
            console.warn('Failed to set executable permissions on gn');
        }
    }

    // Build arguments
    const isOfficialBuild = mode === 'release' ? 'true' : 'false';
    const isDebug = mode === 'debug' ? 'true' : 'false';
    const gnArgs = `is_official_build=${isOfficialBuild} is_debug=${isDebug}`;

    // Generate build files
    const gnCommand = `"${gnPath}" gen out/Default --args="${gnArgs}"`;
    runCommand(gnCommand);

    // Build
    console.log('\nBuilding...');

    // Try different ninja locations in order of preference
    const ninjaLocations = [
        path.join(resolve('third_party/ninja'), OS_TYPE === 'windows_nt' ? 'ninja.exe' : 'ninja'),
        path.join(resolve('buildtools/depot_tools'), OS_TYPE === 'windows_nt' ? 'ninja.exe' : 'ninja'),
        'autoninja',
        'ninja'
    ];

    let buildSuccess = false;
    for (const ninjaCmd of ninjaLocations) {
        try {
            if (ninjaCmd === 'autoninja' || ninjaCmd === 'ninja') {
                runCommand(`${ninjaCmd} -C out/Default`);
            } else if (fs.existsSync(ninjaCmd)) {
                runCommand(`"${ninjaCmd}" -C out/Default`);
            } else {
                continue;
            }
            buildSuccess = true;
            break;
        } catch (error) {
            console.log(`Failed to build with ${ninjaCmd}, trying next option...`);
        }
    }

    if (!buildSuccess) {
        throw new Error('Could not find a working ninja executable');
    }
}

function buildUpstreamDevtool() {
    if (buildOptions.skipBuild) {
        console.log('Skipping upstream frontend build because --skip-build was provided.');
        return;
    }

    const packageJsonPath = resolve('package.json');
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`package.json not found in ${currentDir}`);
    }

    const env = {
        ...process.env,
        DEPOT_TOOLS_UPDATE: process.env.DEPOT_TOOLS_UPDATE || '0'
    };
    const depotToolsCandidates = [
        process.env.DEPOT_TOOLS_PATH,
        path.join(projectRoot, '..', 'depot_tools'),
        path.join(currentDir, 'buildtools', 'depot_tools')
    ].filter(Boolean);
    const depotToolsPath = depotToolsCandidates.find(candidate => fs.existsSync(candidate));
    if (depotToolsPath) {
        env.PATH = `${depotToolsPath}${path.delimiter}${env.PATH}`;
    }

    runCommand('npm run build -- --target=Default', { cwd: currentDir, env });
}

function resolveStaticPath() {
    const localStaticPath = resolve('static');
    if (fs.existsSync(localStaticPath)) {
        return localStaticPath;
    }
    return path.join(defaultDevtoolsDir, 'static');
}

function copyStaticAssets(staticPath, frontEndDir) {
    if (!fs.existsSync(staticPath)) {
        console.warn(`Static assets not found: ${staticPath}`);
        return;
    }

    const pluginDir = path.join(frontEndDir, 'plugin');
    const traceDir = path.join(frontEndDir, 'trace');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(traceDir, { recursive: true });

    const pluginSrc = path.join(staticPath, 'plugin');
    const traceSrc = path.join(staticPath, 'trace');

    if (fs.existsSync(pluginSrc)) {
        copyRecursive(pluginSrc, pluginDir);
    }
    if (fs.existsSync(traceSrc)) {
        copyRecursive(traceSrc, traceDir);
    }

    const filesToCopy = [
        'apexcharts.js',
        'base64js.min.js',
        'inflate.min.js',
        'compare-versions.js'
    ];

    filesToCopy.forEach(file => {
        const srcFile = path.join(staticPath, file);
        const destFile = path.join(frontEndDir, file);
        if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, destFile);
        }
    });
}

function copyLegacyImageAssets(frontEndDir) {
    const sourceDir = path.join(defaultDevtoolsDir, 'front_end', 'Images', 'src');
    if (!fs.existsSync(sourceDir)) {
        return;
    }

    const targetDir = path.join(frontEndDir, 'Images');
    fs.mkdirSync(targetDir, { recursive: true });

    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        if (!entry.isFile()) {
            continue;
        }
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        if (!fs.existsSync(targetPath)) {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

function copyEntrypointHtml(genFrontEndDir, outputDir, timestamp, fileName) {
    const src = path.join(genFrontEndDir, fileName);
    const dest = path.join(outputDir, fileName);
    if (!fs.existsSync(src)) {
        return false;
    }

    fs.copyFileSync(src, dest);
    let content = fs.readFileSync(dest, 'utf8');
    content = content.replace(/\.\//g, `./front_end_${timestamp}/`);
    fs.writeFileSync(dest, content);
    return true;
}

function transpileOutputCss(targetDir) {
    const scriptPath = path.join(projectRoot, 'scripts', 'transpile-devtools-css.js');
    runCommand(`node "${scriptPath}" "${targetDir}"`, { cwd: projectRoot });
}

function patchRuntimeCompat(targetDir) {
    const scriptPath = path.join(projectRoot, 'scripts', 'patch-devtools-runtime-compat.js');
    runCommand(`node "${scriptPath}" "${targetDir}"`, { cwd: projectRoot });
}

// Function to copy static files and create output
function copyStaticFilesToDir() {
    const genFrontEndDir = path.join(currentDir, 'out', 'Default', 'gen', 'front_end');
    if (!fs.existsSync(genFrontEndDir)) {
        throw new Error(`Generated frontend directory not found: ${genFrontEndDir}`);
    }

    console.log(`Current directory: ${process.cwd()}`);

    // Remove existing output directory
    const outputDir = path.join(defaultDevtoolsDir, 'output');
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = Math.floor(Date.now() / 1000);
    const frontEndTimestampDir = path.join(outputDir, `front_end_${timestamp}`);

    fs.mkdirSync(frontEndTimestampDir, { recursive: true });

    // Copy generated front_end files
    copyRecursive(genFrontEndDir, frontEndTimestampDir);

    const staticPath = resolveStaticPath();
    copyStaticAssets(staticPath, frontEndTimestampDir);
    copyLegacyImageAssets(frontEndTimestampDir);
    transpileOutputCss(frontEndTimestampDir);

    if (!isExternalFrontend) {
        copyStaticAssets(staticPath, genFrontEndDir);
        copyLegacyImageAssets(genFrontEndDir);
    }

    const packagedEntrypoints = ['inspector.html', 'devtools_app.html'].filter(fileName => {
        return copyEntrypointHtml(genFrontEndDir, outputDir, timestamp, fileName);
    });
    if (!packagedEntrypoints.includes('inspector.html')) {
        throw new Error('inspector.html not found for packaging');
    }

    patchRuntimeCompat(frontEndTimestampDir);

    // Create tar.gz archive
    process.chdir(outputDir);

    const frontEndDir = `front_end_${timestamp}`;

    if (fs.existsSync(frontEndDir) && packagedEntrypoints.every(fileName => fs.existsSync(fileName))) {
        const archiveName = `devtool.frontend.lynx_1.0.${timestamp}.tar.gz`;
        const archiveInputs = [...packagedEntrypoints, frontEndDir].map(fileName => `"${fileName}"`).join(' ');

        // Use tar command if available
        try {
            runCommand(`tar -czf "${archiveName}" ${archiveInputs}`);
            console.log(`Created archive: ${archiveName}`);
        } catch (error) {
            console.warn('tar command failed, trying alternative archive method...');
            // Could implement alternative archiving method here if needed
            throw error;
        }
    } else {
        throw new Error('Required files not found for packaging');
    }
}

// Utility function to copy directory recursively
function copyRecursive(src, dest) {
    if (fs.statSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        const files = fs.readdirSync(src);
        files.forEach(file => {
            copyRecursive(path.join(src, file), path.join(dest, file));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Main function
function main(mode = 'release') {
    try {
        // Ensure depot_tools is available
        const depotToolsPath = resolve('buildtools/depot_tools');
        if (fs.existsSync(depotToolsPath)) {
            process.env.PATH = `${depotToolsPath}${path.delimiter}${process.env.PATH}`;
        }

        // Run fetch depot tools first
        if (!isExternalFrontend) {
            runFetchDepotTools();
        }

        // Build devtools
        buildDevtool(mode);

        // Copy static files and create output
        copyStaticFilesToDir();

        console.log('build-lynx-devtools completed successfully!');
    } catch (error) {
        console.error('build-lynx-devtools failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main(buildOptions.mode);
}

module.exports = { main, buildDevtool, copyStaticFilesToDir };
