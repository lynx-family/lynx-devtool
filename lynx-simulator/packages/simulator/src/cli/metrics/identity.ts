import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { CliMetricIdentity } from './types';

type IdentitySource = CliMetricIdentity['source'];
type ReadGitConfig = (key: string) => string | undefined;

interface CliMetricIdentityOptions {
  readGitConfig?: ReadGitConfig;
}

interface RawIdentity {
  source: IdentitySource;
  value: string;
}

// Returns the stable UV key for this machine/user. Corporate-only metrics keep
// the normalized raw id so UV is easy to compute downstream.
export function getCliMetricIdentity(
  metricsDirectory: string,
  options: CliMetricIdentityOptions = {}
): CliMetricIdentity {
  const raw = getRawIdentity(metricsDirectory, options.readGitConfig ?? readGitConfig);
  const normalizedValue = raw.value.trim().toLowerCase();

  return {
    uvId: normalizedValue,
    source: raw.source,
  };
}

function getRawIdentity(metricsDirectory: string, readConfig: ReadGitConfig): RawIdentity {
  // Use one corporate user-level source first, then one local machine/install
  // fallback. Avoiding git name and OS username keeps UV grouping predictable.
  const gitEmail = readConfig('user.email');
  if (gitEmail) {
    return { source: 'git-email', value: gitEmail };
  }

  return { source: 'install-id', value: readOrCreateInstallId(metricsDirectory) };
}

function readGitConfig(key: string): string | undefined {
  try {
    const result = spawnSync('git', ['config', '--get', key], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 500,
    });
    if (result.status !== 0) {
      return undefined;
    }
    const value = result.stdout.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function readOrCreateInstallId(metricsDirectory: string): string {
  const installIdPath = path.join(metricsDirectory, 'install-id');
  try {
    const existing = fs.readFileSync(installIdPath, 'utf8').trim();
    if (existing) {
      return existing;
    }
  } catch {
    // Create a local install id below.
  }

  const installId = randomUUID();
  fs.mkdirSync(path.dirname(installIdPath), { recursive: true });
  fs.writeFileSync(installIdPath, `${installId}\n`, { mode: 0o600 });
  return installId;
}
