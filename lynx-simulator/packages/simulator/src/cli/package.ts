import fs from 'node:fs';
import path from 'node:path';

import { simulatorDistribution } from '../shared/distribution';

const SIMULATOR_PACKAGE_NAME = simulatorDistribution.packageName;
const PAGE_ENV_GUIDE_PATH = path.join('resources', 'page-env', 'README.md');

let simulatorPackageRoot: string | undefined;

export function getSimulatorPackageRoot(): string {
  if (simulatorPackageRoot) {
    return simulatorPackageRoot;
  }
  if (!process.argv[1]) {
    throw new Error('Cannot find Lynx Simulator CLI entry.');
  }

  // process.argv[1] points to the CLI script that Node is running. It may be a
  // symlink such as /usr/local/bin/lynx-simulator, so resolve it first and then
  // walk upward to find this package's package.json.
  simulatorPackageRoot = findPackageRoot(fs.realpathSync(process.argv[1]), SIMULATOR_PACKAGE_NAME);
  return simulatorPackageRoot;
}

export function getPageEnvGuidePath(): string {
  return path.join(getSimulatorPackageRoot(), PAGE_ENV_GUIDE_PATH);
}

export function findPackageRoot(entry: string, packageName: string): string {
  // Walk upward from entry until the filesystem root, and return the first
  // directory whose package.json name matches packageName.
  let current = path.dirname(entry);
  while (current !== path.dirname(current)) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.name === packageName) {
        return current;
      }
    }
    current = path.dirname(current);
  }
  throw new Error(`Cannot find package root for ${packageName}`);
}
