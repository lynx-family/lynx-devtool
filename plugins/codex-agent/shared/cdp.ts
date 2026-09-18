// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const CDP_PROXY_EVENT_NAME = 'codex:cdp_proxy_call';
export const CDP_PROXY_MCP_SERVER_NAME = 'lynx-cdp-proxy';
export const CDP_PROXY_SKILL_NAME = 'lynx-cdp-bootstrap';
export const CDP_PROXY_HTTP_PATH = '/rpc';
export const CDP_PROXY_ENV_URL = 'LDT_CDP_PROXY_URL';
export const CDP_PROXY_ENV_TOKEN = 'LDT_CDP_PROXY_TOKEN';

export type CdpTargetKind = 'lynx-runtime';

export type CdpSessionDescriptor = {
  clientId: number;
  sessionId: number;
  targetKind: CdpTargetKind;
  sessionType: string;
  url: string;
  engineType?: string;
  targetIds?: string[];
  selected: boolean;
  device: {
    appId?: string;
    appName?: string;
    appVersion?: string;
    debugRouterId?: string;
    deviceModel?: string;
    network?: string;
    osType?: string;
    osVersion?: string;
    sdkVersion?: string;
  };
};

export type CdpListSessionsResult = {
  sessions: CdpSessionDescriptor[];
  selectedClientId: number | null;
  selectedSessionId: number | null;
};

export type CdpActiveTargetResult = {
  selectedClientId: number | null;
  selectedSessionId: number | null;
  session: CdpSessionDescriptor | null;
};

export type CdpSendMessageResult = {
  clientId: number;
  sessionId: number;
  targetKind: CdpTargetKind;
  method: string;
  result: unknown;
};

export type CdpProxyRequest =
  | {
      action: 'list_sessions';
      clientId?: number;
    }
  | {
      action: 'get_active_target';
    }
  | {
      action: 'send_cdp';
      clientId?: number;
      sessionId?: number;
      method: string;
      params?: Record<string, unknown>;
      timeoutMs?: number;
    };

export type CdpProxyResponse =
  | {
      ok: true;
      data: CdpListSessionsResult | CdpActiveTargetResult | CdpSendMessageResult;
    }
  | {
      ok: false;
      error: string;
    };

export type CdpIntegrationConfig = {
  enabled: boolean;
  error?: string;
  mcpServerName: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  skillName?: string;
  skillPath?: string;
  developerInstructions?: string;
};

export function buildCdpDeveloperInstructions(serverName: string): string {
  return [
    `A local MCP server named "${serverName}" is configured for this thread.`,
    'The target is a Lynx runtime session from Lynx DevTool, not the desktop DevTool web page.',
    'Call `get_supported_cdp_protocols` when you need the current Lynx CDP support matrix.',
    'Use `send_cdp` as the CDP entry point.',
    'For a small set of known methods, `send_cdp` may also return an adapted summary alongside the raw response.',
    'Inspect available sessions first if the target is unclear.'
  ].join(' ');
}

export function buildCdpSkillMarkdown(serverName: string): string {
  return [
    '# lynx-cdp-bootstrap',
    '',
    `This session includes a local MCP server named \`${serverName}\` for Chrome DevTools Protocol access through the active Lynx DevTool connection.`,
    'The target is a Lynx runtime session on a device, not the desktop DevTool web page.',
    '',
    'Use it only when CDP access is actually needed.',
    '',
    'Recommended flow:',
    '1. Call `get_active_target` if the default target is probably correct.',
    '2. Call `list_sessions` when the target or session is ambiguous.',
    '3. Call `get_supported_cdp_protocols` when you need to know the current Lynx CDP support matrix.',
    '4. Call `send_cdp` for CDP methods.',
    '5. Pass explicit `clientId` and `sessionId` when operating on a non-default session.',
    '',
    'Guidelines:',
    '- Prefer read-only CDP methods unless the user clearly asked for a mutation.',
    '- Do not assume browser globals such as `document` or `window` exist unless `Runtime.evaluate` proves they do in the selected Lynx runtime session.',
    '- If `send_cdp` fails because no active session exists, inspect `list_sessions` and explain what is missing.',
    '- `get_supported_cdp_protocols` describes the current known support matrix for Lynx runtime CDP methods.',
    '- For some known methods, `send_cdp` may include an adapted summary in addition to the raw CDP response.',
    '- Include the CDP method name you used in your explanation when it matters.'
  ].join('\n');
}
