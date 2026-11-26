import os from 'node:os';
import path from 'node:path';

const INSTANCE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function getSimulatorDataDirectory(): string {
  return path.join(os.homedir(), '.lynx-simulator');
}

export function getInstancesDirectory(): string {
  return path.join(getSimulatorDataDirectory(), 'instances');
}

export function isValidInstanceId(instanceId: string): boolean {
  return typeof instanceId === 'string' && INSTANCE_ID_PATTERN.test(instanceId);
}

export function getInstanceDirectory(instanceId: string): string {
  assertValidInstanceId(instanceId);
  return path.join(getInstancesDirectory(), instanceId);
}

export function getInstanceRecordPath(instanceId: string): string {
  return path.join(getInstanceDirectory(instanceId), 'instance.json');
}

export function getInstanceIpcEndpoint(instanceId: string): string {
  assertValidInstanceId(instanceId);
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\lynx-simulator-${instanceId}`;
  }
  return path.join(getInstanceDirectory(instanceId), 'ipc.sock');
}

export function getLogsDirectory(): string {
  return path.join(getSimulatorDataDirectory(), 'logs');
}

export function getOperationsLogDirectory(): string {
  return path.join(getLogsDirectory(), 'operations');
}

export function getInstanceLogsDirectory(): string {
  return path.join(getLogsDirectory(), 'instances');
}

export function getInstanceLogPath(instanceId: string): string {
  assertValidInstanceId(instanceId);
  return path.join(getInstanceLogsDirectory(), `${instanceId}.jsonl`);
}

function assertValidInstanceId(instanceId: string): void {
  if (!isValidInstanceId(instanceId)) {
    throw new Error(`Invalid simulator instance ID: ${instanceId}`);
  }
}
