const fs = require('fs');
const path = require('path');

// Function to detect environment
const detectEnvironment = () => {
  const platform = process.platform;
  if (platform === 'win32') {
    if (process.env.MSYSTEM || process.env.CYGWIN) {
      return 'mingw';
    }
    return 'windows';
  }
  return 'unix';
};

const envType = detectEnvironment();
console.log(`Detected environment: ${envType}`);

// Find the latest file
const findLatestFile = (dir, pattern) => {
  console.log(`Finding latest file in ${dir} matching pattern: ${pattern}`);

  const files = fs.readdirSync(dir).filter(file => file.match(pattern));
  if (files.length === 0) {
    console.error(`No matching files found in directory ${dir}`);
    return null;
  }
  return files.sort().pop();
};

// Delete files matching pattern
const deleteMatchingFiles = (dir, pattern) => {
  console.log(`Deleting files in ${dir} matching pattern: ${pattern}`);

  const files = fs.readdirSync(dir).filter(file => file.match(pattern));
  files.forEach(file => fs.unlinkSync(path.join(dir, file)));
};

// Define paths
const aPath = 'packages/devtools-frontend-lynx/output';
const bPath = 'packages/lynx-devtool-cli/resources';

// Check if the directory exists first
if (!fs.existsSync(aPath)) {
  console.error(`ERROR: Directory ${aPath} does not exist!`);
  process.exit(1);
}

// List files in the directory to debug
console.log('Files in output directory:');
const files = fs.readdirSync(aPath);
files.forEach(file => console.log(file));

// Find the latest file
const latestFile = findLatestFile(aPath, 'devtool.frontend.lynx_1.0.*.tar.gz');

if (!latestFile) {
  console.error('Error: devtool.frontend.lynx not found.');
  console.error(`Current directory: ${process.cwd()}`);
  console.error(`Looking for files in: ${aPath}`);
  process.exit(1);
}

console.log(`The latest devtool.frontend.lynx dist: ${latestFile}`);

// Make sure the target directory exists
fs.mkdirSync(bPath, { recursive: true });
console.log('Deleting old dist...');

// Delete old files
deleteMatchingFiles(bPath, 'devtool.frontend.lynx_1.0.*.tar.gz');

console.log('Copying the latest dist...');
fs.copyFileSync(path.join(aPath, latestFile), path.join(bPath, latestFile));
console.log('Sync devtools output successfully!');
