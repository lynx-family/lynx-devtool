// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import net from 'node:net';

import {
  prepareInstanceSocket,
  removeInstanceDirectory,
  writeInstanceRecord,
  type InstanceRecord,
} from '../../../shared/instanceRegistry';
import type { InstanceRequest, InstanceResponse } from '../../../shared/instanceProtocol';
import { getInstanceIpcEndpoint } from '../../../shared/paths';

export interface InstanceIpcServer {
  record: InstanceRecord;
  close(): Promise<void>;
}

export interface StartInstanceIpcServerOptions {
  instanceId: string;
  handleRequest(request: InstanceRequest): Promise<InstanceResponse>;
}

export async function startInstanceIpcServer(
  options: StartInstanceIpcServerOptions
): Promise<InstanceIpcServer> {
  const ipcEndpoint = getInstanceIpcEndpoint(options.instanceId);
  prepareInstanceSocket(options.instanceId);

  const server = net.createServer((socket) => {
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lineEnd = buffer.indexOf('\n');
      if (lineEnd < 0) {
        return;
      }

      const line = buffer.slice(0, lineEnd);
      // Requests end with "\n". The current protocol handles one request per
      // connection.
      handleSocketMessage(socket, line, options.handleRequest).catch((error) => {
        socket.end(`${JSON.stringify(toErrorResponse(error))}\n`);
      });
    });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      // If listen fails, reject so the caller can handle startup failure.
      // Remove this temporary listener after listen succeeds.
      server.once('error', reject);
      // Start accepting IPC connections at this instance endpoint.
      server.listen(ipcEndpoint, () => {
        server.off('error', reject);
        resolve();
      });
    });
  } catch (error) {
    server.close();
    removeInstanceDirectory(options.instanceId);
    throw error;
  }

  const now = Date.now();
  const record: InstanceRecord = {
    instanceId: options.instanceId,
    pid: process.pid,
    ipcEndpoint,
    createdAt: now,
    updatedAt: now,
  };
  writeInstanceRecord(record);

  return {
    record,
    close: async () => {
      removeInstanceDirectory(options.instanceId);
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

async function handleSocketMessage(
  socket: net.Socket,
  line: string,
  handleRequest: StartInstanceIpcServerOptions['handleRequest']
): Promise<void> {
  const request = JSON.parse(line) as InstanceRequest;
  const response = await handleRequest(request);
  // Send one response and close this request connection.
  socket.end(`${JSON.stringify(response)}\n`);
}

function toErrorResponse(error: unknown): InstanceResponse {
  return {
    ok: false,
    code: 'IPC_REQUEST_FAILED',
    message: error instanceof Error ? error.message : String(error),
  };
}
