const fs = require('fs');
const path = require('path');
const tar = require('tar');

// devtool frontend
const distStaticDevtoolLynx = path.join('dist', 'static', 'devtool', 'lynx');
fs.rmSync(distStaticDevtoolLynx, { recursive: true, force: true });
fs.mkdirSync(distStaticDevtoolLynx, { recursive: true });
tar.x({ file: 'resources/devtool.frontend.lynx_*.tar.gz', C: distStaticDevtoolLynx });

// 404 page
const distStatic404 = path.join('dist', 'static', '404');
fs.mkdirSync(distStatic404, { recursive: true });
fs.copyFileSync('resources/404.html', path.join(distStatic404, '404.html'));

// open shell
fs.copyFileSync('resources/openChrome.applescript', path.join('dist', 'static', 'openChrome.applescript'));
