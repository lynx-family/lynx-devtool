// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { writeInstanceRecord, type InstanceRecord } from '../instanceRegistry';
import { clearSimulatorLogs, writeInstanceLog, writeOperationLog } from '../logs';
import {
  getInstanceLogPath,
  getInstanceLogsDirectory,
  getLogsDirectory,
  getOperationsLogDirectory,
} from '../paths';

let tempHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-simulator-logs-'));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
});

afterEach(() => {
  restoreHome();
  fs.rmSync(tempHome, { recursive: true, force: true });
});

describe('simulator logs', () => {
  test('ignores instance log writes without an instance id', () => {
    writeInstanceLog(undefined, { event: 'missing-instance' });

    expect(fs.existsSync(getInstanceLogsDirectory())).toBe(false);
  });

  test('writes operation and instance logs as json lines', () => {
    writeOperationLog({ command: 'help', result: { ok: true } });
    writeInstanceLog('sim_active', { event: 'window-opened' });

    const operationLogs = fs.readdirSync(getOperationsLogDirectory());
    expect(operationLogs).toHaveLength(1);
    expect(readJSONLines(path.join(getOperationsLogDirectory(), operationLogs[0]))).toMatchObject([
      {
        command: 'help',
        result: { ok: true },
      },
    ]);
    expect(readJSONLines(getInstanceLogPath('sim_active'))).toMatchObject([
      {
        event: 'window-opened',
      },
    ]);
  });

  test('clears operation logs and inactive instance logs', () => {
    writeInstanceRecord(createRecord('sim_active', process.pid));
    writeInstanceRecord(createRecord('sim_inactive', 999999999));
    writeOperationLog({ command: 'help' });
    writeInstanceLog('sim_active', { event: 'active' });
    writeInstanceLog('sim_inactive', { event: 'inactive' });
    fs.writeFileSync(path.join(getLogsDirectory(), '.hidden'), 'temporary');

    expect(clearSimulatorLogs()).toEqual({
      ok: true,
      deletedOperationLogs: 1,
      deletedInstanceLogs: 1,
      keptActiveInstanceLogs: 1,
    });
    expect(fs.existsSync(getOperationsLogDirectory())).toBe(false);
    expect(fs.existsSync(getInstanceLogPath('sim_active'))).toBe(true);
    expect(fs.existsSync(getInstanceLogPath('sim_inactive'))).toBe(false);
    expect(fs.existsSync(path.join(getLogsDirectory(), '.hidden'))).toBe(false);
  });

  test('reports no-op when there are no logs to clear', () => {
    expect(clearSimulatorLogs()).toEqual({
      ok: true,
      deleted: false,
      message: 'No logs to clear.',
      keptActiveInstanceLogs: 0,
    });
  });
});

function createRecord(instanceId: string, pid: number): InstanceRecord {
  return {
    instanceId,
    pid,
    ipcEndpoint: path.join(tempHome, `${instanceId}.sock`),
    createdAt: 1,
    updatedAt: 2,
  };
}

function readJSONLines(filePath: string): Array<Record<string, unknown>> {
  return fs
    .readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function restoreHome(): void {
  restoreEnvironmentValue('HOME', originalHome);
  restoreEnvironmentValue('USERPROFILE', originalUserProfile);
}

function restoreEnvironmentValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
