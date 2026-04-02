// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChatEntry,
  ConnectionStatus,
  EventMsg,
  FileChange,
  PendingApproval,
  ServerRequestMsg,
  TextEntry,
  ToolEntry
} from '../types/protocol';
import { AsyncBridgeType } from '../../bridge';

type PendingPromise = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

type EntriesUpdater = ChatEntry[] | ((prev: ChatEntry[]) => ChatEntry[]);

type JsonRpcResponse = {
  id: string | number;
  result?: unknown;
  error?: { message?: string } | string | null;
};

type JsonRpcRequest = {
  method: string;
  id: string | number;
  params?: any;
};

type JsonRpcNotification = {
  method: string;
  params?: any;
};

type CodexBridge = Pick<AsyncBridgeType, 'connectSocket' | 'disconnectSocket' | 'sendSocketMessage'>;

type PluginEventListener = (event: { params?: any }) => void;

type UseCodexClientOptions = {
  asyncBridge: CodexBridge;
  addPluginEventListener: (eventName: string, listener: PluginEventListener) => void;
  removePluginEventListener: (eventName: string, listener: PluginEventListener) => void;
};

/** ES5-compatible findLastIndex */
function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error) {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) {
      return message;
    }
  }
  return fallback;
}

function normalizePatchStatus(status?: string): ToolEntry['status'] {
  if (status === 'inProgress') {
    return 'running';
  }
  if (status === 'completed') {
    return 'done';
  }
  return 'error';
}

function normalizeCommandStatus(status?: string): ToolEntry['status'] {
  if (status === 'inProgress') {
    return 'running';
  }
  if (status === 'completed') {
    return 'done';
  }
  return 'error';
}

function normalizeFileChanges(changes?: Array<any>): Record<string, FileChange> | undefined {
  if (!changes || changes.length === 0) {
    return undefined;
  }

  return changes.reduce<Record<string, FileChange>>((acc, change) => {
    const filePath = change?.path;
    const kindType = change?.kind?.type;
    const diff = change?.diff ?? '';

    if (!filePath || !kindType) {
      return acc;
    }

    if (kindType === 'add') {
      acc[filePath] = { type: 'add', content: diff };
      return acc;
    }

    if (kindType === 'delete') {
      acc[filePath] = { type: 'delete', content: diff };
      return acc;
    }

    acc[filePath] = { type: 'update', unified_diff: diff };
    return acc;
  }, {});
}

function buildPatchTitle(fileChanges?: Record<string, FileChange>, fallbackId?: string): string {
  const fileList = Object.keys(fileChanges ?? {});
  if (fileList.length === 0) {
    return fallbackId ? `Patching: ${fallbackId}` : 'Patching files';
  }
  return `Patching: ${fileList.join(', ')}`;
}

export function useCodexClient({
  asyncBridge,
  addPluginEventListener,
  removePluginEventListener
}: UseCodexClientOptions) {
  const connectionIdRef = useRef<number | null>(null);
  const isConnectedRef = useRef<boolean>(false);
  const disconnectingRef = useRef<boolean>(false);
  const requestIdRef = useRef<number>(100);
  const threadIdRef = useRef<string | null>(null);
  const turnIdRef = useRef<string | null>(null);
  const pendingResponsesRef = useRef<Map<string | number, PendingPromise>>(new Map());
  const streamingContentRef = useRef<Map<string, string>>(new Map());
  const entriesRef = useRef<ChatEntry[]>([]);

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusRef = useRef<ConnectionStatus>('disconnected');
  const setStatusSynced = useCallback((nextStatus: ConnectionStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const setEntriesSynced = useCallback((updater: EntriesUpdater) => {
    setEntries((prev) => {
      const next =
        typeof updater === 'function'
          ? (updater as (current: ChatEntry[]) => ChatEntry[])(prev)
          : updater;
      entriesRef.current = next;
      return next;
    });
  }, []);

  const nextRequestId = () => {
    requestIdRef.current += 1;
    return requestIdRef.current;
  };

  const rejectPendingResponses = useCallback((message: string) => {
    pendingResponsesRef.current.forEach(({ reject }) => {
      reject(new Error(message));
    });
    pendingResponsesRef.current.clear();
  }, []);

  const sendRaw = useCallback((obj: unknown) => {
    const connectionId = connectionIdRef.current;
    if (!isConnectedRef.current || connectionId === null) {
      return;
    }
    void asyncBridge
      .sendSocketMessage(JSON.stringify(obj), connectionId)
      .catch((error) => {
        setError(toErrorMessage(error, 'Failed to send a message to Codex.'));
        setStatusSynced('error');
      });
  }, [asyncBridge, setStatusSynced]);

  const sendRequest = useCallback(
    <T = unknown,>(method: string, params?: unknown): Promise<T> => {
      const connectionId = connectionIdRef.current;
      if (!isConnectedRef.current || connectionId === null) {
        return Promise.reject(new Error('WebSocket is not connected'));
      }

      const id = nextRequestId();
      return new Promise<T>((resolve, reject) => {
        pendingResponsesRef.current.set(id, { resolve, reject });
        asyncBridge
          .sendSocketMessage(JSON.stringify({ id, method, params }), connectionId)
          .catch((error) => {
            pendingResponsesRef.current.delete(id);
            reject(error);
          });
      });
    },
    [asyncBridge]
  );

  const addEntry = useCallback(
    (entry: ChatEntry) => {
      setEntriesSynced((prev) => [...prev, entry]);
    },
    [setEntriesSynced]
  );

  const updateLastAssistantEntry = useCallback(
    (itemId: string, delta: string) => {
      setEntriesSynced((prev) => {
        const next = [...prev];
        const idx = findLastIndex(
          next,
          (entry) =>
            entry.kind === 'text' &&
            (entry as TextEntry).role === 'assistant' &&
            (entry as TextEntry).itemId === itemId
        );

        if (idx >= 0) {
          const existing = next[idx] as TextEntry;
          const newContent = (streamingContentRef.current.get(itemId) ?? '') + delta;
          streamingContentRef.current.set(itemId, newContent);
          next[idx] = { ...existing, content: newContent, streaming: true };
        } else {
          streamingContentRef.current.set(itemId, delta);
          next.push({
            kind: 'text',
            role: 'assistant',
            content: delta,
            streaming: true,
            itemId
          });
        }

        return next;
      });
    },
    [setEntriesSynced]
  );

  const finalizeAssistantEntry = useCallback(
    (itemId: string) => {
      setEntriesSynced((prev) => {
        const next = [...prev];
        const idx = findLastIndex(
          next,
          (entry) =>
            entry.kind === 'text' &&
            (entry as TextEntry).role === 'assistant' &&
            (entry as TextEntry).itemId === itemId
        );
        if (idx >= 0) {
          next[idx] = { ...(next[idx] as TextEntry), streaming: false };
        }
        return next;
      });
      streamingContentRef.current.delete(itemId);
    },
    [setEntriesSynced]
  );

  const upsertToolEntry = useCallback(
    (entry: ToolEntry) => {
      setEntriesSynced((prev) => {
        const next = [...prev];
        const idx = findLastIndex(
          next,
          (currentEntry) =>
            currentEntry.kind === 'tool' && (currentEntry as ToolEntry).callId === entry.callId
        );

        if (idx >= 0) {
          const existing = next[idx] as ToolEntry;
          next[idx] = {
            ...existing,
            ...entry,
            output: entry.output ?? existing.output,
            exitCode: entry.exitCode ?? existing.exitCode,
            fileChanges: entry.fileChanges ?? existing.fileChanges
          };
        } else {
          next.push(entry);
        }

        return next;
      });
    },
    [setEntriesSynced]
  );

  const updateToolEntry = useCallback(
    (callId: string, updates: Partial<Omit<ToolEntry, 'kind' | 'callId'>>) => {
      setEntriesSynced((prev) => {
        const next = [...prev];
        const idx = findLastIndex(
          next,
          (entry) => entry.kind === 'tool' && (entry as ToolEntry).callId === callId
        );
        if (idx >= 0) {
          const existing = next[idx] as ToolEntry;
          next[idx] = {
            ...existing,
            ...updates,
            output: updates.output ?? existing.output,
            fileChanges: updates.fileChanges ?? existing.fileChanges,
            exitCode: updates.exitCode ?? existing.exitCode
          };
        }
        return next;
      });
    },
    [setEntriesSynced]
  );

  const appendToolOutput = useCallback(
    (callId: string, delta: string) => {
      setEntriesSynced((prev) => {
        const next = [...prev];
        const idx = findLastIndex(
          next,
          (entry) => entry.kind === 'tool' && (entry as ToolEntry).callId === callId
        );
        if (idx >= 0) {
          const existing = next[idx] as ToolEntry;
          next[idx] = { ...existing, output: (existing.output ?? '') + delta };
        }
        return next;
      });
    },
    [setEntriesSynced]
  );

  const syncAssistantEntryFromItem = useCallback(
    (item: any) => {
      if (item?.type !== 'agentMessage' || !item.id) {
        return;
      }

      setEntriesSynced((prev) => {
        const next = [...prev];
        const idx = findLastIndex(
          next,
          (entry) =>
            entry.kind === 'text' &&
            (entry as TextEntry).role === 'assistant' &&
            (entry as TextEntry).itemId === item.id
        );
        const nextEntry: TextEntry = {
          kind: 'text',
          role: 'assistant',
          content: item.text ?? '',
          streaming: false,
          itemId: item.id
        };

        if (idx >= 0) {
          next[idx] = nextEntry;
        } else if (item.text) {
          next.push(nextEntry);
        }

        return next;
      });
      streamingContentRef.current.delete(item.id);
    },
    [setEntriesSynced]
  );

  const syncToolEntryFromItem = useCallback(
    (item: any) => {
      if (!item?.id) {
        return;
      }

      if (item.type === 'commandExecution') {
        upsertToolEntry({
          kind: 'tool',
          toolType: 'exec',
          title: item.command ?? 'Command execution',
          status: normalizeCommandStatus(item.status),
          callId: item.id,
          output: item.aggregatedOutput ?? undefined,
          exitCode: item.exitCode ?? undefined
        });
        return;
      }

      if (item.type === 'fileChange') {
        const fileChanges = normalizeFileChanges(item.changes);
        upsertToolEntry({
          kind: 'tool',
          toolType: 'patch',
          title: buildPatchTitle(fileChanges, item.id),
          status: normalizePatchStatus(item.status),
          callId: item.id,
          fileChanges
        });
        return;
      }

      syncAssistantEntryFromItem(item);
    },
    [syncAssistantEntryFromItem, upsertToolEntry]
  );

  const getPatchFileChanges = useCallback((itemId: string): Record<string, FileChange> | undefined => {
    const entry = entriesRef.current.find(
      (currentEntry) =>
        currentEntry.kind === 'tool' &&
        (currentEntry as ToolEntry).callId === itemId &&
        (currentEntry as ToolEntry).toolType === 'patch'
    ) as ToolEntry | undefined;

    return entry?.fileChanges;
  }, []);

  const finalizeStreamingEntries = useCallback(() => {
    streamingContentRef.current.forEach((_content, itemId) => {
      finalizeAssistantEntry(itemId);
    });
  }, [finalizeAssistantEntry]);

  const handleEventMsg = useCallback(
    (event: EventMsg) => {
      switch (event.type) {
        case 'session_configured':
          threadIdRef.current = event.session_id;
          setStatusSynced('ready');
          break;
        case 'task_started':
          turnIdRef.current = event.turn_id;
          setStatusSynced('thinking');
          break;
        case 'task_complete':
          finalizeStreamingEntries();
          setStatusSynced('ready');
          break;
        case 'agent_message_content_delta':
          updateLastAssistantEntry(event.item_id, event.delta);
          break;
        case 'exec_command_begin':
          addEntry({
            kind: 'tool',
            toolType: 'exec',
            title: event.command.join(' '),
            status: 'running',
            callId: event.call_id,
            output: ''
          });
          break;
        case 'exec_command_output_delta':
          appendToolOutput(event.call_id, event.data);
          break;
        case 'exec_command_end':
          updateToolEntry(event.call_id, {
            status: event.exit_code === 0 ? 'done' : 'error',
            exitCode: event.exit_code
          });
          break;
        case 'patch_apply_begin':
          upsertToolEntry({
            kind: 'tool',
            toolType: 'patch',
            title: buildPatchTitle(event.changes, event.call_id),
            status: 'running',
            callId: event.call_id,
            fileChanges: event.changes
          });
          break;
        case 'patch_apply_end':
          updateToolEntry(event.call_id, {
            status:
              event.status === 'applied' || event.status === 'success' ? 'done' : 'error'
          });
          break;
        case 'turn_aborted':
          finalizeStreamingEntries();
          setStatusSynced('ready');
          break;
        case 'error':
          setError(event.message);
          setStatusSynced('error');
          break;
        default:
          break;
      }
    },
    [
      addEntry,
      appendToolOutput,
      finalizeStreamingEntries,
      setStatusSynced,
      updateLastAssistantEntry,
      updateToolEntry,
      upsertToolEntry
    ]
  );

  const handleNotification = useCallback(
    (message: JsonRpcNotification) => {
      const params = message.params ?? {};

      switch (message.method) {
        case 'thread/started':
          threadIdRef.current = params.thread?.id ?? threadIdRef.current;
          if (statusRef.current === 'initializing') {
            setStatusSynced('ready');
          }
          break;
        case 'turn/started':
          turnIdRef.current = params.turn?.id ?? turnIdRef.current;
          setStatusSynced('thinking');
          break;
        case 'turn/completed':
          turnIdRef.current = params.turn?.id ?? turnIdRef.current;
          finalizeStreamingEntries();
          setStatusSynced('ready');
          break;
        case 'item/started':
        case 'item/completed':
          syncToolEntryFromItem(params.item);
          break;
        case 'item/agentMessage/delta':
          if (params.itemId && params.delta) {
            updateLastAssistantEntry(params.itemId, params.delta);
          }
          break;
        case 'item/commandExecution/outputDelta':
        case 'command/exec/outputDelta':
          if (params.itemId && params.delta) {
            appendToolOutput(params.itemId, params.delta);
          }
          break;
        case 'item/fileChange/outputDelta':
          if (params.itemId && params.delta) {
            updateToolEntry(params.itemId, {
              output: params.delta
            });
          }
          break;
        case 'error':
          setError(
            params.error?.message ??
              params.message ??
              'Codex request failed.'
          );
          setStatusSynced('error');
          break;
        case 'thread/closed':
          if (params.threadId && params.threadId === threadIdRef.current) {
            setStatusSynced('disconnected');
          }
          break;
        default:
          break;
      }
    },
    [
      appendToolOutput,
      finalizeStreamingEntries,
      setStatusSynced,
      syncToolEntryFromItem,
      updateLastAssistantEntry,
      updateToolEntry
    ]
  );

  const handleServerRequest = useCallback(
    (msg: ServerRequestMsg | JsonRpcRequest) => {
      if (msg.method === 'applyPatchApproval') {
        setPendingApproval({
          requestId: msg.id,
          type: 'patch',
          isServerRequest: true,
          requestFlavor: 'legacy-patch',
          details: {
            fileChanges: (msg as ServerRequestMsg & { params: any }).params.fileChanges,
            reason: (msg as ServerRequestMsg & { params: any }).params.reason ?? undefined,
            grantRoot: (msg as ServerRequestMsg & { params: any }).params.grantRoot ?? undefined
          }
        });
        return;
      }

      if (msg.method === 'execCommandApproval') {
        setPendingApproval({
          requestId: msg.id,
          type: 'exec',
          isServerRequest: true,
          requestFlavor: 'legacy-exec',
          details: {
            approvalId: (msg as ServerRequestMsg & { params: any }).params.approvalId ?? null,
            command: (msg as ServerRequestMsg & { params: any }).params.command,
            cwd: (msg as ServerRequestMsg & { params: any }).params.cwd,
            reason: (msg as ServerRequestMsg & { params: any }).params.reason ?? undefined
          }
        });
        return;
      }

      if (msg.method === 'item/fileChange/requestApproval') {
        const params = msg.params ?? {};
        setPendingApproval({
          requestId: msg.id,
          type: 'patch',
          isServerRequest: true,
          requestFlavor: 'v2-patch',
          details: {
            itemId: params.itemId,
            threadId: params.threadId,
            turnId: params.turnId,
            reason: params.reason ?? undefined,
            grantRoot: params.grantRoot ?? undefined,
            fileChanges: params.itemId ? getPatchFileChanges(params.itemId) : undefined
          }
        });
        return;
      }

      if (msg.method === 'item/commandExecution/requestApproval') {
        const params = msg.params ?? {};
        setPendingApproval({
          requestId: msg.id,
          type: 'exec',
          isServerRequest: true,
          requestFlavor: 'v2-exec',
          details: {
            itemId: params.itemId,
            threadId: params.threadId,
            turnId: params.turnId,
            approvalId: params.approvalId ?? null,
            command: params.command ?? undefined,
            cwd: params.cwd ?? undefined,
            reason: params.reason ?? undefined
          }
        });
      }
    },
    [getPatchFileChanges]
  );

  const handleMessage = useCallback(
    (data: string) => {
      let message: any;
      try {
        message = JSON.parse(data);
      } catch (_) {
        console.warn('[Codex Agent] Failed to parse message:', data);
        return;
      }

      if (message.id !== undefined && Object.prototype.hasOwnProperty.call(message, 'result')) {
        const pending = pendingResponsesRef.current.get(message.id);
        if (pending) {
          pending.resolve(message.result);
          pendingResponsesRef.current.delete(message.id);
        }
        return;
      }

      if (
        message.id !== undefined &&
        Object.prototype.hasOwnProperty.call(message, 'error') &&
        message.method === undefined
      ) {
        const pending = pendingResponsesRef.current.get(message.id);
        if (pending) {
          pending.reject(new Error(toErrorMessage(message.error, 'Request failed')));
          pendingResponsesRef.current.delete(message.id);
        }
        return;
      }

      if (message.method !== undefined && message.id !== undefined) {
        handleServerRequest(message as JsonRpcRequest);
        return;
      }

      if (message.method !== undefined) {
        handleNotification(message as JsonRpcNotification);
        return;
      }

      if (message.type !== undefined) {
        handleEventMsg(message as EventMsg);
      }
    },
    [handleEventMsg, handleNotification, handleServerRequest]
  );

  useEffect(() => {
    const handleSocketMessageEvent: PluginEventListener = (event) => {
      if (event?.params?.connectionId !== connectionIdRef.current) {
        return;
      }

      const data = event?.params?.data;
      if (typeof data === 'string') {
        handleMessage(data);
      }
    };

    const handleSocketErrorEvent: PluginEventListener = (event) => {
      if (event?.params?.connectionId !== connectionIdRef.current) {
        return;
      }

      if (disconnectingRef.current) {
        return;
      }

      setError(event?.params?.message ?? 'WebSocket connection error');
      setStatusSynced('error');
    };

    const handleSocketCloseEvent: PluginEventListener = (event) => {
      if (event?.params?.connectionId !== connectionIdRef.current) {
        return;
      }

      connectionIdRef.current = null;
      isConnectedRef.current = false;
      rejectPendingResponses(
        event?.params?.reason
          ? `Codex connection closed: ${event.params.reason}`
          : 'Codex connection closed.'
      );

      if (disconnectingRef.current) {
        return;
      }

      if (statusRef.current !== 'disconnected' && statusRef.current !== 'error') {
        setStatusSynced('disconnected');
      }
    };

    addPluginEventListener('codex:socket_message', handleSocketMessageEvent);
    addPluginEventListener('codex:socket_error', handleSocketErrorEvent);
    addPluginEventListener('codex:socket_close', handleSocketCloseEvent);

    return () => {
      removePluginEventListener('codex:socket_message', handleSocketMessageEvent);
      removePluginEventListener('codex:socket_error', handleSocketErrorEvent);
      removePluginEventListener('codex:socket_close', handleSocketCloseEvent);
    };
  }, [
    addPluginEventListener,
    handleMessage,
    rejectPendingResponses,
    removePluginEventListener,
    setStatusSynced
  ]);

  const connect = useCallback(
    (port: number, cwd: string, approvalPolicy: 'on-failure' | 'on-request' | 'never' = 'on-failure') => {
      const normalizedCwd = cwd.trim();
      if (!normalizedCwd) {
        setError('Choose a project directory before connecting to Codex.');
        setStatusSynced('error');
        return;
      }

      void (async () => {
        const previousConnectionId = connectionIdRef.current;
        disconnectingRef.current = true;

        try {
          if (previousConnectionId !== null) {
            await asyncBridge.disconnectSocket(previousConnectionId);
          }
        } catch (_) {
          // ignore disconnect errors during reconnect
        } finally {
          disconnectingRef.current = false;
        }

        setStatusSynced('connecting');
        setError(null);
        connectionIdRef.current = null;
        isConnectedRef.current = false;
        threadIdRef.current = null;
        turnIdRef.current = null;
        rejectPendingResponses('Codex connection restarted.');
        streamingContentRef.current.clear();

        try {
          const { connectionId } = await asyncBridge.connectSocket(port);
          connectionIdRef.current = connectionId;
          isConnectedRef.current = true;
          setStatusSynced('initializing');

          await sendRequest('initialize', {
            clientInfo: {
              name: 'lynx-devtool',
              title: 'Lynx DevTool',
              version: '0.1.2'
            },
            capabilities: { experimentalApi: false }
          });

          sendRaw({ method: 'initialized' });

          const threadStartResult = await sendRequest<any>('thread/start', {
            cwd: normalizedCwd,
            approvalPolicy,
            sandbox: 'workspace-write',
            experimentalRawEvents: false,
            persistExtendedHistory: false
          });

          const startedThreadId =
            threadStartResult?.thread?.id ?? threadStartResult?.session_id ?? null;

          if (!startedThreadId) {
            throw new Error('Codex thread started without returning a thread id.');
          }

          threadIdRef.current = startedThreadId;
          setStatusSynced('ready');
        } catch (requestError) {
          const failedConnectionId = connectionIdRef.current;
          connectionIdRef.current = null;
          isConnectedRef.current = false;

          if (failedConnectionId !== null) {
            try {
              disconnectingRef.current = true;
              await asyncBridge.disconnectSocket(failedConnectionId);
            } catch (_) {
              // ignore cleanup errors after a failed init
            } finally {
              disconnectingRef.current = false;
            }
          }

          setError(toErrorMessage(requestError, 'Failed to initialize the Codex session.'));
          setStatusSynced('error');
        }
      })();
    },
    [asyncBridge, rejectPendingResponses, sendRaw, sendRequest, setStatusSynced]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const threadId = threadIdRef.current;
      if (!threadId) {
        setError('Not connected to a thread');
        return;
      }

      addEntry({
        kind: 'text',
        role: 'user',
        content: text,
        streaming: false
      });

      setStatusSynced('thinking');

      try {
        const turnStartResult = await sendRequest<any>('turn/start', {
          threadId,
          input: [{ type: 'text', text, text_elements: [] }]
        });

        if (turnStartResult?.turn?.id) {
          turnIdRef.current = turnStartResult.turn.id;
        }
      } catch (requestError) {
        setError(toErrorMessage(requestError, 'Failed to start the turn.'));
        setStatusSynced('ready');
      }
    },
    [addEntry, sendRequest, setStatusSynced]
  );

  const sendMessageWithContext = useCallback(
    (text: string, context: string) => {
      const combined = context ? `${context}\n\n${text}` : text;
      void sendMessage(combined);
    },
    [sendMessage]
  );

  const interrupt = useCallback(async () => {
    const threadId = threadIdRef.current;
    const turnId = turnIdRef.current;
    if (!threadId) {
      return;
    }

    try {
      await sendRequest('turn/interrupt', {
        threadId,
        ...(turnId ? { turnId } : {})
      });
    } catch (requestError) {
      setError(toErrorMessage(requestError, 'Failed to interrupt the turn.'));
    }
  }, [sendRequest]);

  const respondToApproval = useCallback(
    (decision: 'approved' | 'denied') => {
      setPendingApproval((current) => {
        if (!current) {
          return null;
        }

        if (current.isServerRequest) {
          const result =
            current.requestFlavor === 'v2-exec' || current.requestFlavor === 'v2-patch'
              ? { decision: decision === 'approved' ? 'accept' : 'decline' }
              : { decision: decision === 'approved' ? 'approved' : 'denied' };

          sendRaw({
            id: current.requestId,
            result
          });
        }

        return null;
      });
    },
    [sendRaw]
  );

  const disconnect = useCallback(() => {
    const connectionId = connectionIdRef.current;
    disconnectingRef.current = true;
    connectionIdRef.current = null;
    isConnectedRef.current = false;

    if (connectionId !== null) {
      void asyncBridge.disconnectSocket(connectionId).finally(() => {
        disconnectingRef.current = false;
      });
    } else {
      disconnectingRef.current = false;
    }

    threadIdRef.current = null;
    turnIdRef.current = null;
    rejectPendingResponses('Codex connection closed.');
    streamingContentRef.current.clear();
    setStatusSynced('disconnected');
    setEntriesSynced([]);
    setPendingApproval(null);
    setError(null);
  }, [asyncBridge, rejectPendingResponses, setEntriesSynced, setStatusSynced]);

  return {
    status,
    entries,
    pendingApproval,
    error,
    connect,
    disconnect,
    sendMessage,
    sendMessageWithContext,
    interrupt,
    respondToApproval
  };
}
