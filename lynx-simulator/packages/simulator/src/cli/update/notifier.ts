import { styleText } from 'node:util';

import { readUpdateNoticeState, writeUpdateNoticeState } from './state';
import { simulatorDistribution } from '../../shared/distribution';

const UPDATE_NOTIFICATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_COMMAND = simulatorDistribution.updateCommand;

export interface UpdateNotifierOptions {
  stateDirectory: string;
  currentVersion: string;
  latestVersion: string;
  now: number;
  writeStderr?: (message: string) => void;
}

export function notifyUpdateAvailable(options: UpdateNotifierOptions): void {
  // Registry prereleases never prompt users on a stable installed version.
  if (!isVersionNewer(options.latestVersion, options.currentVersion)) {
    return;
  }

  const state = readUpdateNoticeState(options.stateDirectory);
  if (
    state?.version === options.latestVersion &&
    options.now - state.lastNotifiedAtMs < UPDATE_NOTIFICATION_INTERVAL_MS
  ) {
    // Repeat a notice for the same available version only after the cooldown.
    return;
  }

  try {
    (options.writeStderr ?? ((message) => process.stderr.write(message)))(
      `\nA new ${formatProductName()} version is available: ${options.currentVersion} → ${formatLatestVersion(options.latestVersion)}\n` +
        `Update with: ${formatUpdateCommand()}\n\n`
    );
    writeUpdateNoticeState(
      {
        lastNotifiedAtMs: options.now,
        version: options.latestVersion,
      },
      options.stateDirectory
    );
  } catch {
    // If stderr cannot accept the message, do not suppress a later retry. A
    // state-write failure after output can repeat the message, but never hides it.
  }
}

function formatProductName(): string {
  return styleText('bold', 'Lynx Simulator', { stream: process.stderr });
}

function formatLatestVersion(version: string): string {
  return styleText(['bold', 'blueBright'], version, { stream: process.stderr });
}

function formatUpdateCommand(): string {
  return styleText('underline', UPDATE_COMMAND, { stream: process.stderr });
}

function isVersionNewer(candidate: string, current: string): boolean {
  const candidateVersion = parseVersion(candidate);
  const currentVersion = parseVersion(current);
  if (!candidateVersion || !currentVersion) {
    return false;
  }
  if (candidateVersion.prerelease.length > 0) {
    return false;
  }
  return compareVersions(candidateVersion, currentVersion) > 0;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function parseVersion(version: string): ParsedVersion | undefined {
  const match =
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      version
    );
  if (!match) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split('.') ?? [],
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  for (const field of ['major', 'minor', 'patch'] as const) {
    if (left[field] !== right[field]) {
      return left[field] > right[field] ? 1 : -1;
    }
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) {
      return 0;
    }
    return left.prerelease.length === 0 ? 1 : -1;
  }

  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) {
      return leftPart === undefined ? -1 : 1;
    }
    if (leftPart === rightPart) {
      continue;
    }
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : undefined;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : undefined;
    if (leftNumber !== undefined && rightNumber !== undefined) {
      return leftNumber > rightNumber ? 1 : -1;
    }
    if (leftNumber !== undefined) {
      return -1;
    }
    if (rightNumber !== undefined) {
      return 1;
    }
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}
