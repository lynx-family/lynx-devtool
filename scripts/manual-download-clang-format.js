const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Constants
const BASE_DIR = path.join(__dirname, '..');
const BUILDTOOLS_WIN_DIR = path.join(BASE_DIR, 'packages', 'devtools-frontend-lynx', 'buildtools', 'win');
const CLANG_FORMAT_PATH = path.join(BUILDTOOLS_WIN_DIR, 'clang-format.exe');
const CLANG_FORMAT_SHA1_PATH = path.join(BUILDTOOLS_WIN_DIR, 'clang-format.exe.sha1');

console.log('Manually downloading clang-format.exe...');

// Ensure the directory exists
if (!fs.existsSync(BUILDTOOLS_WIN_DIR)) {
  fs.mkdirSync(BUILDTOOLS_WIN_DIR, { recursive: true });
  console.log(`Created directory: ${BUILDTOOLS_WIN_DIR}`);
}

// Get SHA1 from file if it exists, otherwise use hardcoded value
let sha1 = 'd4afd4eba27022f5f6d518133aebde57281677c9';
if (fs.existsSync(CLANG_FORMAT_SHA1_PATH)) {
  sha1 = fs.readFileSync(CLANG_FORMAT_SHA1_PATH, 'utf8').trim();
  console.log(`Using SHA1 from file: ${sha1}`);
}

// Download the file
const file = fs.createWriteStream(CLANG_FORMAT_PATH);
const request = https.get(`https://storage.googleapis.com/chromium-clang-format/${sha1}`, (response) => {
  if (response.statusCode !== 200) {
    fs.unlinkSync(CLANG_FORMAT_PATH);
    console.error(`Failed to download clang-format.exe: HTTP ${response.statusCode}`);
    process.exit(1);
  }
  
  response.pipe(file);
  
  file.on('finish', () => {
    file.close();
    console.log(`Successfully downloaded clang-format.exe to ${CLANG_FORMAT_PATH}`);
    
    // Make the file executable
    try {
      fs.chmodSync(CLANG_FORMAT_PATH, 0o755);
      console.log('Made clang-format.exe executable');
    } catch (error) {
      console.warn('Could not make clang-format.exe executable:', error.message);
    }
  });
});

request.on('error', (err) => {
  fs.unlinkSync(CLANG_FORMAT_PATH);
  console.error('Error downloading clang-format.exe:', err.message);
  process.exit(1);
});
