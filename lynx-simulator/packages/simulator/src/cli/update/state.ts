// Persistent registry and notification state for the update feature.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { getSimulatorDataDirectory } from '../../shared/paths';

export const UPDATE_REGISTRY_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export interface UpdateRegistryState {
  lastCheckedAtMs: number;
  latestVersion?: string;
}

export interface UpdateNoticeState {
  lastNotifiedAtMs: number;
  version: string;
}

export function getUpdateStateDirectory(): string {
  return path.join(getSimulatorDataDirectory(), 'updates');
}

export function isUpdateRegistryStateStale(
  state: UpdateRegistryState | undefined,
  now: number,
  intervalMs: number
): boolean {
  // lastCheckedAtMs records attempts as well as successful responses, which
  // prevents an offline registry from causing a worker on every invocation.
  return !state || now - state.lastCheckedAtMs >= intervalMs;
}

export function readUpdateRegistryState(
  stateDirectory = getUpdateStateDirectory()
): UpdateRegistryState | undefined {
  try {
    const value: unknown = JSON.parse(
      fs.readFileSync(getUpdateRegistryStatePath(stateDirectory), 'utf8')
    );
    return hasUpdateRegistryStateShape(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function writeUpdateRegistryState(
  state: UpdateRegistryState,
  stateDirectory = getUpdateStateDirectory()
): Promise<void> {
  await writeStateFile(stateDirectory, 'registry.json', state);
}

export function readUpdateNoticeState(
  stateDirectory = getUpdateStateDirectory()
): UpdateNoticeState | undefined {
  try {
    const value: unknown = JSON.parse(
      fs.readFileSync(getUpdateNoticeStatePath(stateDirectory), 'utf8')
    );
    return hasUpdateNoticeStateShape(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeUpdateNoticeState(
  state: UpdateNoticeState,
  stateDirectory = getUpdateStateDirectory()
): void {
  fs.mkdirSync(stateDirectory, { recursive: true });
  const temporaryPath = path.join(stateDirectory, `notice.${process.pid}.tmp`);
  fs.writeFileSync(temporaryPath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, getUpdateNoticeStatePath(stateDirectory));
}

function getUpdateRegistryStatePath(stateDirectory: string): string {
  return path.join(stateDirectory, 'registry.json');
}

function getUpdateNoticeStatePath(stateDirectory: string): string {
  return path.join(stateDirectory, 'notice.json');
}

async function writeStateFile(stateDirectory: string, name: string, value: unknown): Promise<void> {
  await fsp.mkdir(stateDirectory, { recursive: true });
  // Publish a complete replacement instead of exposing a partially written
  // JSON file to a concurrent CLI process.
  const temporaryPath = path.join(stateDirectory, `${name}.${process.pid}.tmp`);
  await fsp.writeFile(temporaryPath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  await fsp.rename(temporaryPath, path.join(stateDirectory, name));
}

function hasUpdateRegistryStateShape(value: unknown): value is UpdateRegistryState {
  // This validates only persisted JSON shape; freshness is checked separately.
  if (!isObjectRecord(value) || !Number.isFinite(value.lastCheckedAtMs)) {
    return false;
  }
  return value.latestVersion === undefined || typeof value.latestVersion === 'string';
}

function hasUpdateNoticeStateShape(value: unknown): value is UpdateNoticeState {
  // This validates only persisted JSON shape; notification cadence is separate.
  return (
    isObjectRecord(value) &&
    Number.isFinite(value.lastNotifiedAtMs) &&
    typeof value.version === 'string'
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
