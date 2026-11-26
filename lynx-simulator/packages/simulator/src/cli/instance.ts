import fs from 'node:fs';
import net from 'node:net';

import {
  type InstanceRecord,
  listInstanceIds,
  readInstanceRecord,
  removeInstanceDirectory,
} from '../shared/instanceRegistry';
import type { InstanceRequest, InstanceResponse } from '../shared/instanceProtocol';
import { isProcessRunning } from '../shared/process';
import type { CliResult } from './output';

export async function sendInstanceCommand(
  instanceId: string,
  request: InstanceRequest
): Promise<CliResult> {
  const record = readInstanceRecord(instanceId);
  if (!record) {
    return instanceError('INSTANCE_NOT_FOUND', `Instance not found: ${instanceId}.`, instanceId);
  }

  if (!isProcessRunning(record.pid)) {
    removeInstanceDirectory(instanceId);
    return instanceError(
      'INSTANCE_NOT_FOUND',
      `Instance ${instanceId} is no longer running.`,
      instanceId
    );
  }

  let ping: InstanceResponse;
  try {
    ping = await requestInstance(record, { command: 'ping', instanceId });
  } catch (error) {
    removeInstanceDirectory(instanceId);
    return instanceError(
      'INSTANCE_NOT_FOUND',
      `Instance ${instanceId} is not responding: ${getErrorMessage(error)}`,
      instanceId
    );
  }

  if (ping.instanceId !== instanceId) {
    removeInstanceDirectory(instanceId);
    return instanceError(
      'INSTANCE_MISMATCH',
      `Instance registry for ${instanceId} points to another running instance.`,
      instanceId
    );
  }

  try {
    return await requestInstance(record, request);
  } catch (error) {
    return instanceError(
      'IPC_REQUEST_FAILED',
      `Failed to run ${request.command} on instance ${instanceId}: ${getErrorMessage(error)}`,
      instanceId
    );
  }
}

export async function getAllInstanceStatuses(): Promise<CliResult> {
  const results = await Promise.all(
    listInstanceIds().map(async (instanceId) => ({
      instanceId,
      result: await sendInstanceCommand(instanceId, {
        command: 'status',
        instanceId,
        rawArgv: ['status', '--instance', instanceId],
      }),
    }))
  );
  const instances = results
    .filter(({ result }) => result.ok)
    .map(({ instanceId, result }) => ({
      instanceId,
      pid: result.pid,
      windowCount: Array.isArray(result.windows) ? result.windows.length : 0,
    }));
  const unavailableInstances = results
    .filter(({ result }) => !result.ok)
    .map(({ instanceId, result }) => ({ ...result, instanceId }));

  return {
    ok: true,
    instances,
    ...(unavailableInstances.length > 0 ? { unavailableInstances } : {}),
  };
}

export async function quitAllInstances(): Promise<CliResult> {
  const results = await Promise.all(
    listInstanceIds().map(async (instanceId) => ({
      instanceId,
      result: await sendInstanceCommand(instanceId, {
        command: 'quit',
        instanceId,
        rawArgv: ['quit', '--instance', instanceId],
      }),
    }))
  );
  const quitInstances = results
    .filter(({ result }) => result.ok)
    .map(({ instanceId }) => instanceId);
  const failedInstances = results
    .filter(({ result }) => !result.ok)
    .map(({ instanceId, result }) => ({ ...result, instanceId }));

  return {
    ok: failedInstances.length === 0,
    quitInstances,
    ...(failedInstances.length > 0 ? { failedInstances } : {}),
  };
}

export function cleanupStaleInstances() {
  for (const name of listInstanceIds()) {
    const record = readInstanceRecord(name);
    if (!record || !isProcessRunning(record.pid)) {
      removeInstanceDirectory(name);
      continue;
    }
    // Delete records whose process still exists but whose socket file is gone;
    // these records can no longer be used for IPC.
    if (process.platform !== 'win32' && !fs.existsSync(record.ipcEndpoint)) {
      removeInstanceDirectory(name);
    }
  }
}

function requestInstance(
  record: InstanceRecord,
  request: InstanceRequest
): Promise<InstanceResponse> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(record.ipcEndpoint);
    let buffer = '';

    socket.setTimeout(10000);
    socket.on('connect', () => {
      // Send one newline-terminated JSON request after the socket connects.
      socket.write(`${JSON.stringify(request)}\n`);
    });
    socket.on('data', (chunk) => {
      // The response is also one newline-terminated JSON object.
      buffer += chunk.toString('utf8');
      const lineEnd = buffer.indexOf('\n');
      if (lineEnd < 0) {
        return;
      }
      const line = buffer.slice(0, lineEnd);
      socket.end();
      try {
        resolve(JSON.parse(line));
      } catch (error) {
        reject(error);
      }
    });
    socket.on('timeout', () => {
      // Force the request to fail if the app does not respond in time.
      socket.destroy(new Error('IPC request timed out.'));
    });
    // Connection and destroy errors reject the request promise.
    socket.on('error', reject);
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function instanceError(code: string, message: string, instanceId: string): CliResult {
  return {
    ok: false,
    code,
    message,
    instanceId,
  };
}
