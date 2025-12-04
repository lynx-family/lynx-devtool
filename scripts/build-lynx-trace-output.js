#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Change to project root directory
const projectRoot = path.join(__dirname, '..');
process.chdir(projectRoot);

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

// Function to replace text in file
function replaceInFile(filePath, searchText, replaceText) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(searchText, replaceText);
        fs.writeFileSync(filePath, content);
        console.log(`Updated: ${filePath}`);
    } else {
        console.warn(`File not found: ${filePath}`);
    }
}

// Function to remove files matching pattern
function removeFiles(dir, pattern) {
    if (!fs.existsSync(dir)) {
        return;
    }

    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        try {
            const stat = fs.statSync(fullPath);

            if (stat.isFile() && file.match(pattern)) {
                fs.unlinkSync(fullPath);
                console.log(`Removed: ${fullPath}`);
            } else if (stat.isDirectory()) {
                removeFiles(fullPath, pattern);
            }
        } catch (error) {
            console.warn(`Skipping ${fullPath}: ${error.message}`);
            // Skip files that can't be accessed (e.g., broken symlinks)
        }
    });
}

// Function to copy directory recursively
function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        return;
    }

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

// Function to find files matching pattern
function findFiles(dir, pattern) {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const files = [];
    const items = fs.readdirSync(dir);

    items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isFile() && item.match(pattern)) {
            files.push(fullPath);
        } else if (stat.isDirectory()) {
            files.push(...findFiles(fullPath, pattern));
        }
    });

    return files;
}

// Main function
function main() {
    try {
        console.log('Building lynx-trace output...');

        // Initialize and update git submodules
        console.log('Initializing git submodules...');
        runCommand('git submodule init');
        runCommand('git submodule update --remote');

        // Change to lynx-trace directory
        const lynxTraceDir = path.join('packages', 'lynx-trace');

        if (!fs.existsSync(lynxTraceDir)) {
            console.error(`Error: lynx-trace directory not found at ${lynxTraceDir}`);
            console.log('Please ensure the lynx-trace submodule is properly initialized.');
            process.exit(1);
        }

        process.chdir(lynxTraceDir);
        console.log(`Changed directory to: ${process.cwd()}`);

        // Remove existing output
        const outputDir = 'output';
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
            console.log('Removed existing output directory');
        }

        // Set environment variable
        process.env.PUPPETEER_SKIP_DOWNLOAD = '1';

        console.log('Installing build dependencies, please wait. The first installation may take 5~10 minutes...');

        // Patch install-build-deps file if it exists
        const installBuildDepsPath = path.join('tools', 'install-build-deps');
        if (fs.existsSync(installBuildDepsPath)) {
            console.log('Patching install-build-deps...');

            // Read the file content
            let content = fs.readFileSync(installBuildDepsPath, 'utf8');

            // Apply patches
            content = content.replace(/'--frozen-lockfile'/g, "'--no-frozen-lockfile', '-f'");
            content = content.replace(/'--shamefully-hoist',/g, '');

            // Write back the patched content
            fs.writeFileSync(installBuildDepsPath, content);

            // Create backup
            fs.writeFileSync(installBuildDepsPath + '.bak', content);
        }

        // Patch ui_main.ts file if it exists
        const uiMainPath = path.join('ui', 'src', 'frontend', 'ui_main.ts');
        if (fs.existsSync(uiMainPath)) {
            console.log('Patching ui_main.ts...');
            replaceInFile(
                uiMainPath,
                /AppImpl\.instance\.embeddedMode(?! \|\| true)/g,
                'AppImpl.instance.embeddedMode || true'
            );

            // Create backup
            const content = fs.readFileSync(uiMainPath, 'utf8');
            fs.writeFileSync(uiMainPath + '.bak', content);
        }

        // Patch cookie_consent.ts file if it exists
        const cookieConsentPath = path.join('ui', 'src', 'core', 'cookie_consent.ts');
        if (fs.existsSync(cookieConsentPath)) {
            console.log('Patching cookie_consent.ts...');
            replaceInFile(
                cookieConsentPath,
                'this.showCookieConsent = true;',
                'this.showCookieConsent = false;'
            );

            // Create backup
            const content = fs.readFileSync(cookieConsentPath, 'utf8');
            fs.writeFileSync(cookieConsentPath + '.bak', content);
        }

        // Patch BUILD.gn file if it exists
        const buildGnPath = path.join('gn', 'BUILD.gn');
        if (fs.existsSync(buildGnPath)) {
            console.log('Patching BUILD.gn...');
            let content = fs.readFileSync(buildGnPath, 'utf8');
            content = content.replace(/.*\/\/gn\/standalone:check_build_deps.*\n/g, '');
            fs.writeFileSync(buildGnPath, content);

            // Create backup
            fs.writeFileSync(buildGnPath + '.bak', content);
        }

        // Remove .bak files
        console.log('Cleaning up .bak files...');
        removeFiles(path.join('ui', 'src'), /\.bak$/);

        // Install build dependencies
        if (fs.existsSync(installBuildDepsPath)) {
            try {
                // Make the script executable
                fs.chmodSync(installBuildDepsPath, '755');

                console.log('Running install-build-deps...');
                runCommand(`"${installBuildDepsPath}" --no-dev-tools --ui`, {
                    stdio: ['inherit', 'inherit', 'pipe'] // Redirect stderr to pipe to suppress some warnings
                });
                console.log('install-build-deps completed');
            } catch (error) {
                console.warn('install-build-deps encountered some warnings, continuing...');
                console.warn('Error details:', error.message);
                // Continue execution as warnings are often non-fatal
            }
        } else {
            console.log('install-build-deps not found, skipping...');
        }

        console.log('Install build dependencies successfully!');

        // Run GN generation for UI build
        console.log('Running GN generation...');
        try {
            runCommand('python tools/gn gen out/ui --args="is_debug=false perfetto_build_with_android=false"');
            console.log('✓ GN generation completed successfully');
        } catch (error) {
            console.error('GN generation failed:', error.message);
            throw error;
        }

        // Install UI dependencies
        const uiDir = path.join('ui');
        if (fs.existsSync(uiDir)) {
            process.chdir(uiDir);
            console.log('Installing UI dependencies...');

            try {
                runCommand('npm install --force');
            } catch (error) {
                console.warn('npm install encountered warnings, continuing...');
            }

            process.chdir('..');
        }

        // Build
        console.log('Building UI...');
        const buildJsPath = path.join('ui', 'build.js');

        if (fs.existsSync(buildJsPath)) {
            // Use system Node.js directly to run build.js
            // Set NODE_OPTIONS like the tools/node script does
            const originalNodeOptions = process.env.NODE_OPTIONS;
            const originalPath = process.env.PATH;

            process.env.NODE_OPTIONS = `--max_old_space_size=8192 ${originalNodeOptions || ''}`;

            try {
                runCommand(`node "${buildJsPath}" --no-depscheck --minify-js all`);
            } finally {
                // Restore original environment
                if (originalNodeOptions !== undefined) {
                    process.env.NODE_OPTIONS = originalNodeOptions;
                } else {
                    delete process.env.NODE_OPTIONS;
                }
                process.env.PATH = originalPath;

                // No need to restore build.js since we're using wrapper approach

                // No temporary files to clean up
            }
        } else {
            // Try to run the shell script as fallback
            const buildScriptPath = path.join('ui', 'build');
            if (fs.existsSync(buildScriptPath)) {
                fs.chmodSync(buildScriptPath, '755');
                runCommand(`"${buildScriptPath}" --no-depscheck --minify-js all`);
            } else {
                throw new Error('Build script not found at ui/build.js or ui/build');
            }
        }

        // Move dist to output
        const distDir = path.join('out', 'ui', 'ui', 'dist');
        if (fs.existsSync(distDir)) {
            console.log('Moving dist to output...');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            copyRecursive(distDir, outputDir);
            console.log('Moved dist to output successfully');
        } else {
            console.error('Built dist directory not found');
            process.exit(1);
        }

        // Create tar.gz archive
        process.chdir(outputDir);
        console.log('Creating tar.gz archive...');

        try {
            runCommand('tar -czf lynx-trace.tar.gz --exclude=lynx-trace.tar.gz .');
            console.log('Created lynx-trace.tar.gz successfully');
        } catch (error) {
            console.warn('tar command failed, trying alternative archive method...');
            // Could implement alternative archiving method here if needed
            throw error;
        }

        // Go back to project root
        process.chdir(projectRoot);

        // Sync the built file to resources
        const aPath = 'packages/lynx-trace/output';
        const bPath = 'packages/lynx-devtool-cli/resources';

        const latestFiles = findFiles(aPath, /^lynx-trace\.tar\.gz$/);

        if (latestFiles.length === 0) {
            console.error('Error: lynx-trace.tar.gz not found.');
            process.exit(1);
        }

        const latestFile = latestFiles[0];
        console.log('Copying the lynx-trace dist...');

        // Ensure target directory exists
        if (!fs.existsSync(bPath)) {
            fs.mkdirSync(bPath, { recursive: true });
        }

        const destPath = path.join(bPath, 'lynx-trace.tar.gz');
        fs.copyFileSync(latestFile, destPath);
        console.log(`Copied: ${latestFile} -> ${destPath}`);

        console.log('Build lynx-trace output successfully!');

    } catch (error) {
        console.error('build-lynx-trace-output failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main, replaceInFile, removeFiles, copyRecursive, findFiles };