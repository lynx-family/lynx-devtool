// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import path from 'node:path';

import {
  getInstanceLogPath,
  getInstanceLogsDirectory,
  getLogsDirectory,
  getOperationsLogDirectory,
} from './paths';
import { listActiveInstanceIds } from './instanceRegistry';
import { formatLocalDate, formatLocalDateTime } from './time';

export interface ClearLogsResult {
  ok: true;
  deleted?: false;
  message?: string;
  deletedOperationLogs?: number;
  deletedInstanceLogs?: number;
  keptActiveInstanceLogs: number;
}

export function writeInstanceLog(
  instanceId: string | undefined,
  entry: Record<string, unknown>
): void {
  if (!instanceId) {
    return;
  }

  const logEntry = {
    time: formatLocalDateTime(new Date()),
    ...entry,
  };

  try {
    appendJSONLine(getInstanceLogPath(instanceId), logEntry);
  } catch (error) {
    console.warn(`[lynx-simulator] Failed to write instance log: ${String(error)}`);
  }
}

export function writeOperationLog(entry: Record<string, unknown>): void {
  const date = new Date();
  const logPath = path.join(getOperationsLogDirectory(), `${formatLocalDate(date)}.jsonl`);
  const logEntry = {
    time: formatLocalDateTime(date),
    ...entry,
  };

  try {
    appendJSONLine(logPath, logEntry);
  } catch {
    // Do not print logging errors here to avoid interfering with CLI output.
  }
}

export function clearSimulatorLogs(): ClearLogsResult {
  const deletedOperationLogs = clearOperationLogs();
  const activeInstanceIds = listActiveInstanceIds();
  const instanceLogResult = clearInactiveInstanceLogs(activeInstanceIds);
  removeLogsDirectoryIfEmpty();

  if (deletedOperationLogs === 0 && instanceLogResult.deleted === 0) {
    return {
      ok: true,
      deleted: false,
      message: 'No logs to clear.',
      keptActiveInstanceLogs: instanceLogResult.kept,
    };
  }

  return {
    ok: true,
    deletedOperationLogs,
    deletedInstanceLogs: instanceLogResult.deleted,
    keptActiveInstanceLogs: instanceLogResult.kept,
  };
}

function clearOperationLogs(): number {
  return removeDirectoryContents(getOperationsLogDirectory());
}

function clearInactiveInstanceLogs(activeInstanceIds: Set<string>): {
  deleted: number;
  kept: number;
} {
  const instanceLogsDirectory = getInstanceLogsDirectory();
  if (!fs.existsSync(instanceLogsDirectory)) {
    return { deleted: 0, kept: 0 };
  }

  let deleted = 0;
  let kept = 0;
  for (const name of fs.readdirSync(instanceLogsDirectory)) {
    const logPath = path.join(instanceLogsDirectory, name);
    const isInstanceLog = name.endsWith('.jsonl');
    const instanceId = isInstanceLog ? name.slice(0, -'.jsonl'.length) : undefined;
    if (instanceId && activeInstanceIds.has(instanceId)) {
      kept += 1;
      continue;
    }

    // logs/instances should only contain <instanceId>.jsonl files. Remove entries
    // that do not match this format.
    fs.rmSync(logPath, { force: true, recursive: true });
    deleted += 1;
  }

  removeDirectoryIfEmpty(instanceLogsDirectory);
  return { deleted, kept };
}

function removeDirectoryContents(directory: string): number {
  if (!fs.existsSync(directory)) {
    return 0;
  }

  let deleted = 0;
  for (const name of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, name), { force: true, recursive: true });
    deleted += 1;
  }

  removeDirectoryIfEmpty(directory);
  return deleted;
}

function removeDirectoryIfEmpty(directory: string): void {
  if (!fs.existsSync(directory)) {
    return;
  }
  if (fs.readdirSync(directory).length === 0) {
    fs.rmdirSync(directory);
  }
}

function removeLogsDirectoryIfEmpty(): void {
  const logsDirectory = getLogsDirectory();
  if (!fs.existsSync(logsDirectory)) {
    return;
  }

  for (const name of fs.readdirSync(logsDirectory)) {
    if (name === 'operations' || name === 'instances') {
      continue;
    }
    fs.rmSync(path.join(logsDirectory, name), { force: true, recursive: true });
  }

  removeDirectoryIfEmpty(logsDirectory);
}

function appendJSONLine(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`);
}
