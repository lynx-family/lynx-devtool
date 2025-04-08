const fs = require('fs');
const path = require('path');

// Define the source and destination files
const src = 'preload.js';
const dest = 'dist/preload.js';

// Create the destination directory if it doesn't exist
fs.mkdirSync(path.dirname(dest), { recursive: true });

// Copy the file
fs.copyFileSync(src, dest);

console.log('preload.js copied successfully.');
