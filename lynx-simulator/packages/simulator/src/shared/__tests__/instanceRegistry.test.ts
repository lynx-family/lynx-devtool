// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  listActiveInstanceIds,
  listInstanceIds,
  readInstanceRecord,
  removeInstanceDirectory,
  writeInstanceRecord,
  type InstanceRecord,
} from '../instanceRegistry';
import { getInstanceRecordPath, getInstancesDirectory } from '../paths';

let tempHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-simulator-instance-'));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
});

afterEach(() => {
  restoreHome();
  fs.rmSync(tempHome, { recursive: true, force: true });
});

describe('instance registry', () => {
  test('writes, reads, and removes instance records', () => {
    const record = createRecord('sim_test');

    writeInstanceRecord(record);
    expect(readInstanceRecord(record.instanceId)).toEqual(record);

    removeInstanceDirectory(record.instanceId);
    expect(readInstanceRecord(record.instanceId)).toBeUndefined();
  });

  test('ignores malformed instance records', () => {
    writeMalformedRecord('sim_bad');

    expect(readInstanceRecord('sim_bad')).toBeUndefined();
  });

  test('rejects instance IDs that could escape the registry directory', () => {
    expect(readInstanceRecord('../..')).toBeUndefined();
    expect(() => removeInstanceDirectory('../..')).toThrow('Invalid simulator instance ID');
    expect(fs.existsSync(tempHome)).toBe(true);
  });

  test('lists only records whose process is still running', () => {
    // Use this test process as the live process so isProcessRunning(pid)
    // returns true without starting another app process.
    writeInstanceRecord(createRecord('sim_active', process.pid));
    writeInstanceRecord(createRecord('sim_dead', 99999999));
    writeMalformedRecord('sim_malformed');
    fs.writeFileSync(path.join(getInstancesDirectory(), 'unexpected-file'), '');
    fs.mkdirSync(path.join(getInstancesDirectory(), 'unexpected.directory'));

    expect(listInstanceIds()).toEqual(['sim_active', 'sim_dead', 'sim_malformed']);
    expect(listActiveInstanceIds()).toEqual(new Set(['sim_active']));
  });
});

function createRecord(instanceId: string, pid = process.pid): InstanceRecord {
  return {
    instanceId,
    pid,
    ipcEndpoint: path.join(tempHome, `${instanceId}.sock`),
    createdAt: 1,
    updatedAt: 2,
  };
}

function writeMalformedRecord(instanceId: string): void {
  fs.mkdirSync(path.dirname(getInstanceRecordPath(instanceId)), { recursive: true });
  // Missing required fields on purpose: registry readers should ignore corrupt
  // or incomplete record files instead of treating them as active instances.
  fs.writeFileSync(getInstanceRecordPath(instanceId), `${JSON.stringify({ instanceId })}\n`);
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
