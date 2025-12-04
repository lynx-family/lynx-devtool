#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to run command with proper error handling
function runCommand(command, options = {}) {
    try {
        console.log(`Running: ${command}`);
        const result = execSync(command, {
            stdio: 'inherit',
            encoding: 'utf8',
            shell: true,
            ...options
        });
        return result;
    } catch (error) {
        console.error(`Command failed: ${command}`);
        console.error(error.message);
        throw error;
    }
}

// Function to ensure directory exists
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
}

// Function to copy file or directory
function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`Source not found: ${src}`);
        return;
    }

    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        ensureDir(dest);
        const files = fs.readdirSync(src);
        files.forEach(file => {
            copyRecursive(path.join(src, file), path.join(dest, file));
        });
    } else {
        fs.copyFileSync(src, dest);
        console.log(`Copied: ${src} -> ${dest}`);
    }
}

// Function to extract tar.gz files
function extractTarGz(tarFile, destDir) {
    if (!fs.existsSync(tarFile)) {
        console.warn(`Tar file not found: ${tarFile}`);
        return;
    }

    ensureDir(destDir);

    try {
        // Try using tar command (available on Windows 10+ and Unix)
        runCommand(`tar -xf "${tarFile}" -C "${destDir}"`);
        console.log(`Extracted: ${tarFile} -> ${destDir}`);
    } catch (error) {
        console.error(`Failed to extract ${tarFile}:`, error.message);
        throw error;
    }
}

// Function to remove directory recursively with platform-specific handling
function removeDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        return;
    }

    try {
        // On Windows, use native rmdir command which is more reliable
        if (process.platform === 'win32') {
            // Use cmd /c to ensure proper command execution
            const absPath = path.resolve(dirPath);
            runCommand(`cmd /c rmdir /s /q "${absPath}"`, { stdio: 'pipe' });
            console.log(`Removed: ${dirPath}`);
        } else {
            // On Unix-like systems, use rm -rf
            runCommand(`rm -rf "${dirPath}"`, { stdio: 'pipe' });
            console.log(`Removed: ${dirPath}`);
        }
    } catch (error) {
        // If command fails, try Node.js fs method
        console.warn(`Command-based removal failed, trying Node.js fs...`);
        try {
            fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
            console.log(`Removed: ${dirPath}`);
        } catch (fsError) {
            console.warn(`Could not remove ${dirPath}: ${fsError.message}`);
            console.warn(`Continuing anyway...`);
            // Don't throw - allow the build to continue
        }
    }
}

// Main function
function main() {
    try {
        console.log('Unzipping resources...');

        // Change to package directory
        const packageDir = path.resolve(__dirname, '..');
        process.chdir(packageDir);
        console.log(`Working directory: ${process.cwd()}`);

        // devtool frontend
        console.log('Setting up devtool frontend...');
        removeDir('dist/static');
        ensureDir('dist/static/devtool/lynx');

        // Find devtool frontend tar.gz file
        const resourcesDir = 'resources';
        if (fs.existsSync(resourcesDir)) {
            const files = fs.readdirSync(resourcesDir);
            const devtoolTar = files.find(file => file.startsWith('devtool.frontend.lynx_') && file.endsWith('.tar.gz'));

            if (devtoolTar) {
                extractTarGz(path.join(resourcesDir, devtoolTar), 'dist/static/devtool/lynx');
            } else {
                console.warn('DevTool frontend tar.gz not found');
            }
        }

        // 404 page
        console.log('Setting up 404 page...');
        ensureDir('dist/static/404');
        const notFoundHtml = path.join(resourcesDir, '404.html');
        if (fs.existsSync(notFoundHtml)) {
            copyRecursive(notFoundHtml, 'dist/static/404/404.html');
        }

        // open shell script
        console.log('Setting up open shell script...');
        const openScript = path.join(resourcesDir, 'openChrome.applescript');
        if (fs.existsSync(openScript)) {
            copyRecursive(openScript, 'dist/static/openChrome.applescript');
        }

        // lynx-trace
        console.log('Setting up lynx-trace...');
        ensureDir('dist/static/trace');
        const lynxTraceTar = path.join(resourcesDir, 'lynx-trace.tar.gz');
        if (fs.existsSync(lynxTraceTar)) {
            extractTarGz(lynxTraceTar, 'dist/static/trace');
            if (process.platform === 'win32') {
                console.log('✓ Using prebuilt lynx-trace artifact on Windows');
            }
        } else {
            console.warn('lynx-trace.tar.gz not found, skipping trace setup');
        }

        console.log('✓ Resources unzipped successfully!');

    } catch (error) {
        console.error('Failed to unzip resources:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main, extractTarGz, copyRecursive, ensureDir, removeDir };