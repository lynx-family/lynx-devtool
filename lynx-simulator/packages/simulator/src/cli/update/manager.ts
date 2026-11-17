import { spawn } from 'node:child_process';
import path from 'node:path';

import { getSimulatorPackageRoot } from '../package';
import {
  getUpdateStateDirectory,
  isUpdateRegistryStateStale,
  readUpdateRegistryState,
  UPDATE_REGISTRY_TTL_MS,
} from './state';
import { notifyUpdateAvailable } from './notifier';

const UPDATE_CHECK_DISABLED_ENV = 'LYNX_SIMULATOR_UPDATE_CHECK_DISABLED';

export interface UpdateManagerOptions {
  stateDirectory?: string;
  command?: string;
  currentVersion: string;
  env?: NodeJS.ProcessEnv;
  isTTY?: boolean;
  now?: () => number;
  spawnWorker?: () => void;
  writeStderr?: (message: string) => void;
}

/**
 * Coordinates the cached update notice and detached refresh worker. It performs
 * no network I/O and never waits for the worker.
 */
export function runUpdateManager(options: UpdateManagerOptions): void {
  const env = options.env ?? process.env;
  if (!isEligibleInvocation(options.command, options.isTTY ?? process.stderr.isTTY === true, env)) {
    return;
  }

  const stateDirectory = options.stateDirectory ?? getUpdateStateDirectory();
  const now = (options.now ?? Date.now)();
  const registryState = readUpdateRegistryState(stateDirectory);

  if (registryState?.latestVersion) {
    notifyUpdateAvailable({
      stateDirectory,
      currentVersion: options.currentVersion,
      latestVersion: registryState.latestVersion,
      now,
      writeStderr: options.writeStderr,
    });
  }

  if (isUpdateRegistryStateStale(registryState, now, UPDATE_REGISTRY_TTL_MS)) {
    try {
      (options.spawnWorker ?? spawnUpdateCheckWorker)();
    } catch {
      // Update checks are best effort and must never affect a CLI result.
    }
  }
}

function isEligibleInvocation(
  command: string | undefined,
  isTTY: boolean,
  env: NodeJS.ProcessEnv
): boolean {
  // Keep machine-readable, automated, and lightweight reference commands free
  // from update side effects and stderr notices.
  if (!isTTY || command === 'help' || command === 'version') {
    return false;
  }
  if (env[UPDATE_CHECK_DISABLED_ENV] !== undefined || env.NO_UPDATE_NOTIFIER !== undefined) {
    return false;
  }
  if (env.NODE_ENV === 'test' || isCI(env)) {
    return false;
  }
  return true;
}

function isCI(env: NodeJS.ProcessEnv): boolean {
  return (
    env.CI !== undefined ||
    env.CONTINUOUS_INTEGRATION !== undefined ||
    env.BUILD_NUMBER !== undefined ||
    env.RUN_ID !== undefined
  );
}

function spawnUpdateCheckWorker(): void {
  // The detached, unreferenced process survives this CLI's immediate exit and
  // refreshes state without adding network latency to the current command.
  const workerPath = path.join(getSimulatorPackageRoot(), 'dist', 'cli', 'update-check-worker.js');
  const child = spawn(process.execPath, [workerPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}
