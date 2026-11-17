// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  cleanupStaleInstances,
  getAllInstanceStatuses,
  quitAllInstances,
  sendInstanceCommand,
} from '../../../../cli/instance';
import {
  readInstanceRecord,
  writeInstanceRecord,
  type InstanceRecord,
} from '../../../../shared/instanceRegistry';
import type { InstanceRequest, InstanceResponse } from '../../../../shared/instanceProtocol';
import { getInstanceDirectory, getInstanceIpcEndpoint } from '../../../../shared/paths';
import { startInstanceIpcServer, type InstanceIpcServer } from '../ipc';

let tempHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;
let servers: InstanceIpcServer[] = [];

beforeEach(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-simulator-ipc-'));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  // Instance records, sockets, and logs are stored under os.homedir().
  // Point the home directory to a temp folder so tests never touch the real
  // ~/.lynx-simulator data.
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  servers = [];
});

afterEach(async () => {
  await Promise.all(servers.map((server) => server.close()));
  restoreHome();
  fs.rmSync(tempHome, { recursive: true, force: true });
});

describe('instance IPC', () => {
  test('returns not found when the instance record is missing', async () => {
    const instanceDirectory = getInstanceDirectory('sim_missing');
    fs.mkdirSync(instanceDirectory, { recursive: true });

    await expect(
      sendInstanceCommand('sim_missing', {
        command: 'status',
        instanceId: 'sim_missing',
        rawArgv: ['status', '--instance', 'sim_missing'],
      })
    ).resolves.toEqual({
      ok: false,
      code: 'INSTANCE_NOT_FOUND',
      message: 'Instance not found: sim_missing.',
      instanceId: 'sim_missing',
    });
    expect(fs.existsSync(instanceDirectory)).toBe(true);
  });

  test('removes records for stopped processes', async () => {
    writeInstanceRecord(createRecord('sim_dead', 99999999));

    await expect(
      sendInstanceCommand('sim_dead', {
        command: 'status',
        instanceId: 'sim_dead',
        rawArgv: ['status', '--instance', 'sim_dead'],
      })
    ).resolves.toMatchObject({
      ok: false,
      code: 'INSTANCE_NOT_FOUND',
      message: 'Instance sim_dead is no longer running.',
      instanceId: 'sim_dead',
    });
    expect(readInstanceRecord('sim_dead')).toBeUndefined();
  });

  test('removes records whose socket no longer responds', async () => {
    // Use this test process as the live process so the command reaches the
    // IPC ping branch. No socket server is started for this instance.
    writeInstanceRecord(createRecord('sim_unresponsive', process.pid));

    await expect(
      sendInstanceCommand('sim_unresponsive', {
        command: 'status',
        instanceId: 'sim_unresponsive',
        rawArgv: ['status', '--instance', 'sim_unresponsive'],
      })
    ).resolves.toMatchObject({
      ok: false,
      code: 'INSTANCE_NOT_FOUND',
      message: expect.stringContaining('Instance sim_unresponsive is not responding:'),
      instanceId: 'sim_unresponsive',
    });
    expect(readInstanceRecord('sim_unresponsive')).toBeUndefined();
  });

  test('routes commands through a real socket server', async () => {
    const requests: InstanceRequest[] = [];
    await startTestServer('sim_ipc', async (request) => {
      requests.push(request);
      return {
        ok: true,
        instanceId: 'sim_ipc',
        command: request.command,
      };
    });

    await expect(
      sendInstanceCommand('sim_ipc', {
        command: 'status',
        instanceId: 'sim_ipc',
        rawArgv: ['status', '--instance', 'sim_ipc'],
      })
    ).resolves.toEqual({
      ok: true,
      instanceId: 'sim_ipc',
      command: 'status',
    });
    expect(requests.map((request) => request.command)).toEqual(['ping', 'status']);
  });

  test('reports command response failures without removing a reachable instance', async () => {
    const instanceId = 'sim_invalid_response';
    const record = createRecord(instanceId, process.pid);
    writeInstanceRecord(record);

    const server = net.createServer((socket) => {
      socket.once('data', (chunk) => {
        const request = JSON.parse(chunk.toString('utf8')) as InstanceRequest;
        socket.end(
          request.command === 'ping'
            ? `${JSON.stringify({ ok: true, instanceId })}\n`
            : 'invalid response\n'
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(record.ipcEndpoint, resolve));
    servers.push({
      record,
      close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    });

    await expect(
      sendInstanceCommand(instanceId, {
        command: 'status',
        instanceId,
        rawArgv: ['status', '--instance', instanceId],
      })
    ).resolves.toMatchObject({
      ok: false,
      code: 'IPC_REQUEST_FAILED',
      message: expect.stringContaining(`Failed to run status on instance ${instanceId}:`),
      instanceId,
    });
    expect(readInstanceRecord(instanceId)).toBeDefined();
  });

  test('returns reachable instance status and reports stale records', async () => {
    await startTestServer('sim_active', async (request) => {
      if (request.command === 'ping') {
        return { ok: true, instanceId: 'sim_active' };
      }
      return {
        ok: true,
        pid: process.pid,
        windows: [{ id: 'win_active' }],
      };
    });
    writeInstanceRecord(createRecord('sim_stale', 99999999));

    await expect(getAllInstanceStatuses()).resolves.toEqual({
      ok: true,
      instances: [
        {
          instanceId: 'sim_active',
          pid: process.pid,
          windowCount: 1,
        },
      ],
      unavailableInstances: [
        {
          ok: false,
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instance sim_stale is no longer running.',
          instanceId: 'sim_stale',
        },
      ],
    });
    expect(readInstanceRecord('sim_stale')).toBeUndefined();
  });

  test('quits all reachable instances and reports failures', async () => {
    const commands: string[] = [];
    await startTestServer('sim_active', async (request) => {
      if (request.command === 'ping') {
        return { ok: true, instanceId: 'sim_active' };
      }
      commands.push(request.command);
      return { ok: true };
    });
    writeInstanceRecord(createRecord('sim_stale', 99999999));

    await expect(quitAllInstances()).resolves.toEqual({
      ok: false,
      quitInstances: ['sim_active'],
      failedInstances: [
        {
          ok: false,
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instance sim_stale is no longer running.',
          instanceId: 'sim_stale',
        },
      ],
    });
    // Verify the reachable instance received quit rather than only responding to ping.
    expect(commands).toEqual(['quit']);
    expect(readInstanceRecord('sim_stale')).toBeUndefined();
  });

  test('returns handler failures as IPC error responses', async () => {
    await startTestServer('sim_error', async (request) => {
      if (request.command === 'ping') {
        return { ok: true, instanceId: 'sim_error' };
      }
      throw new Error('handler failed');
    });

    await expect(
      sendInstanceCommand('sim_error', {
        command: 'status',
        instanceId: 'sim_error',
        rawArgv: ['status', '--instance', 'sim_error'],
      })
    ).resolves.toEqual({
      ok: false,
      code: 'IPC_REQUEST_FAILED',
      message: 'handler failed',
    });
  });

  test('rejects instance records that point to another server', async () => {
    await startTestServer('sim_mismatch', async (request) => {
      if (request.command === 'ping') {
        return { ok: true, instanceId: 'sim_other' };
      }
      return { ok: true, instanceId: 'sim_mismatch' };
    });

    await expect(
      sendInstanceCommand('sim_mismatch', {
        command: 'status',
        instanceId: 'sim_mismatch',
        rawArgv: ['status', '--instance', 'sim_mismatch'],
      })
    ).resolves.toMatchObject({
      ok: false,
      code: 'INSTANCE_MISMATCH',
      instanceId: 'sim_mismatch',
    });
  });

  test('cleans stale instance records', () => {
    writeInstanceRecord(createRecord('sim_dead_cleanup', 99999999));
    // The process is alive, but the socket endpoint is absent. On Unix-like
    // platforms this stale record can be detected by the missing socket file.
    writeInstanceRecord(createRecord('sim_missing_socket', process.pid));

    cleanupStaleInstances();

    expect(readInstanceRecord('sim_dead_cleanup')).toBeUndefined();
    if (process.platform !== 'win32') {
      expect(readInstanceRecord('sim_missing_socket')).toBeUndefined();
    }
  });
});

async function startTestServer(
  instanceId: string,
  handleRequest: (request: InstanceRequest) => Promise<InstanceResponse>
): Promise<InstanceIpcServer> {
  const server = await startInstanceIpcServer({ instanceId, handleRequest });
  servers.push(server);
  return server;
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

function createRecord(instanceId: string, pid: number): InstanceRecord {
  return {
    instanceId,
    pid,
    ipcEndpoint: getInstanceIpcEndpoint(instanceId),
    createdAt: 1,
    updatedAt: 2,
  };
}
