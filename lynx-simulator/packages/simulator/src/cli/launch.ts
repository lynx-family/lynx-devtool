import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { cleanupStaleInstances } from './instance';
import type { CliResult } from './output';
import { findPackageRoot, getSimulatorPackageRoot } from './package';
import { simulatorDistribution } from '../shared/distribution';

let lynxtronCli: string | undefined;

export async function launchNewInstanceAndWaitForResult(argv: string[]): Promise<CliResult> {
  // The app process writes its launch result here so this launcher can print it
  // and exit while the GUI process keeps running.
  const resultFile = path.join(os.tmpdir(), `lynx-simulator-${process.pid}-${Date.now()}.json`);
  cleanupStaleInstances();

  const appEntry = getAppEntry();
  const child = spawn(process.execPath, [getLynxtronCli(), appEntry, '--', ...argv], {
    // Start the GUI app as an independent process.
    detached: true,
    env: {
      ...process.env,
      // Tell the app where to write the first launch command result.
      LYNX_SIMULATOR_RESULT_FILE: resultFile,
    },
    // Do not print child process stdout/stderr in this CLI process.
    stdio: 'ignore',
    // Do not hide the GUI app window on Windows.
    windowsHide: false,
  });
  // Let this launcher exit after reading the result file instead of waiting for
  // the GUI process to close.
  child.unref();

  const result = await waitForJsonFile(resultFile, 15000);
  fs.rmSync(resultFile, { force: true });
  return result;
}

function getLynxtronCli(): string {
  if (lynxtronCli) {
    return lynxtronCli;
  }
  const appEntry = getAppEntry();
  if (!fs.existsSync(path.join(appEntry, 'package.json'))) {
    throw new Error(
      `Cannot find built Lynx Simulator app at ${appEntry}. ` +
        'Please reinstall the package or build the simulator before running this command.'
    );
  }
  // Resolve Lynxtron from the actual installed simulator package, so
  // dependency lookup does not depend on this module's own file location.
  const requireFromPackage = createRequire(path.join(getSimulatorPackageRoot(), 'package.json'));
  const { lynxtronPackage } = simulatorDistribution;
  const lynxtronEntry = requireFromPackage.resolve(lynxtronPackage);
  const lynxtronPackageRoot = findPackageRoot(lynxtronEntry, lynxtronPackage);
  lynxtronCli = path.join(lynxtronPackageRoot, getPackageBin(lynxtronPackageRoot, 'lynxtron'));
  return lynxtronCli;
}

function getAppEntry(): string {
  return path.join(getSimulatorPackageRoot(), 'dist', 'desktop');
}

function getPackageBin(packageRoot: string, binName: string): string {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (typeof packageJson.bin === 'string') {
    return packageJson.bin;
  }
  const binPath = packageJson.bin?.[binName];
  if (typeof binPath !== 'string') {
    throw new Error(`Cannot find ${binName} binary in ${packageJsonPath}`);
  }
  return binPath;
}

function waitForJsonFile(file: string, timeoutMs: number): Promise<CliResult> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (fs.existsSync(file)) {
        try {
          resolve(JSON.parse(fs.readFileSync(file, 'utf8')));
        } catch (error) {
          reject(error);
        }
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Timed out waiting for simulator instance result.'));
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}
