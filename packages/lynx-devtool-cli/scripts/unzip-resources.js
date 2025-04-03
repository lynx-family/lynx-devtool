const fs = require('fs');
const path = require('path');
const tar = require('tar');
const glob = require('glob');

// devtool frontend
const distStaticDevtoolLynx = path.join('dist', 'static', 'devtool', 'lynx');
fs.rmSync(distStaticDevtoolLynx, { recursive: true, force: true });
fs.mkdirSync(distStaticDevtoolLynx, { recursive: true });

// Find the tar.gz file matching the pattern
const tarFiles = glob.sync('resources/devtool.frontend.lynx_*.tar.gz');
if (tarFiles.length === 0) {
  console.error('Error: No matching tar.gz file found in resources directory');
  process.exit(1);
}
const tarFile = tarFiles[0]; // Use the first match
console.log(`Extracting ${tarFile}...`);
tar.x({ file: tarFile, C: distStaticDevtoolLynx });

// 404 page
const distStatic404 = path.join('dist', 'static', '404');
fs.mkdirSync(distStatic404, { recursive: true });
fs.copyFileSync('resources/404.html', path.join(distStatic404, '404.html'));

// open shell
fs.copyFileSync('resources/openChrome.applescript', path.join('dist', 'static', 'openChrome.applescript'));
