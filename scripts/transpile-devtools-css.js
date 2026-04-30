#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function resolvePnpmPackage(packageName) {
  const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpmDir)) {
    throw new Error(`pnpm store not found: ${pnpmDir}`);
  }

  const entries = fs.readdirSync(pnpmDir);
  for (const entry of entries) {
    const candidate = path.join(pnpmDir, entry, 'node_modules', packageName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to resolve ${packageName} from ${pnpmDir}`);
}

const postcss = require(resolvePnpmPackage('postcss'));
const postcssNestingModule = require(resolvePnpmPackage('postcss-nesting'));
const postcssNesting = postcssNestingModule.default || postcssNestingModule;

function walkFiles(dirPath, collected = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const nextPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(nextPath, collected);
      continue;
    }
    if (/\.css(\.js)?$/.test(entry.name) || /\.js$/.test(entry.name)) {
      collected.push(nextPath);
    }
  }
  return collected;
}

async function lowerCssNesting(cssSource, fromPath) {
  const placeholders = [];
  const protectedSource = cssSource.replace(/\$\{[^}]+\}/g, expression => {
    const token = `__LDT_CSS_EXPR_${placeholders.length}__`;
    placeholders.push({ token, expression });
    return token;
  });

  const result = await postcss([postcssNesting()]).process(protectedSource, { from: fromPath });
  let nextCss = result.css;
  for (const { token, expression } of placeholders) {
    nextCss = nextCss.replaceAll(token, expression);
  }
  return nextCss;
}

async function processCssFile(filePath) {
  const current = fs.readFileSync(filePath, 'utf8');
  const next = await lowerCssNesting(current, filePath);
  if (next === current) {
    return false;
  }
  fs.writeFileSync(filePath, next);
  return true;
}

async function processCssModuleFile(filePath) {
  const current = fs.readFileSync(filePath, 'utf8');
  const match = current.match(/^([\s\S]*?export default `)([\s\S]*)(`;\s*)$/);
  if (!match) {
    console.warn(`Skipping unsupported CSS module format: ${filePath}`);
    return false;
  }

  const [, prefix, cssSource, suffix] = match;
  const nextCss = await lowerCssNesting(cssSource, filePath);
  if (nextCss === cssSource) {
    return false;
  }

  fs.writeFileSync(filePath, `${prefix}${nextCss}${suffix}`);
  return true;
}

async function processJsBundleFile(filePath) {
  const current = fs.readFileSync(filePath, 'utf8');
  if (!current.includes('_css_default = `')) {
    return false;
  }

  const regex = /((?:var|const|let)\s+[A-Za-z0-9_$]+_css_default\s*=\s*`)([\s\S]*?)(`;\s*)/g;
  const matches = [...current.matchAll(regex)];
  if (!matches.length) {
    return false;
  }

  let changed = false;
  let lastIndex = 0;
  const nextParts = [];

  for (const match of matches) {
    const [fullMatch, prefix, cssSource, suffix] = match;
    const start = match.index;
    const end = start + fullMatch.length;
    const nextCss = await lowerCssNesting(cssSource, filePath);
    if (nextCss !== cssSource) {
      changed = true;
    }
    nextParts.push(current.slice(lastIndex, start), prefix, nextCss, suffix);
    lastIndex = end;
  }

  if (!changed) {
    return false;
  }

  nextParts.push(current.slice(lastIndex));
  fs.writeFileSync(filePath, nextParts.join(''));
  return true;
}

async function processDirectory(targetDir) {
  const files = walkFiles(targetDir);
  let changed = 0;

  for (const filePath of files) {
    let didChange = false;
    if (filePath.endsWith('.css.js')) {
      didChange = await processCssModuleFile(filePath);
    } else if (filePath.endsWith('.css')) {
      didChange = await processCssFile(filePath);
    } else if (filePath.endsWith('.js')) {
      didChange = await processJsBundleFile(filePath);
    }
    if (didChange) {
      changed += 1;
    }
  }

  return { changed, total: files.length };
}

async function main() {
  const targetDir = process.argv[2];
  if (!targetDir) {
    throw new Error('Usage: node scripts/transpile-devtools-css.js <front_end_dir>');
  }

  const resolvedDir = path.resolve(targetDir);
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Target directory not found: ${resolvedDir}`);
  }

  const { changed, total } = await processDirectory(resolvedDir);
  console.log(`Transpiled CSS nesting in ${changed}/${total} files under ${resolvedDir}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  lowerCssNesting,
  processDirectory
};
