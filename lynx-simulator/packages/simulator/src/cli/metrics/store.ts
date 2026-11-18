import { randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { getSimulatorDataDirectory } from '../../shared/paths';
import { getCliMetricHostInfo } from './host';
import { getCliMetricIdentity } from './identity';
import {
  CLI_METRICS_SCHEMA_VERSION,
  METRICS_DIR_ENV,
  type CliMetricEvent,
  type SessionMetaEvent,
} from './types';

const CURRENT_METRICS_FILE = 'current.jsonl';
const CURRENT_METRICS_TEMP_SUFFIX = '.tmp';
const IN_FLIGHT_METRICS_DIRECTORY = 'in-flight';
const PENDING_METRICS_DIRECTORY = 'pending';
const PENDING_METRICS_FILE_EXTENSION = '.jsonl';
const UPLOAD_STATE_FILE = 'upload-state.json';
const SESSION_META_ENSURE_ATTEMPTS = 3;
// In-flight filenames include the PID that claimed the batch. Recovery uses it
// to distinguish a crashed uploader from another CLI process that is still live.
const IN_FLIGHT_OWNER_PATTERN =
  /-(\d+)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;

export interface AppendCliMetricOptions {
  packageVersion: string;
  event: CliMetricEvent;
}

export interface MetricsUploadState {
  lastUploadAttemptAtMs?: number;
  lastUploadSuccessAtMs?: number;
}

type CurrentSessionMetaReadResult =
  | { status: 'missing' | 'empty' | 'unknown_content' }
  | { status: 'session_meta'; event: SessionMetaEvent };

// Appends one metrics event to the active local JSONL file. The session metadata
// event is created lazily so every upload batch is self-describing.
export async function appendCliMetric(options: AppendCliMetricOptions): Promise<void> {
  const metricsDirectory = getMetricsDirectory();
  await fsp.mkdir(metricsDirectory, { recursive: true });
  const metricsPath = getCurrentMetricsPath(metricsDirectory);

  while (true) {
    await ensureSessionMeta(metricsDirectory, options.packageVersion);
    try {
      await appendJSONLine(metricsPath, options.event);
      return;
    } catch (error) {
      if (!isErrnoException(error, 'ENOENT')) {
        throw error;
      }
      // A concurrent upload may rotate current.jsonl between metadata creation
      // and append. Retry so a new current file is created with session_meta.
    }
  }
}

export function getMetricsDirectory(): string {
  const override = process.env[METRICS_DIR_ENV]?.trim();
  if (override) {
    return override;
  }
  return path.join(getSimulatorDataDirectory(), 'metrics');
}

export function getCurrentMetricsPath(metricsDirectory = getMetricsDirectory()): string {
  return path.join(metricsDirectory, CURRENT_METRICS_FILE);
}

export function getPendingMetricsDirectory(metricsDirectory = getMetricsDirectory()): string {
  return path.join(metricsDirectory, PENDING_METRICS_DIRECTORY);
}

export function getInFlightMetricsDirectory(metricsDirectory = getMetricsDirectory()): string {
  return path.join(metricsDirectory, IN_FLIGHT_METRICS_DIRECTORY);
}

export function getMetricsUploadStatePath(metricsDirectory = getMetricsDirectory()): string {
  return path.join(metricsDirectory, UPLOAD_STATE_FILE);
}

export async function readMetricsUploadState(
  metricsDirectory = getMetricsDirectory()
): Promise<MetricsUploadState> {
  try {
    return normalizeMetricsUploadState(
      JSON.parse(await fsp.readFile(getMetricsUploadStatePath(metricsDirectory), 'utf8'))
    );
  } catch {
    return {};
  }
}

export async function writeMetricsUploadState(
  metricsDirectory: string,
  state: MetricsUploadState
): Promise<void> {
  // State writes are atomic so concurrent CLI processes never leave a partially
  // written JSON file that would disable the upload frequency gates.
  await fsp.mkdir(metricsDirectory, { recursive: true });
  const statePath = getMetricsUploadStatePath(metricsDirectory);
  const tempPath = path.join(
    metricsDirectory,
    `${UPLOAD_STATE_FILE}.${process.pid}.${randomUUID()}${CURRENT_METRICS_TEMP_SUFFIX}`
  );

  try {
    await fsp.writeFile(tempPath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    await fsp.rename(tempPath, statePath);
  } finally {
    await fsp.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

export async function rotateCurrentMetricsFile(
  metricsDirectory = getMetricsDirectory()
): Promise<string | undefined> {
  // Only upload batches that contain session_meta plus at least one real event.
  // Metadata-only current files are dropped by resetCurrentMetricsFile().
  const metricsPath = getCurrentMetricsPath(metricsDirectory);
  if (!(await fileHasUploadableMetrics(metricsPath))) {
    return undefined;
  }

  const pendingDirectory = getPendingMetricsDirectory(metricsDirectory);
  await fsp.mkdir(pendingDirectory, { recursive: true });

  const pendingPath = path.join(
    pendingDirectory,
    `${Date.now()}-${process.pid}-${randomUUID()}${PENDING_METRICS_FILE_EXTENSION}`
  );

  try {
    await fsp.rename(metricsPath, pendingPath);
    return pendingPath;
  } catch (error) {
    if (isErrnoException(error, 'ENOENT')) {
      return undefined;
    }
    throw error;
  }
}

export async function listPendingMetricsFiles(
  metricsDirectory = getMetricsDirectory()
): Promise<string[]> {
  const pendingDirectory = getPendingMetricsDirectory(metricsDirectory);
  let entries: string[];
  try {
    entries = await fsp.readdir(pendingDirectory);
  } catch (error) {
    if (isErrnoException(error, 'ENOENT')) {
      return [];
    }
    throw error;
  }

  return entries
    .filter((entry) => entry.endsWith(PENDING_METRICS_FILE_EXTENSION))
    .sort()
    .map((entry) => path.join(pendingDirectory, entry));
}

export async function listInFlightMetricsFiles(
  metricsDirectory = getMetricsDirectory()
): Promise<string[]> {
  const inFlightDirectory = getInFlightMetricsDirectory(metricsDirectory);
  let entries: string[];
  try {
    entries = await fsp.readdir(inFlightDirectory);
  } catch (error) {
    if (isErrnoException(error, 'ENOENT')) {
      return [];
    }
    throw error;
  }

  return entries
    .filter((entry) => entry.endsWith(PENDING_METRICS_FILE_EXTENSION))
    .sort()
    .map((entry) => path.join(inFlightDirectory, entry));
}

export async function countCurrentMetricRecords(
  metricsDirectory = getMetricsDirectory()
): Promise<number> {
  let contents: string;
  try {
    contents = await fsp.readFile(getCurrentMetricsPath(metricsDirectory), 'utf8');
  } catch (error) {
    if (isErrnoException(error, 'ENOENT')) {
      return 0;
    }
    throw error;
  }

  // current.jsonl starts with session_meta. Every later non-empty line is a
  // recorded CLI metric event for the current upload batch.
  return Math.max(0, contents.trimEnd().split('\n').filter(Boolean).length - 1);
}

export async function deleteMetricsFile(filePath: string): Promise<void> {
  await fsp.rm(filePath, { force: true });
}

export async function claimPendingMetricsFile(
  filePath: string,
  metricsDirectory = getMetricsDirectory()
): Promise<string | undefined> {
  // Rename is the ownership boundary: exactly one concurrent flush can move a
  // pending file to in-flight and therefore become responsible for uploading it.
  const inFlightDirectory = getInFlightMetricsDirectory(metricsDirectory);
  await fsp.mkdir(inFlightDirectory, { recursive: true });

  const inFlightPath = path.join(
    inFlightDirectory,
    `${path.basename(
      filePath,
      PENDING_METRICS_FILE_EXTENSION
    )}-${process.pid}-${randomUUID()}${PENDING_METRICS_FILE_EXTENSION}`
  );

  try {
    await fsp.rename(filePath, inFlightPath);
    return inFlightPath;
  } catch (error) {
    if (isErrnoException(error, 'ENOENT')) {
      return undefined;
    }
    throw error;
  }
}

export async function restorePendingMetricsFile(
  filePath: string,
  metricsDirectory = getMetricsDirectory()
): Promise<string | undefined> {
  // Failed uploads move back to a fresh pending name instead of the original name.
  // That avoids colliding with another retry file and keeps the restore atomic.
  const pendingDirectory = getPendingMetricsDirectory(metricsDirectory);
  await fsp.mkdir(pendingDirectory, { recursive: true });

  const pendingPath = path.join(
    pendingDirectory,
    `${Date.now()}-${process.pid}-${randomUUID()}${PENDING_METRICS_FILE_EXTENSION}`
  );

  try {
    await fsp.rename(filePath, pendingPath);
    return pendingPath;
  } catch (error) {
    if (!isErrnoException(error, 'ENOENT')) {
      throw error;
    }
    return undefined;
  }
}

export async function recoverAbandonedInFlightMetricsFiles(
  metricsDirectory = getMetricsDirectory()
): Promise<void> {
  // A process can crash after claiming a batch but before deleting/restoring it.
  // Restore only files owned by dead PIDs so live concurrent uploads are untouched.
  for (const filePath of await listInFlightMetricsFiles(metricsDirectory)) {
    const ownerPid = getInFlightOwnerPid(filePath);
    if (!ownerPid || isProcessRunning(ownerPid)) {
      continue;
    }
    await restorePendingMetricsFile(filePath, metricsDirectory);
  }
}

async function ensureSessionMeta(metricsDirectory: string, packageVersion: string): Promise<void> {
  const metricsPath = getCurrentMetricsPath(metricsDirectory);
  // current.jsonl can be created, rotated, or deleted by another CLI process
  // between our read/reset/create steps. A small bounded retry lets those file
  // races converge while keeping metrics best-effort and non-blocking.
  for (let attempt = 0; attempt < SESSION_META_ENSURE_ATTEMPTS; attempt += 1) {
    const currentMeta = await readCurrentSessionMetaEvent(metricsPath);
    switch (currentMeta.status) {
      case 'session_meta':
        if (currentMeta.event.client.version === packageVersion) {
          return;
        }
        // current.jsonl starts with one session_meta line that applies to all
        // later rows. If the CLI version changed, close that old batch first so
        // new invocation rows get fresh metadata.
        await resetCurrentMetricsFile(metricsDirectory);
        continue;
      case 'unknown_content':
        return;
      case 'missing':
      case 'empty':
        // Multiple CLI processes can start with no current.jsonl. Write metadata
        // to a private temp file first, then atomically link it as current.jsonl;
        // only one process wins, and the others reuse that file on retry.
        await createInitialMetricsFile(
          metricsDirectory,
          metricsPath,
          createSessionMetaEvent(metricsDirectory, packageVersion)
        );
        continue;
    }
  }
}

function createSessionMetaEvent(
  metricsDirectory: string,
  packageVersion: string
): SessionMetaEvent {
  return {
    type: 'session_meta',
    schemaVersion: CLI_METRICS_SCHEMA_VERSION,
    fileCreatedAtMs: Date.now(),
    client: {
      name: 'lynx-simulator',
      version: packageVersion,
    },
    identity: getCliMetricIdentity(metricsDirectory),
    host: getCliMetricHostInfo(),
  };
}

async function resetCurrentMetricsFile(metricsDirectory: string): Promise<void> {
  const metricsPath = getCurrentMetricsPath(metricsDirectory);
  if (await fileHasUploadableMetrics(metricsPath)) {
    await rotateCurrentMetricsFile(metricsDirectory);
    return;
  }
  // Accepted race: a concurrent older-version CLI can append an invocation row
  // between this check and the delete, losing that row. Metrics are best-effort
  // and mixed-version concurrent runs are rare, so we keep the code simple.
  await deleteMetricsFile(metricsPath);
}

async function createInitialMetricsFile(
  metricsDirectory: string,
  metricsPath: string,
  event: SessionMetaEvent
): Promise<void> {
  const tempPath = path.join(
    metricsDirectory,
    `${CURRENT_METRICS_FILE}.${process.pid}.${randomUUID()}${CURRENT_METRICS_TEMP_SUFFIX}`
  );

  try {
    await fsp.writeFile(tempPath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
    await fsp.link(tempPath, metricsPath);
  } catch (error) {
    if (!isErrnoException(error, 'EEXIST')) {
      throw error;
    }
  } finally {
    await fsp.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function fileHasUploadableMetrics(filePath: string): Promise<boolean> {
  let contents: string;
  try {
    contents = await fsp.readFile(filePath, 'utf8');
  } catch (error) {
    if (isErrnoException(error, 'ENOENT')) {
      return false;
    }
    throw error;
  }

  return contents.trimEnd().split('\n').filter(Boolean).length > 1;
}

async function readCurrentSessionMetaEvent(
  filePath: string
): Promise<CurrentSessionMetaReadResult> {
  let contents: string;
  try {
    contents = await fsp.readFile(filePath, 'utf8');
  } catch (error) {
    if (isErrnoException(error, 'ENOENT')) {
      return { status: 'missing' };
    }
    throw error;
  }

  if (contents.length === 0) {
    return { status: 'empty' };
  }

  const firstLine = contents.split('\n').find(Boolean);
  if (!firstLine) {
    return { status: 'unknown_content' };
  }

  try {
    const event = JSON.parse(firstLine) as unknown;
    if (isSessionMetaEvent(event)) {
      return { status: 'session_meta', event };
    }
  } catch {
    return { status: 'unknown_content' };
  }
  return { status: 'unknown_content' };
}

async function appendJSONLine(filePath: string, event: CliMetricEvent): Promise<void> {
  const file = await fsp.open(filePath, fsConstants.O_WRONLY | fsConstants.O_APPEND);
  try {
    await file.writeFile(`${JSON.stringify(event)}\n`);
  } finally {
    await file.close();
  }
}

function isErrnoException(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}

function normalizeMetricsUploadState(value: unknown): MetricsUploadState {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    lastUploadAttemptAtMs: readTimestamp(record.lastUploadAttemptAtMs),
    lastUploadSuccessAtMs: readTimestamp(record.lastUploadSuccessAtMs),
  };
}

function readTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function isSessionMetaEvent(value: unknown): value is SessionMetaEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<SessionMetaEvent>;
  return (
    event.type === 'session_meta' &&
    event.client?.name === 'lynx-simulator' &&
    typeof event.client.version === 'string'
  );
}

function getInFlightOwnerPid(filePath: string): number | undefined {
  const match = path.basename(filePath).match(IN_FLIGHT_OWNER_PATTERN);
  if (!match) {
    return undefined;
  }

  const ownerPid = Number(match[1]);
  if (!Number.isInteger(ownerPid) || ownerPid <= 0) {
    return undefined;
  }
  return ownerPid;
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isErrnoException(error, 'EPERM');
  }
}
