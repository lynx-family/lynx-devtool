// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { definePlugin, MainContext } from '@lynx-js/devtool-plugin-core/main';
import { spawn, ChildProcess, execSync } from 'child_process';
import detectPort from 'detect-port';
import fs from 'fs';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';

let serverProcess: ChildProcess | null = null;
let serverPort: number | null = null;
let codexBinPath: string | null = null;
let pluginContext: MainContext | null = null;
let clientSocket: WebSocket | null = null;
let clientConnectionId: number | null = null;
let clientConnectionSeq = 0;

const PLUGIN_ID = 'codex-agent';

function publishRendererEvent(eventName: string, params: any = {}) {
  pluginContext?.publishPluginEvent({
    pluginId: PLUGIN_ID,
    eventName,
    params
  });
}

function closeClientSocket(options: { notifyClose?: boolean; code?: number; reason?: string } = {}) {
  const socket = clientSocket;
  const connectionId = clientConnectionId;

  clientSocket = null;
  clientConnectionId = null;

  if (!socket) {
    return;
  }

  socket.removeAllListeners();

  try {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  } catch (_) {
    // ignore socket close errors
  }

  if (options.notifyClose !== false && connectionId !== null) {
    publishRendererEvent('codex:socket_close', {
      connectionId,
      code: options.code ?? 1000,
      reason: options.reason ?? ''
    });
  }
}

function attachClientSocketListeners(socket: WebSocket, connectionId: number) {
  socket.on('message', (data) => {
    if (clientSocket !== socket || clientConnectionId !== connectionId) {
      return;
    }

    publishRendererEvent('codex:socket_message', {
      connectionId,
      data: data.toString()
    });
  });

  socket.on('error', (error) => {
    if (clientSocket !== socket || clientConnectionId !== connectionId) {
      return;
    }

    publishRendererEvent('codex:socket_error', {
      connectionId,
      message: error instanceof Error ? error.message : String(error)
    });
  });

  socket.on('close', (code, reason) => {
    if (clientSocket === socket) {
      clientSocket = null;
      clientConnectionId = null;
    }

    publishRendererEvent('codex:socket_close', {
      connectionId,
      code,
      reason: reason.toString()
    });
  });
}

function findCodexBin(): string | null {
  // Try system PATH first
  try {
    const result = execSync('which codex', {
      encoding: 'utf-8',
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    if (result && fs.existsSync(result)) {
      return result;
    }
  } catch (_) {
    // not in PATH, try other locations
  }

  // Try nvm directories
  const home = os.homedir();
  const nvmDir = process.env.NVM_DIR || path.join(home, '.nvm');
  if (fs.existsSync(nvmDir)) {
    try {
      const versionsDir = path.join(nvmDir, 'versions', 'node');
      if (fs.existsSync(versionsDir)) {
        const versions = fs.readdirSync(versionsDir).sort().reverse();
        for (const version of versions) {
          const candidate = path.join(versionsDir, version, 'bin', 'codex');
          if (fs.existsSync(candidate)) {
            return candidate;
          }
        }
      }
    } catch (_) {
      // ignore nvm search errors
    }
  }

  // Try ~/.local/bin/codex
  const localBin = path.join(home, '.local', 'bin', 'codex');
  if (fs.existsSync(localBin)) {
    return localBin;
  }

  // Try ~/.cargo/bin/codex (Rust-based install)
  const cargoBin = path.join(home, '.cargo', 'bin', 'codex');
  if (fs.existsSync(cargoBin)) {
    return cargoBin;
  }

  return null;
}

const bridge = (context: MainContext) => {
  pluginContext = context;

  return {
  getServerInfo: async (): Promise<{ port: number | null; running: boolean; codexFound: boolean }> => {
    const running = serverProcess !== null && serverPort !== null;
    return {
      port: serverPort,
      running,
      codexFound: codexBinPath !== null
    };
  },

  startServer: async (): Promise<{ port: number; success: boolean; error?: string }> => {
    if (!codexBinPath) {
      return { port: 0, success: false, error: 'Codex CLI not found. Please install codex via npm install -g @openai/codex or check your PATH.' };
    }

    // Stop any existing server
    closeClientSocket({
      notifyClose: true,
      code: 1012,
      reason: 'Codex server restarting'
    });

    if (serverProcess) {
      try {
        serverProcess.kill('SIGTERM');
      } catch (_) {
        // ignore
      }
      serverProcess = null;
      serverPort = null;
    }

    let port: number;
    try {
      port = await detectPort(3721);
    } catch (e) {
      return { port: 0, success: false, error: `Failed to detect available port: ${e.message}` };
    }

    try {
      const wsAddress = `ws://127.0.0.1:${port}`;
      const proc = spawn(codexBinPath, ['app-server', '--listen', wsAddress], {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      proc.stdout?.on('data', (data: Buffer) => {
        console.log(`[Codex Agent] stdout: ${data.toString()}`);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        console.log(`[Codex Agent] stderr: ${data.toString()}`);
      });

      proc.on('error', (err) => {
        console.error(`[Codex Agent] process error: ${err.message}`);
        closeClientSocket({
          notifyClose: true,
          code: 1011,
          reason: err.message
        });
        serverProcess = null;
        serverPort = null;
      });

      proc.on('exit', (code, signal) => {
        console.log(`[Codex Agent] process exited: code=${code} signal=${signal}`);
        closeClientSocket({
          notifyClose: true,
          code: 1011,
          reason: signal ? `server exited with signal ${signal}` : `server exited with code ${code ?? 'unknown'}`
        });
        serverProcess = null;
        serverPort = null;
      });

      serverProcess = proc;
      serverPort = port;

      // Wait for the server to start up
      await new Promise((resolve) => setTimeout(resolve, 800));

      return { port, success: true };
    } catch (e) {
      return { port: 0, success: false, error: `Failed to start codex server: ${e.message}` };
    }
  },

  stopServer: async (): Promise<void> => {
    closeClientSocket({
      notifyClose: true,
      code: 1000,
      reason: 'Codex server stopped'
    });

    if (serverProcess) {
      try {
        serverProcess.kill('SIGTERM');
      } catch (e) {
        console.error(`[Codex Agent] failed to kill process: ${e.message}`);
      }
      serverProcess = null;
      serverPort = null;
    }
  },

  connectSocket: async (port: number): Promise<{ connectionId: number }> => {
    if (!port) {
      throw new Error('Codex server port is missing.');
    }

    closeClientSocket({ notifyClose: false });

    const connectionId = ++clientConnectionSeq;
    const socket = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const timeout = setTimeout(() => {
        cleanup();
        ws.terminate();
        reject(new Error('Timed out while connecting to the Codex server.'));
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeout);
        ws.off('open', handleOpen);
        ws.off('error', handleError);
        ws.off('unexpected-response', handleUnexpectedResponse);
      };

      const handleOpen = () => {
        cleanup();
        resolve(ws);
      };

      const handleError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const handleUnexpectedResponse = (_request: any, response: any) => {
        cleanup();
        reject(
          new Error(
            `Codex server rejected the WebSocket upgrade with status ${response?.statusCode ?? 'unknown'}.`
          )
        );
      };

      ws.once('open', handleOpen);
      ws.once('error', handleError);
      ws.once('unexpected-response', handleUnexpectedResponse);
    });

    clientSocket = socket;
    clientConnectionId = connectionId;
    attachClientSocketListeners(socket, connectionId);

    return { connectionId };
  },

  sendSocketMessage: async (payload: string, connectionId?: number): Promise<void> => {
    const socket = clientSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('Codex socket is not connected.');
    }
    if (connectionId !== undefined && clientConnectionId !== connectionId) {
      throw new Error('Codex socket connection is stale.');
    }

    await new Promise<void>((resolve, reject) => {
      socket.send(payload, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  },

  disconnectSocket: async (connectionId?: number): Promise<void> => {
    if (connectionId !== undefined && clientConnectionId !== connectionId) {
      return;
    }

    closeClientSocket({
      notifyClose: true,
      code: 1000,
      reason: 'Codex socket disconnected'
    });
  }
  };
};

export type AsyncBridgeType = ReturnType<typeof bridge>;

export default definePlugin<AsyncBridgeType>({
  asyncBridge: bridge,
  onCreate(context) {
    pluginContext = context;
    codexBinPath = findCodexBin();
    console.log(`[Codex Agent] onCreate, codexBinPath=${codexBinPath}`);
  },
  onRestart(context) {
    pluginContext = context;
    closeClientSocket({
      notifyClose: true,
      code: 1012,
      reason: 'Codex plugin restarting'
    });
    if (serverProcess) {
      try {
        serverProcess.kill('SIGTERM');
      } catch (_) {
        // ignore
      }
      serverProcess = null;
      serverPort = null;
    }
    codexBinPath = findCodexBin();
    console.log(`[Codex Agent] onRestart, codexBinPath=${codexBinPath}`);
  },
  onDestroy() {
    closeClientSocket({
      notifyClose: true,
      code: 1001,
      reason: 'Codex plugin destroyed'
    });
    if (serverProcess) {
      try {
        serverProcess.kill('SIGTERM');
      } catch (_) {
        // ignore
      }
      serverProcess = null;
      serverPort = null;
    }
    console.log('[Codex Agent] onDestroy, server stopped');
  }
});
