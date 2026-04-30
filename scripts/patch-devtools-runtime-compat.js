#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const [, , frontEndDirArg] = process.argv;

if (!frontEndDirArg) {
  console.error('Usage: node scripts/patch-devtools-runtime-compat.js <front_end_dir>');
  process.exit(1);
}

const frontEndDir = path.resolve(frontEndDirArg);
const maskLine =
  `  mask: var(--icon-url, url("data:image/svg+xml,%3Csvg width='1' height='1' fill='%23000' xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E ")) center / contain no-repeat;`;
const webkitMaskLine =
  `  -webkit-mask: var(--icon-url, url("data:image/svg+xml,%3Csvg width='1' height='1' fill='%23000' xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E ")) center / contain no-repeat;`;
const treeOutlineFallbacks = [
  {
    standard: `  mask-position: left center;`,
    webkit: `  -webkit-mask-position: left center;`,
  },
  {
    standard: `  mask-image: var(--image-file-arrow-collapse);`,
    webkit: `  -webkit-mask-image: var(--image-file-arrow-collapse);`,
  },
  {
    standard: `  mask-image: var(--image-file-arrow-drop-down);`,
    webkit: `  -webkit-mask-image: var(--image-file-arrow-drop-down);`,
  },
  {
    standard: `  mask-size: 0;`,
    webkit: `  -webkit-mask-size: 0;`,
  },
];

function walkFiles(dirPath, collected = []) {
  for (const entry of fs.readdirSync(dirPath, {withFileTypes: true})) {
    const nextPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(nextPath, collected);
      continue;
    }
    if (/\.(?:js|css)$/.test(entry.name)) {
      collected.push(nextPath);
    }
  }
  return collected;
}

function patchIconStyles(filePath) {
  const current = fs.readFileSync(filePath, 'utf8');
  if (current.includes(webkitMaskLine)) {
    return false;
  }
  if (!current.includes(maskLine)) {
    return false;
  }

  const next = current.replace(maskLine, `${webkitMaskLine}\n${maskLine}`);
  fs.writeFileSync(filePath, next);
  return true;
}

function patchTreeOutlineStyles(filePath) {
  const current = fs.readFileSync(filePath, 'utf8');
  let next = current;

  for (const {standard, webkit} of treeOutlineFallbacks) {
    if (!next.includes(standard) || next.includes(webkit)) {
      continue;
    }
    next = next.replace(standard, `${webkit}\n${standard}`);
  }

  if (next === current) {
    return false;
  }

  fs.writeFileSync(filePath, next);
  return true;
}

let patchedIconStyles = false;
let patchedTreeOutlineStyles = false;
for (const filePath of walkFiles(frontEndDir)) {
  patchedIconStyles = patchIconStyles(filePath) || patchedIconStyles;
  patchedTreeOutlineStyles = patchTreeOutlineStyles(filePath) || patchedTreeOutlineStyles;
}

if (patchedIconStyles) {
  console.log('Patched ui/kit/icons icon styles with -webkit-mask fallback.');
} else if (!patchedTreeOutlineStyles) {
  console.log('ui/kit/icons icon styles already compatible.');
}

if (patchedTreeOutlineStyles) {
  console.log('Patched tree outline arrow styles with -webkit-mask fallbacks.');
}
