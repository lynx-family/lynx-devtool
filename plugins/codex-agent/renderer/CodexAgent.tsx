// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import React, { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Collapse,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import {
  StopOutlined,
  SendOutlined,
  FolderOpenOutlined,
  RobotOutlined,
  WarningOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import { RendererContext } from '@lynx-js/devtool-plugin-core/renderer';
import { ERemoteDebugDriverExternalEvent } from '@lynx-js/remote-debug-driver';
import { AsyncBridgeType } from '../bridge';
import { useCodexClient } from './hooks/useCodexClient';
import { MessageList } from './components/MessageList';
import { ApprovalDialog } from './components/ApprovalDialog';
import { ConversationSidebar } from './components/ConversationSidebar';
import { ApprovalPolicy, ChatEntry, ConnectionStatus, ConversationHistoryItem } from './types/protocol';

const { TextArea } = Input;
const { Text } = Typography;
const CODEX_CONTEXT_STORAGE_KEY = 'lynx-devtool:codex-context';
const CODEX_CONTEXT_EVENT_NAME = 'lynx-devtool:codex-context';
const CODEX_PROJECT_PATH_STORAGE_KEY = 'lynx-devtool:codex-project-path';
const CODEX_APPROVAL_POLICY_STORAGE_KEY = 'lynx-devtool:codex-approval-policy';
const CODEX_CONVERSATION_HISTORY_STORAGE_KEY = 'lynx-devtool:codex-conversation-history';
const MAX_CONVERSATION_HISTORY_ITEMS = 20;

type CodexContextPayload = {
  id?: string;
  label?: string;
  text?: string;
  createdAt?: number;
  autoSend?: boolean;
  source?: string;
};

type CodexContextAttachment = {
  id: string;
  label: string;
  text: string;
  createdAt: number;
  source: string;
};

type PendingSend = {
  text: string;
  inputText: string;
  attachments: CodexContextAttachment[];
};

function parseStoredConversationHistory(rawHistory: string | null): ConversationHistoryItem[] {
  if (!rawHistory) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawHistory) as ConversationHistoryItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item.id === 'string' && Array.isArray(item.entries))
      .map((item) => ({
        id: item.id,
        title: typeof item.title === 'string' && item.title.trim() ? item.title : 'Untitled conversation',
        preview: typeof item.preview === 'string' ? item.preview : '',
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
        entries: item.entries
      }));
  } catch (_) {
    return [];
  }
}

function persistConversationHistory(historyItems: ConversationHistoryItem[]) {
  localStorage.setItem(
    CODEX_CONVERSATION_HISTORY_STORAGE_KEY,
    JSON.stringify(historyItems.slice(0, MAX_CONVERSATION_HISTORY_ITEMS))
  );
}

function parseStoredCodexPayloads(rawPayloads: string | null): CodexContextPayload[] {
  if (!rawPayloads) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawPayloads) as CodexContextPayload | CodexContextPayload[];
    const payloads = Array.isArray(parsed) ? parsed : [parsed];
    return payloads.filter((payload) => typeof payload?.text === 'string' && payload.text.trim().length > 0);
  } catch (_) {
    return [];
  }
}

function persistStoredCodexPayloads(payloads: CodexContextPayload[]) {
  if (payloads.length === 0) {
    sessionStorage.removeItem(CODEX_CONTEXT_STORAGE_KEY);
    return;
  }

  sessionStorage.setItem(CODEX_CONTEXT_STORAGE_KEY, JSON.stringify(payloads));
}

function createContextAttachmentId(): string {
  return `codex-context-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createConversationId(): string {
  return `codex-conversation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function extractPromptText(content: string): string {
  const marker = 'User input:';
  const markerIndex = content.lastIndexOf(marker);

  if (markerIndex >= 0) {
    const prompt = content.slice(markerIndex + marker.length).trim();
    if (prompt) {
      return prompt;
    }
  }

  return content.trim();
}

function firstMeaningfulLine(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line === 'User input:' || line.startsWith('```')) {
      continue;
    }

    return line.replace(/^[-*]\s+/, '');
  }

  return '';
}

function summarizeConversation(entries: ChatEntry[]): Pick<ConversationHistoryItem, 'title' | 'preview'> {
  const textEntries = entries.filter((entry): entry is Extract<ChatEntry, { kind: 'text' }> => entry.kind === 'text');
  const toolEntries = entries.filter((entry): entry is Extract<ChatEntry, { kind: 'tool' }> => entry.kind === 'tool');
  const firstUserEntry = textEntries.find((entry) => entry.role === 'user' && entry.content.trim());
  const lastUserEntry = [...textEntries].reverse().find((entry) => entry.role === 'user' && entry.content.trim());
  const lastAssistantEntry = [...textEntries]
    .reverse()
    .find((entry) => entry.role === 'assistant' && entry.content.trim());
  const lastToolEntry = [...toolEntries].reverse().find((entry) => entry.title.trim());

  const titleSource =
    (firstUserEntry && extractPromptText(firstUserEntry.content)) ||
    (lastUserEntry && extractPromptText(lastUserEntry.content)) ||
    lastAssistantEntry?.content ||
    lastToolEntry?.title ||
    '';

  const previewSource =
    lastAssistantEntry?.content ||
    (lastUserEntry && extractPromptText(lastUserEntry.content)) ||
    lastToolEntry?.title ||
    '';

  return {
    title: truncateText(firstMeaningfulLine(titleSource) || 'Untitled conversation', 48),
    preview: truncateText(firstMeaningfulLine(previewSource) || 'No preview available.', 84)
  };
}

function buildConversationHistoryItem(
  conversationId: string,
  entries: ChatEntry[]
): ConversationHistoryItem | null {
  if (entries.length === 0) {
    return null;
  }

  const summary = summarizeConversation(entries);
  return {
    id: conversationId,
    title: summary.title,
    preview: summary.preview,
    updatedAt: Date.now(),
    entries: [...entries]
  };
}

function upsertConversationHistory(
  historyItems: ConversationHistoryItem[],
  nextItem: ConversationHistoryItem
): ConversationHistoryItem[] {
  const nextHistory = [nextItem, ...historyItems.filter((item) => item.id !== nextItem.id)];
  nextHistory.sort((left, right) => right.updatedAt - left.updatedAt);
  return nextHistory.slice(0, MAX_CONVERSATION_HISTORY_ITEMS);
}

function labelForContextSource(source?: string): string {
  switch (source) {
    case 'elements-selection':
      return 'Elements context';
    case 'console-selection':
      return 'Console context';
    case 'console-error':
      return 'Console error';
    case 'devtool-panel':
      return 'DevTool context';
    default:
      return 'Context';
  }
}

function toContextAttachment(payload?: CodexContextPayload): CodexContextAttachment|null {
  const text = payload?.text?.trim();
  if (!text) {
    return null;
  }

  return {
    id: payload?.id ?? createContextAttachmentId(),
    label: payload?.label?.trim() || labelForContextSource(payload?.source),
    text,
    createdAt: payload?.createdAt ?? Date.now(),
    source: payload?.source ?? 'devtool-panel'
  };
}

function composeOutgoingPrompt(attachments: CodexContextAttachment[], userInput: string): string {
  const sections = attachments
    .map((attachment) => attachment.text.trim())
    .filter(Boolean);
  const trimmedUserInput = userInput.trim();

  if (trimmedUserInput) {
    sections.push(`User input:\n${trimmedUserInput}`);
  }

  return sections.join('\n\n');
}

interface CodexAgentProps {
  context: RendererContext<AsyncBridgeType>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function statusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'ready':
      return '#52c41a';
    case 'thinking':
      return '#1677ff';
    case 'connecting':
    case 'initializing':
      return '#faad14';
    case 'error':
      return '#ff4d4f';
    default:
      return '#d9d9d9';
  }
}

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'disconnected':
      return 'Disconnected';
    case 'connecting':
      return 'Connecting…';
    case 'initializing':
      return 'Initializing…';
    case 'ready':
      return 'Ready';
    case 'thinking':
      return 'Thinking…';
    case 'error':
      return 'Error';
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

// eslint-disable-next-line max-lines-per-function
export default function CodexAgent({ context }: CodexAgentProps) {
  const { asyncBridge, addPluginEventListener, removePluginEventListener, debugDriver } = context;

  const client = useCodexClient({
    asyncBridge,
    addPluginEventListener,
    removePluginEventListener
  });

  const [projectPath, setProjectPath] = useState<string>('');
  const [contextAttachments, setContextAttachments] = useState<CodexContextAttachment[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [approvalPolicy, setApprovalPolicy] = useState<ApprovalPolicy>('on-failure');
  const [activeConversationId, setActiveConversationId] = useState<string>(() => createConversationId());
  const [selectedHistoryConversationId, setSelectedHistoryConversationId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryItem[]>([]);
  const [currentConversationUpdatedAt, setCurrentConversationUpdatedAt] = useState<number | null>(null);
  const [serverStatus, setServerStatus] = useState<'idle' | 'starting' | 'running' | 'error'>(
    'idle'
  );
  const [serverError, setServerError] = useState<string>('');
  const [codexFound, setCodexFound] = useState<boolean>(true);
  const [consoleErrors, setConsoleErrors] = useState<string[]>([]);
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  const consoleErrorsRef = useRef<string[]>([]);
  const connectOnSendInFlightRef = useRef<boolean>(false);

  const appendIncomingContext = useCallback((payload?: CodexContextPayload) => {
    const attachment = toContextAttachment(payload);
    if (!attachment) {
      return;
    }

    setContextAttachments((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === attachment.id);
      if (existingIndex === -1) {
        return [...prev, attachment];
      }

      const nextAttachments = [...prev];
      nextAttachments[existingIndex] = attachment;
      return nextAttachments;
    });
  }, []);

  const removeStoredCodexPayload = useCallback((payloadId?: string) => {
    if (!payloadId) {
      return;
    }

    const storedPayloads = parseStoredCodexPayloads(sessionStorage.getItem(CODEX_CONTEXT_STORAGE_KEY));
    const nextPayloads = storedPayloads.filter((payload) => payload.id !== payloadId);
    persistStoredCodexPayloads(nextPayloads);
  }, []);

  const handleIncomingCodexPayload = useCallback(
    (payload?: CodexContextPayload) => {
      appendIncomingContext(payload);
    },
    [appendIncomingContext]
  );

  const connectToRunningServer = useCallback(
    async (nextProjectPath?: string, nextApprovalPolicy?: ApprovalPolicy) => {
      const resolvedProjectPath = (nextProjectPath ?? projectPath).trim();

      if (!resolvedProjectPath) {
        setServerError('Choose a project directory before connecting to Codex.');
        return false;
      }

      try {
        const { port, running, codexFound: found } = await asyncBridge.getServerInfo();
        setCodexFound(found);

        if (!running || !port) {
          setServerStatus('idle');
          setServerError('Codex server is not running.');
          return false;
        }

        setServerStatus('running');
        setServerError('');
        client.connect(port, resolvedProjectPath, nextApprovalPolicy ?? approvalPolicy);
        return true;
      } catch (e: any) {
        setServerError(e.message ?? 'Failed to connect to the running Codex server.');
        return false;
      }
    },
    [approvalPolicy, asyncBridge, client.connect, projectPath]
  );

  const startServer = useCallback(
    async (nextProjectPath?: string, nextApprovalPolicy?: ApprovalPolicy) => {
      const resolvedProjectPath = (nextProjectPath ?? projectPath).trim();
      if (!resolvedProjectPath) {
        setServerStatus('error');
        setServerError('Choose a project directory before starting Codex.');
        return false;
      }

      setServerStatus('starting');
      setServerError('');
      try {
        const result = await asyncBridge.startServer();
        if (result.success) {
          setServerStatus('running');
          client.connect(result.port, resolvedProjectPath, nextApprovalPolicy ?? approvalPolicy);
          return true;
        }

        setServerStatus('error');
        setServerError(result.error ?? 'Unknown error');
        return false;
      } catch (e: any) {
        setServerStatus('error');
        setServerError(e.message ?? 'Failed to start server');
        return false;
      }
    },
    [approvalPolicy, asyncBridge, client.connect, projectPath]
  );

  const ensureConnectionForSend = useCallback(
    async (nextProjectPath?: string, nextApprovalPolicy?: ApprovalPolicy) => {
      const resolvedProjectPath = (nextProjectPath ?? projectPath).trim();
      if (!resolvedProjectPath) {
        setServerError('Choose a project directory before connecting to Codex.');
        return false;
      }

      if (connectOnSendInFlightRef.current) {
        return true;
      }

      if (
        serverStatus === 'starting' ||
        client.status === 'connecting' ||
        client.status === 'initializing' ||
        client.status === 'ready' ||
        client.status === 'thinking'
      ) {
        return true;
      }

      connectOnSendInFlightRef.current = true;
      try {
        const connected = await connectToRunningServer(
          resolvedProjectPath,
          nextApprovalPolicy ?? approvalPolicy
        );
        if (!connected) {
          return await startServer(resolvedProjectPath, nextApprovalPolicy ?? approvalPolicy);
        }
        return true;
      } finally {
        connectOnSendInFlightRef.current = false;
      }
    },
    [
      approvalPolicy,
      client.status,
      connectToRunningServer,
      projectPath,
      serverStatus,
      startServer
    ]
  );

  // ─── On mount: check server info + subscribe to events ──────────────────

  useEffect(() => {
    const savedProjectPath = localStorage.getItem(CODEX_PROJECT_PATH_STORAGE_KEY);
    const defaultProjectPath =
      typeof window.ldtElectronAPI?.ipcRenderer?.sendSync === 'function'
        ? String(window.ldtElectronAPI.ipcRenderer.sendSync('getAppPath') ?? '').trim()
        : '';
    const initialProjectPath = savedProjectPath?.trim() || defaultProjectPath;
    if (initialProjectPath) {
      setProjectPath(initialProjectPath);
    }

    const savedApprovalPolicy = localStorage.getItem(CODEX_APPROVAL_POLICY_STORAGE_KEY);
    if (
      savedApprovalPolicy === 'on-failure' ||
      savedApprovalPolicy === 'on-request' ||
      savedApprovalPolicy === 'never'
    ) {
      setApprovalPolicy(savedApprovalPolicy);
    }

    setConversationHistory(
      parseStoredConversationHistory(localStorage.getItem(CODEX_CONVERSATION_HISTORY_STORAGE_KEY))
    );

    asyncBridge
      .getServerInfo()
      .then(({ port, running, codexFound: found }) => {
        setCodexFound(found);
        if (running && port) {
          setServerStatus('running');
        }
      })
      .catch((e) => {
        console.error('[Codex Agent] getServerInfo failed:', e);
      });

    // Listen for context sent from other plugins
    const handlePluginContext = (event: { params?: CodexContextPayload }) => {
      handleIncomingCodexPayload(event?.params);
    };
    addPluginEventListener('codex:send_context', handlePluginContext);

    const storagePayloads = parseStoredCodexPayloads(sessionStorage.getItem(CODEX_CONTEXT_STORAGE_KEY));
    storagePayloads.forEach((payload) => {
      handleIncomingCodexPayload(payload);
    });
    persistStoredCodexPayloads([]);

    const handleWindowContext = (event: Event) => {
      const customEvent = event as CustomEvent<CodexContextPayload>;
      handleIncomingCodexPayload(customEvent.detail);
      removeStoredCodexPayload(customEvent.detail?.id);
    };

    window.addEventListener(CODEX_CONTEXT_EVENT_NAME, handleWindowContext as EventListener);

    // Listen for CDP Runtime.consoleAPICalled events from the connected device
    const handleDebugMessage = (payload: any) => {
      try {
        // Payload structure: { data: { data: { client_id, session_id, method?, params?, message?: { method, params } } } }
        const wrapper = payload?.data ?? payload;
        const msgData = wrapper?.data ?? wrapper;
        const method = msgData?.method ?? msgData?.message?.method;
        const params = msgData?.params ?? msgData?.message?.params;

        if (method === 'Runtime.consoleAPICalled' && params?.type === 'error') {
          const args = (params.args ?? []) as Array<{ type: string; value?: string; description?: string }>;
          const errorText = args
            .map((a) => a.value ?? a.description ?? '')
            .filter(Boolean)
            .join(' ');
          if (errorText) {
            const updated = [errorText, ...consoleErrorsRef.current].slice(0, 5);
            consoleErrorsRef.current = updated;
            setConsoleErrors(updated);
          }
        }
      } catch (_) {
        // ignore parse errors
      }
    };

    if (debugDriver) {
      (debugDriver as any).on(ERemoteDebugDriverExternalEvent.All, handleDebugMessage);
    }

    return () => {
      if (debugDriver) {
        (debugDriver as any).off(ERemoteDebugDriverExternalEvent.All, handleDebugMessage);
      }
      removePluginEventListener('codex:send_context', handlePluginContext);
      window.removeEventListener(CODEX_CONTEXT_EVENT_NAME, handleWindowContext as EventListener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addPluginEventListener, asyncBridge, debugDriver, handleIncomingCodexPayload, removePluginEventListener, removeStoredCodexPayload]);

  useEffect(() => {
    localStorage.setItem(CODEX_PROJECT_PATH_STORAGE_KEY, projectPath);
  }, [projectPath]);

  useEffect(() => {
    localStorage.setItem(CODEX_APPROVAL_POLICY_STORAGE_KEY, approvalPolicy);
  }, [approvalPolicy]);

  useEffect(() => {
    persistConversationHistory(conversationHistory);
  }, [conversationHistory]);

  useEffect(() => {
    if (client.entries.length === 0) {
      return;
    }

    setCurrentConversationUpdatedAt(Date.now());
  }, [client.entries]);

  // ─── Open directory dialog ────────────────────────────────────────────────

  const handlePickDirectory = useCallback(async () => {
    try {
      const response = await (window as any).ldtElectronAPI?.invoke('dialog:openDirectory');
      const result = response?.code === 0 ? response.data : response;
      if (typeof result === 'string' && result) {
        setProjectPath(result);
      } else if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'string') {
        setProjectPath(result[0]);
      }
    } catch (_) {
      // Falls back to manual input — no need to surface error
    }
  }, []);

  // ─── Message sending ──────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const text = composeOutgoingPrompt(contextAttachments, inputText);
    if (!text || client.status === 'thinking' || pendingSend || selectedHistoryConversationId) {
      return;
    }

    if (client.status === 'ready') {
      client.sendMessage(text);
      setInputText('');
      setContextAttachments([]);
      return;
    }

    const nextPendingSend: PendingSend = {
      text,
      inputText,
      attachments: contextAttachments
    };

    setPendingSend(nextPendingSend);
    setInputText('');
    setContextAttachments([]);

    void ensureConnectionForSend(projectPath, approvalPolicy).then((connected) => {
      if (connected) {
        return;
      }

      setPendingSend((current) => (current?.text === nextPendingSend.text ? null : current));
      setInputText((current) => (current.length === 0 ? nextPendingSend.inputText : current));
      setContextAttachments((current) =>
        current.length === 0 ? nextPendingSend.attachments : current
      );
    });
  }, [
    approvalPolicy,
    client.sendMessage,
    client.status,
    contextAttachments,
    ensureConnectionForSend,
    inputText,
    pendingSend,
    projectPath,
    selectedHistoryConversationId
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleAddConsoleError = useCallback(
    (errorText: string) => {
      const payload: CodexContextPayload = {
        id: createContextAttachmentId(),
        label: 'Console error',
        source: 'console-error',
        text: ['Console error context', '', 'Message text:', '```text', errorText, '```'].join('\n'),
        createdAt: Date.now()
      };
      appendIncomingContext(payload);
    },
    [appendIncomingContext]
  );

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setContextAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  }, []);

  const archiveActiveConversation = useCallback(() => {
    const snapshot = buildConversationHistoryItem(activeConversationId, client.entries);
    if (!snapshot) {
      return;
    }

    setConversationHistory((prev) => upsertConversationHistory(prev, snapshot));
  }, [activeConversationId, client.entries]);

  const handleStartNewConversation = useCallback(() => {
    archiveActiveConversation();
    client.disconnect();
    setActiveConversationId(createConversationId());
    setSelectedHistoryConversationId(null);
    setCurrentConversationUpdatedAt(null);
    setInputText('');
    setContextAttachments([]);
    setPendingSend(null);
    setServerError('');
  }, [archiveActiveConversation, client.disconnect]);

  const handleSelectCurrentConversation = useCallback(() => {
    setSelectedHistoryConversationId(null);
  }, []);

  const handleSelectHistoryConversation = useCallback((conversationId: string) => {
    setSelectedHistoryConversationId(conversationId);
  }, []);

  useEffect(() => {
    if (!pendingSend || client.status !== 'ready') {
      return;
    }

    client.sendMessage(pendingSend.text);
    setPendingSend(null);
  }, [client.sendMessage, client.status, pendingSend]);

  useEffect(() => {
    if (!pendingSend || (client.status !== 'error' && serverStatus !== 'error')) {
      return;
    }

    setInputText((current) => (current.length === 0 ? pendingSend.inputText : current));
    setContextAttachments((current) => (current.length === 0 ? pendingSend.attachments : current));
    setPendingSend(null);
  }, [client.status, pendingSend, serverStatus]);

  const selectedHistoryConversation = conversationHistory.find(
    (conversation) => conversation.id === selectedHistoryConversationId
  ) ?? null;
  const isViewingArchivedConversation = selectedHistoryConversation !== null;
  const displayedEntries = selectedHistoryConversation?.entries ?? client.entries;

  // ─── Styles ───────────────────────────────────────────────────────────────

  const rootStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  };

  const contentLayoutStyle: CSSProperties = {
    display: 'flex',
    flex: 1,
    minHeight: 0
  };

  const mainPanelStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderBottom: '1px solid #f0f0f0',
    background: '#fafafa',
    flexShrink: 0
  };

  const toolbarStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderBottom: '1px solid #f0f0f0',
    flexShrink: 0
  };

  const inputAreaStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 12px',
    borderTop: '1px solid #f0f0f0',
    flexShrink: 0
  };

  const inputRowStyle: CSSProperties = {
    display: 'flex',
    gap: 6,
    alignItems: 'flex-end'
  };

  const sendColumnStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: 160,
    flexShrink: 0
  };

  const archivedConversationNoticeStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 12px',
    borderTop: '1px solid #f0f0f0',
    background: '#fafafa',
    flexShrink: 0
  };

  const hasDraft = inputText.trim().length > 0 || contextAttachments.length > 0;
  const canSend =
    hasDraft && client.status !== 'thinking' && !pendingSend && !isViewingArchivedConversation;
  const canStop = client.status === 'thinking';
  const isConnected =
    client.status !== 'disconnected' && client.status !== 'error';
  const approvalLocked =
    client.status === 'connecting' ||
    client.status === 'initializing' ||
    client.status === 'ready' ||
    client.status === 'thinking';

  const composerStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '8px 11px',
    border: '1px solid #d9d9d9',
    borderRadius: 6,
    background: isConnected ? '#fff' : '#fafafa'
  };

  const attachmentRowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6
  };

  const inputLabelStyle: CSSProperties = {
    fontSize: 12,
    color: '#8c8c8c',
    lineHeight: 1
  };

  const approvalLabelStyle: CSSProperties = {
    fontSize: 11,
    color: '#595959',
    lineHeight: 1.2
  };

  const approvalHintStyle: CSSProperties = {
    fontSize: 10,
    color: '#8c8c8c',
    lineHeight: 1.3
  };

  const currentConversationSummary =
    client.entries.length > 0
      ? summarizeConversation(client.entries)
      : {
          title: hasDraft
            ? truncateText(firstMeaningfulLine(inputText) || 'Current conversation', 48)
            : 'Current conversation',
          preview: hasDraft
            ? truncateText(
                firstMeaningfulLine(inputText) ||
                  `${contextAttachments.length} context attachment${contextAttachments.length === 1 ? '' : 's'} ready to send.`,
                84
              )
            : 'Ready for a new prompt.'
        };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={rootStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <RobotOutlined style={{ fontSize: 18, color: '#1677ff' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Codex Agent</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColor(client.status),
              display: 'inline-block'
            }}
          />
          <Text style={{ fontSize: 12, color: '#666' }}>{statusLabel(client.status)}</Text>
        </div>
      </div>
      <div style={contentLayoutStyle}>
        <ConversationSidebar
          currentTitle={currentConversationSummary.title}
          currentPreview={currentConversationSummary.preview}
          currentUpdatedAt={currentConversationUpdatedAt}
          historyItems={conversationHistory}
          selectedHistoryId={selectedHistoryConversationId}
          onSelectCurrent={handleSelectCurrentConversation}
          onSelectHistory={handleSelectHistoryConversation}
          onStartNewConversation={handleStartNewConversation}
        />

        <div style={mainPanelStyle}>
          {/* Toolbar */}
          <div style={toolbarStyle}>
            <Space.Compact style={{ flex: 1, minWidth: 160 }}>
              <Input
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="Project path (e.g. /Users/you/my-app)"
                size="small"
                style={{ fontSize: 12 }}
                disabled={serverStatus === 'starting'}
              />
              <Tooltip title="Choose directory">
                <Button
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={handlePickDirectory}
                  disabled={serverStatus === 'starting'}
                />
              </Tooltip>
            </Space.Compact>
          </div>

          {!codexFound && (
            <Alert
              type="warning"
              showIcon
              banner
              message="Codex CLI not found. Install it with: npm install -g @openai/codex"
              style={{ flexShrink: 0 }}
            />
          )}
          {serverError && (
            <Alert
              type="error"
              showIcon
              banner
              closable
              message={serverError}
              onClose={() => setServerError('')}
              style={{ flexShrink: 0 }}
            />
          )}
          {client.error && (
            <Alert
              type="error"
              showIcon
              banner
              closable
              message={client.error}
              style={{ flexShrink: 0 }}
            />
          )}
          {isViewingArchivedConversation && (
            <Alert
              type="info"
              banner
              showIcon
              message="Viewing an archived conversation snapshot. Select Current or start a new conversation to chat again."
              style={{ flexShrink: 0 }}
            />
          )}

          <MessageList
            entries={displayedEntries}
            emptyStateText={
              isViewingArchivedConversation
                ? 'No messages were captured for this archived conversation.'
                : 'Start a conversation with Codex'
            }
          />

          {!isViewingArchivedConversation && consoleErrors.length > 0 && (
            <div style={{ flexShrink: 0, borderTop: '1px solid #f0f0f0' }}>
              <Collapse
                size="small"
                items={[
                  {
                    key: 'console-errors',
                    label: (
                      <Space>
                        <WarningOutlined style={{ color: '#faad14' }} />
                        <Text style={{ fontSize: 12 }}>
                          Console Errors ({consoleErrors.length})
                        </Text>
                      </Space>
                    ),
                    children: (
                      <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                        {consoleErrors.map((err, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 6,
                              padding: '3px 0',
                              borderBottom: i < consoleErrors.length - 1 ? '1px solid #f5f5f5' : 'none'
                            }}
                          >
                            <Text
                              style={{
                                flex: 1,
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: '#d32f2f',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all'
                              }}
                              ellipsis={{ rows: 2, tooltip: err }}
                            >
                              {err}
                            </Text>
                            <Tooltip title="Add to chat">
                              <Button
                                type="text"
                                size="small"
                                icon={<PlusCircleOutlined />}
                                onClick={() => handleAddConsoleError(err)}
                                style={{ flexShrink: 0 }}
                              />
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    )
                  }
                ]}
              />
            </div>
          )}

          {isViewingArchivedConversation ? (
            <div style={archivedConversationNoticeStyle}>
              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                Archived conversations are read-only snapshots.
              </Text>
              <Space size={8}>
                <Button size="small" onClick={handleSelectCurrentConversation}>
                  Back to current
                </Button>
                <Button size="small" type="primary" onClick={handleStartNewConversation}>
                  New conversation
                </Button>
              </Space>
            </div>
          ) : (
            <div style={inputAreaStyle}>
              <div style={inputRowStyle}>
                <div style={composerStyle}>
                  {contextAttachments.length > 0 && (
                    <div style={attachmentRowStyle}>
                      {contextAttachments.map((attachment) => (
                        <Tooltip key={attachment.id} title={attachment.label}>
                          <Tag
                            closable
                            onClose={(event) => {
                              event.preventDefault();
                              handleRemoveAttachment(attachment.id);
                            }}
                            style={{ marginInlineEnd: 0, maxWidth: '100%' }}
                          >
                            {attachment.label}
                          </Tag>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                  <Text style={inputLabelStyle}>User input:</Text>
                  <TextArea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      pendingSend
                        ? 'Connecting to Codex…'
                        : !isConnected
                          ? 'Click Send to connect to Codex and start chatting.'
                          : ''
                    }
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    bordered={false}
                    style={{ flex: 1, padding: 0, fontSize: 13, resize: 'none', background: 'transparent' }}
                  />
                </div>
                <div style={sendColumnStyle}>
                  <Tooltip title="Controls when Codex should ask you to approve terminal commands or file edits.">
                    <Text style={approvalLabelStyle}>Approval for commands / edits</Text>
                  </Tooltip>
                  <Select
                    value={approvalPolicy}
                    onChange={setApprovalPolicy}
                    size="small"
                    style={{ width: '100%', fontSize: 12 }}
                    disabled={approvalLocked}
                    options={[
                      { value: 'on-failure', label: 'Ask only if blocked' },
                      { value: 'on-request', label: 'Ask before actions' },
                      { value: 'never', label: 'Never ask' }
                    ]}
                  />
                  <Text style={approvalHintStyle}>
                    Controls whether Codex asks before terminal commands or file edits. Applies on
                    the next start or reconnect.
                  </Text>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    loading={Boolean(pendingSend)}
                    disabled={!canSend}
                    style={{ width: 68 }}
                  >
                    Send
                  </Button>
                  {canStop && (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={() => client.interrupt()}
                      style={{ width: 68 }}
                    >
                      Stop
                    </Button>
                  )}
                </div>
              </div>
              {consoleErrors.length > 0 && (
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusCircleOutlined />}
                  onClick={() => handleAddConsoleError(consoleErrors[0])}
                  style={{ alignSelf: 'flex-start', fontSize: 11 }}
                >
                  Attach latest console error
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Approval dialog */}
      <ApprovalDialog
        approval={client.pendingApproval}
        onApprove={() => client.respondToApproval('approved')}
        onDeny={() => client.respondToApproval('denied')}
      />

      {/* Blinking cursor keyframes */}
      <style>{`
        @keyframes codex-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
