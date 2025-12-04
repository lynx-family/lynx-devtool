#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get the project root directory
const projectRoot = path.join(__dirname, '..');
process.chdir(projectRoot);

const OS_TYPE = detectOS();

function detectOS() {
    const platform = process.platform;
    if (platform === 'darwin') return 'darwin';
    if (platform === 'linux') return 'linux';
    if (platform === 'win32') return 'windows_nt';
    throw new Error(`Unsupported platform: ${platform}`);
}

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

function main() {
    try {
        console.log('Starting devtools-frontend-lynx build process...\n');

        // Step 1: Fetch depot_tools
        console.log('Step 1: Fetching depot_tools...');
        runCommand('pnpm run fetch:depot_tools');

        // Step 2: Add depot_tools to PATH
        console.log('\nStep 2: Setting up PATH...');
        const depotToolsPath = path.join(
            projectRoot,
            'packages',
            'devtools-frontend-lynx',
            'buildtools',
            'depot_tools'
        );

        if (!fs.existsSync(depotToolsPath)) {
            throw new Error(`depot_tools not found at: ${depotToolsPath}`);
        }

        // Set PATH for child processes
        process.env.PATH = `${depotToolsPath}${path.delimiter}${process.env.PATH}`;
        console.log(`Added depot_tools to PATH: ${depotToolsPath}`);

        // Step 3: Sync devtools-gn
        console.log('\nStep 3: Syncing devtools-gn...');
        runCommand('pnpm run sync:devtools-gn', {
            env: process.env
        });

        // Step 4: Build devtools
        console.log('\nStep 4: Building devtools...');
        runCommand('pnpm run build:devtools');

        // Step 5: Sync devtools-dist
        console.log('\nStep 5: Syncing devtools-dist...');
        runCommand('pnpm run sync:devtools-dist');

        console.log('\n✓ devtools-frontend-lynx build completed successfully!');
    } catch (error) {
        console.error('\n✗ devtools-frontend-lynx build failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
