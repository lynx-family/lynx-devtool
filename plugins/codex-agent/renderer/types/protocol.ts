// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// ─── File Change Types ───────────────────────────────────────────────────────

export type FileChangeAdd = {
  type: 'add';
  content: string;
};

export type FileChangeDelete = {
  type: 'delete';
  content: string;
};

export type FileChangeUpdate = {
  type: 'update';
  unified_diff: string;
  content?: string;
};

export type FileChange = FileChangeAdd | FileChangeDelete | FileChangeUpdate;

// ─── Server → Client Event Messages ──────────────────────────────────────────

export type SessionConfiguredEvent = {
  type: 'session_configured';
  session_id: string;
  model: string;
  cwd: string;
  [key: string]: unknown;
};

export type TaskStartedEvent = {
  type: 'task_started';
  turn_id: string;
};

export type TaskCompleteEvent = {
  type: 'task_complete';
  turn_id: string;
};

export type AgentMessageContentDeltaEvent = {
  type: 'agent_message_content_delta';
  item_id: string;
  turn_id: string;
  delta: string;
};

export type ExecCommandBeginEvent = {
  type: 'exec_command_begin';
  call_id: string;
  command: string[];
  cwd: string;
};

export type ExecCommandOutputDeltaEvent = {
  type: 'exec_command_output_delta';
  call_id: string;
  data: string;
};

export type ExecCommandEndEvent = {
  type: 'exec_command_end';
  call_id: string;
  exit_code: number;
};

export type PatchApplyBeginEvent = {
  type: 'patch_apply_begin';
  call_id: string;
  changes: Record<string, FileChange>;
  auto_approved: boolean;
};

export type PatchApplyEndEvent = {
  type: 'patch_apply_end';
  call_id: string;
  status: string;
};

export type TurnAbortedEvent = {
  type: 'turn_aborted';
};

export type ErrorEvent = {
  type: 'error';
  message: string;
};

export type EventMsg =
  | SessionConfiguredEvent
  | TaskStartedEvent
  | TaskCompleteEvent
  | AgentMessageContentDeltaEvent
  | ExecCommandBeginEvent
  | ExecCommandOutputDeltaEvent
  | ExecCommandEndEvent
  | PatchApplyBeginEvent
  | PatchApplyEndEvent
  | TurnAbortedEvent
  | ErrorEvent;

// ─── Server → Client Request Messages (need response) ────────────────────────

export type ApplyPatchApprovalParams = {
  callId: string;
  fileChanges: Record<string, FileChange>;
  reason?: string;
};

export type ExecCommandApprovalParams = {
  callId: string;
  command: string[];
  cwd: string;
  reason?: string;
};

export type ApplyPatchApprovalRequest = {
  method: 'applyPatchApproval';
  id: string | number;
  params: ApplyPatchApprovalParams;
};

export type ExecCommandApprovalRequest = {
  method: 'execCommandApproval';
  id: string | number;
  params: ExecCommandApprovalParams;
};

export type ServerRequestMsg = ApplyPatchApprovalRequest | ExecCommandApprovalRequest;

// ─── Chat Entry Types ─────────────────────────────────────────────────────────

export type TextEntry = {
  kind: 'text';
  role: 'user' | 'assistant';
  content: string;
  streaming: boolean;
  itemId?: string;
};

export type ToolEntry = {
  kind: 'tool';
  toolType: 'exec' | 'patch';
  title: string;
  status: 'running' | 'done' | 'error';
  callId: string;
  output?: string;
  exitCode?: number;
  fileChanges?: Record<string, FileChange>;
};

export type ChatEntry = TextEntry | ToolEntry;

export type ConversationHistoryItem = {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  entries: ChatEntry[];
};

// ─── Approval State ───────────────────────────────────────────────────────────

export type ApprovalRequestFlavor =
  | 'legacy-patch'
  | 'legacy-exec'
  | 'v2-patch'
  | 'v2-exec';

export type PatchDetails = {
  itemId?: string;
  threadId?: string;
  turnId?: string;
  fileChanges?: Record<string, FileChange>;
  reason?: string;
  grantRoot?: string;
};

export type ExecDetails = {
  itemId?: string;
  threadId?: string;
  turnId?: string;
  approvalId?: string | null;
  command?: string[] | string;
  cwd?: string;
  reason?: string;
};

export type PendingApproval = {
  requestId: string | number;
  type: 'patch' | 'exec';
  isServerRequest: boolean;
  requestFlavor: ApprovalRequestFlavor;
  details: PatchDetails | ExecDetails;
};

// ─── Connection & Policy ──────────────────────────────────────────────────────

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'initializing'
  | 'ready'
  | 'thinking'
  | 'error';

export type ApprovalPolicy = 'on-failure' | 'on-request' | 'never';
