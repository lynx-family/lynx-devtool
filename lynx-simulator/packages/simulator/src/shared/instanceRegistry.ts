// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';

import {
  getInstanceDirectory,
  getInstanceIpcEndpoint,
  getInstanceRecordPath,
  getInstancesDirectory,
  isValidInstanceId,
} from './paths';
import { isProcessRunning } from './process';

export interface InstanceRecord {
  instanceId: string;
  pid: number;
  ipcEndpoint: string;
  createdAt: number;
  updatedAt: number;
}

export function createInstanceId(): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `sim_${Date.now().toString(36)}_${suffix}`;
}

export function readInstanceRecord(instanceId: string): InstanceRecord | undefined {
  if (!isValidInstanceId(instanceId)) {
    return undefined;
  }
  const file = getInstanceRecordPath(instanceId);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  try {
    return parseInstanceRecord(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return undefined;
  }
}

function parseInstanceRecord(value: unknown): InstanceRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Partial<InstanceRecord>;
  if (
    typeof record.instanceId !== 'string' ||
    typeof record.pid !== 'number' ||
    typeof record.ipcEndpoint !== 'string' ||
    typeof record.createdAt !== 'number' ||
    typeof record.updatedAt !== 'number'
  ) {
    return undefined;
  }

  return {
    instanceId: record.instanceId,
    pid: record.pid,
    ipcEndpoint: record.ipcEndpoint,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function writeInstanceRecord(record: InstanceRecord): void {
  fs.mkdirSync(getInstanceDirectory(record.instanceId), { recursive: true });
  fs.writeFileSync(
    getInstanceRecordPath(record.instanceId),
    `${JSON.stringify(record, null, 2)}\n`
  );
}

export function removeInstanceDirectory(instanceId: string): void {
  fs.rmSync(getInstanceDirectory(instanceId), {
    force: true,
    recursive: true,
  });
}

export function prepareInstanceSocket(instanceId: string): void {
  fs.mkdirSync(getInstanceDirectory(instanceId), { recursive: true });

  if (process.platform === 'win32') {
    return;
  }

  fs.rmSync(getInstanceIpcEndpoint(instanceId), { force: true });
}

export function listInstanceIds(): string[] {
  const instancesDirectory = getInstancesDirectory();
  if (!fs.existsSync(instancesDirectory)) {
    return [];
  }

  return fs
    .readdirSync(instancesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isValidInstanceId(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export function listActiveInstanceIds(): Set<string> {
  const activeInstanceIds = new Set<string>();
  for (const name of listInstanceIds()) {
    const record = readInstanceRecord(name);
    if (record && isProcessRunning(record.pid)) {
      activeInstanceIds.add(name);
    }
  }

  return activeInstanceIds;
}
