// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  CDP_PROXY_ENV_TOKEN,
  CDP_PROXY_ENV_URL,
  CdpActiveTargetResult,
  CdpListSessionsResult,
  CdpProxyRequest,
  CdpProxyResponse,
  CdpSendMessageResult
} from '../shared/cdp';
import { inflateSync } from 'node:zlib';

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: any;
};

const SERVER_NAME = 'lynx-cdp-proxy';
const SERVER_VERSION = '0.1.0';
const FALLBACK_PROTOCOL_VERSION = '2025-06-18';
const proxyUrl = process.env[CDP_PROXY_ENV_URL];
const proxyToken = process.env[CDP_PROXY_ENV_TOKEN];
const HEADER_DELIMITER = Buffer.from('\r\n\r\n');
const ALT_HEADER_DELIMITER = Buffer.from('\n\n');

let stdinBuffer = Buffer.alloc(0);
let processingQueue = Promise.resolve();

function writeMessage(payload: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function writeResult(id: JsonRpcId, result: unknown) {
  writeMessage({
    jsonrpc: '2.0',
    id,
    result
  });
}

function writeError(id: JsonRpcId, code: number, message: string) {
  writeMessage({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message
    }
  });
}

function buildTextContent(value: unknown) {
  return [
    {
      type: 'text',
      text: JSON.stringify(value, null, 2)
    }
  ];
}

function toolResult(result: unknown, contentValue: unknown = result) {
  return {
    content: buildTextContent(contentValue),
    structuredContent: result as Record<string, unknown>
  };
}

function toolError(message: string) {
  return {
    content: [{ type: 'text', text: message }],
    isError: true
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toNumberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toBooleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function toNodeArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => toRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

function normalizeAttributeMap(value: unknown): Record<string, string> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const attributes: Record<string, string> = {};
  for (let index = 0; index < value.length; index += 2) {
    const name = toStringValue(value[index]);
    if (!name) {
      continue;
    }
    const rawAttributeValue = value[index + 1];
    const normalizedValue =
      typeof rawAttributeValue === 'string' ? rawAttributeValue : String(rawAttributeValue ?? '');
    attributes[name] =
      normalizedValue.length > 160
        ? `${normalizedValue.slice(0, 120)}... [truncated ${normalizedValue.length} chars]`
        : normalizedValue;
  }

  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

function decodeCompressedDomRoot(value: string): Record<string, unknown> | null {
  try {
    const inflated = inflateSync(Buffer.from(value, 'base64')).toString('utf8');
    return toRecord(JSON.parse(inflated));
  } catch (_) {
    return null;
  }
}

function extractDirectTextPreview(children: Record<string, unknown>[]): string | undefined {
  const text = children
    .filter((child) => toNumberValue(child.nodeType) === 3)
    .map((child) => toStringValue(child.nodeValue)?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
    .trim();

  return text || undefined;
}

function parseCdpError(rawResponse: unknown) {
  const responseRecord = toRecord(rawResponse);
  const errorRecord = toRecord(responseRecord?.error);
  if (!errorRecord) {
    return null;
  }

  return {
    code: toNumberValue(errorRecord.code),
    message: toStringValue(errorRecord.message) ?? 'CDP request failed.',
    data: errorRecord.data ?? null
  };
}

function extractCdpRawResult(rawResponse: unknown) {
  const responseRecord = toRecord(rawResponse);
  if (responseRecord && Object.prototype.hasOwnProperty.call(responseRecord, 'result')) {
    return responseRecord.result;
  }
  return rawResponse;
}

function buildWrappedMethodResult(
  response: CdpSendMessageResult,
  params: Record<string, unknown>,
  normalized: unknown
) {
  const error = parseCdpError(response.result);
  return {
    target: {
      clientId: response.clientId,
      sessionId: response.sessionId,
      targetKind: response.targetKind
    },
    cdp: {
      method: response.method,
      params,
      rawResult: error ? null : extractCdpRawResult(response.result),
      error
    },
    normalized
  };
}

const KNOWN_LYNX_CDP_PROTOCOL_SUPPORT = {
  targetKind: 'lynx-runtime',
  protocolFamily: 'standard-web-cdp-intersection',
  source: 'proxy-manifest',
  generatedAt: '2026-04-03',
  domains: [
    {
      name: 'Runtime',
      support: 'known-partial',
      methods: [
        {
          name: 'evaluate',
          status: 'supported',
          notes: [
            'Usable through send_cdp.',
            'returnByValue does not guarantee a plain JSON value on Lynx targets; RemoteObject/objectId may still be returned.'
          ]
        }
      ]
    },
    {
      name: 'DOM',
      support: 'known-partial',
      methods: [
        {
          name: 'getDocument',
          status: 'supported-with-notes',
          notes: [
            'Usable through send_cdp.',
            'Some Lynx targets return compress=true with a compressed root string instead of a normal nested DOM node tree.',
            'The proxy attempts to decode base64+zlib compressed root payloads into a normal node tree before adapting the result.'
          ]
        }
      ]
    },
    {
      name: 'Schema',
      support: 'known-partial',
      methods: [
        {
          name: 'getDomains',
          status: 'unsupported',
          notes: ['Observed on current Lynx runtime targets as -32601 Not implemented.']
        }
      ]
    }
  ],
  passthroughPolicy: {
    tool: 'send_cdp',
    defaultStatus: 'unknown',
    notes: [
      'Other standard Web CDP methods can still be attempted through send_cdp.',
      'Actual support is target-dependent and not guaranteed unless listed above.'
    ]
  }
} as const;

function adaptKnownCdpMethod(method: string, rawResult: unknown) {
  switch (method) {
    case 'Schema.getDomains':
      return {
        method,
        normalized: normalizeSchemaDomains(rawResult)
      };
    case 'DOM.getDocument':
      return {
        method,
        normalized: normalizeDocumentResult(rawResult)
      };
    case 'Runtime.evaluate':
      return {
        method,
        normalized: normalizeEvaluateResult(rawResult)
      };
    default:
      return null;
  }
}

function normalizeSchemaDomains(rawResult: unknown) {
  const resultRecord = toRecord(rawResult);
  const domains = Array.isArray(resultRecord?.domains) ? resultRecord.domains : [];
  return {
    domains: domains
      .map((domain) => {
        const domainRecord = toRecord(domain);
        const name = toStringValue(domainRecord?.name);
        if (!name) {
          return null;
        }

        return {
          name,
          version: toStringValue(domainRecord?.version)
        };
      })
      .filter(Boolean)
  };
}

function normalizeEvaluateResult(rawResult: unknown) {
  const resultRecord = toRecord(rawResult);
  const remoteObject = toRecord(resultRecord?.result);

  return {
    result: remoteObject
      ? {
          type: toStringValue(remoteObject.type),
          subtype: toStringValue(remoteObject.subtype),
          className: toStringValue(remoteObject.className),
          description: toStringValue(remoteObject.description),
          value: remoteObject.value ?? null,
          unserializableValue: toStringValue(remoteObject.unserializableValue),
          objectId: toStringValue(remoteObject.objectId),
          preview: remoteObject.preview ?? null
        }
      : null,
    exceptionDetails: resultRecord?.exceptionDetails ?? null
  };
}

function normalizeDocumentResult(rawResult: unknown) {
  const resultRecord = toRecord(rawResult);
  const compressed = toBooleanValue(resultRecord?.compress) ?? false;
  const compressedRoot = toStringValue(resultRecord?.root);
  const decodedCompressedRoot = compressedRoot ? decodeCompressedDomRoot(compressedRoot) : null;

  if ((compressed || compressedRoot !== null) && !decodedCompressedRoot) {
    return {
      supported: false,
      rootNodeId: null,
      totalNodeCount: 0,
      nodes: [],
      compression: {
        enabled: compressed || compressedRoot !== null,
        rootEncoding: compressedRoot !== null ? 'string' : 'unknown',
        rootLength: compressedRoot?.length ?? null,
        rootPreview: compressedRoot ? compressedRoot.slice(0, 120) : null,
        reason:
          'The selected Lynx runtime returned a compressed DOM payload. The wrapper cannot flatten this payload into a node list yet.'
      }
    };
  }

  const rootNode = decodedCompressedRoot ?? toRecord(resultRecord?.root) ?? resultRecord;
  const nodes: Array<Record<string, unknown>> = [];

  const visit = (
    node: Record<string, unknown>,
    depth: number,
    parentNodeId: number | null,
    relation: string
  ) => {
    const nodeId = toNumberValue(node.nodeId);
    const children = toNodeArray(node.children);
    const childNodeIds = children
      .map((child) => toNumberValue(child.nodeId))
      .filter((value): value is number => value !== null);

    nodes.push({
      nodeId,
      backendNodeId: toNumberValue(node.backendNodeId),
      parentNodeId,
      depth,
      relation,
      nodeType: toNumberValue(node.nodeType),
      nodeName: toStringValue(node.nodeName),
      localName: toStringValue(node.localName),
      nodeValue: toStringValue(node.nodeValue),
      childNodeCount: toNumberValue(node.childNodeCount),
      attributes: normalizeAttributeMap(node.attributes),
      childNodeIds: childNodeIds.length > 0 ? childNodeIds : undefined,
      textPreview: extractDirectTextPreview(children),
      pseudoType: toStringValue(node.pseudoType),
      shadowRootType: toStringValue(node.shadowRootType)
    });

    children.forEach((child) => visit(child, depth + 1, nodeId, 'child'));
    toNodeArray(node.shadowRoots).forEach((child) =>
      visit(child, depth + 1, nodeId, 'shadowRoot')
    );
    toNodeArray(node.pseudoElements).forEach((child) =>
      visit(child, depth + 1, nodeId, 'pseudoElement')
    );

    const contentDocument = toRecord(node.contentDocument);
    if (contentDocument) {
      visit(contentDocument, depth + 1, nodeId, 'contentDocument');
    }

    const templateContent = toRecord(node.templateContent);
    if (templateContent) {
      visit(templateContent, depth + 1, nodeId, 'templateContent');
    }

    const importedDocument = toRecord(node.importedDocument);
    if (importedDocument) {
      visit(importedDocument, depth + 1, nodeId, 'importedDocument');
    }
  };

  if (rootNode) {
    visit(rootNode, 0, null, 'root');
  }

  return {
    supported: true,
    rootNodeId: toNumberValue(rootNode?.nodeId),
    totalNodeCount: nodes.length,
    nodes,
    compression:
      compressed || compressedRoot !== null
        ? {
            enabled: true,
            rootEncoding: 'base64+zlib+json',
            rootLength: compressedRoot?.length ?? null,
            decoded: true
          }
        : undefined
  };
}

function getTargetArgs(args: Record<string, unknown> | undefined) {
  return {
    clientId: typeof args?.clientId === 'number' ? args.clientId : undefined,
    sessionId: typeof args?.sessionId === 'number' ? args.sessionId : undefined,
    timeoutMs: typeof args?.timeoutMs === 'number' ? args.timeoutMs : undefined
  };
}

async function invokeWrappedCdpMethod(
  method: string,
  params: Record<string, unknown>,
  args: Record<string, unknown> | undefined,
  normalize: (rawResult: unknown) => unknown
) {
  const targetArgs = getTargetArgs(args);
  const response = await callProxy({
    action: 'send_cdp',
    method,
    params,
    clientId: targetArgs.clientId,
    sessionId: targetArgs.sessionId,
    timeoutMs: targetArgs.timeoutMs
  });

  if (!response.ok) {
    return toolError(response.error);
  }

  const payload = response.data as CdpSendMessageResult;
  const error = parseCdpError(payload.result);
  const wrappedResult = buildWrappedMethodResult(
    payload,
    params,
    error ? null : normalize(extractCdpRawResult(payload.result))
  );

  return toolResult(wrappedResult, {
    target: wrappedResult.target,
    cdp: {
      method: wrappedResult.cdp.method,
      params: wrappedResult.cdp.params,
      error: wrappedResult.cdp.error,
      rawResultIncludedInStructuredContent: wrappedResult.cdp.rawResult !== null
    },
    normalized: wrappedResult.normalized
  });
}

function trimLeadingControlBytes(buffer: Buffer): Buffer {
  let offset = 0;
  while (offset < buffer.length) {
    const current = buffer[offset];
    if (current !== 0x0a && current !== 0x0d && current !== 0x09 && current !== 0x20) {
      break;
    }
    offset += 1;
  }

  return offset > 0 ? buffer.subarray(offset) : buffer;
}

function looksLikeHeaderFramedMessage(buffer: Buffer): boolean {
  const prefix = buffer.toString('utf-8', 0, Math.min(buffer.length, 128));
  return /^content-length\s*:/i.test(prefix);
}

function parseContentLength(headersText: string): number {
  const contentLengthHeader = headersText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^content-length\s*:/i.test(line));

  if (!contentLengthHeader) {
    throw new Error('Missing Content-Length header.');
  }

  const rawValue = contentLengthHeader.replace(/^content-length\s*:/i, '').trim();
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid Content-Length value: ${rawValue || '<empty>'}`);
  }

  return parsed;
}

function tryReadHeaderFramedMessage(buffer: Buffer): {
  message?: JsonRpcRequest;
  rest: Buffer;
  needsMoreData: boolean;
} {
  const primaryDelimiterIndex = buffer.indexOf(HEADER_DELIMITER);
  const alternateDelimiterIndex = buffer.indexOf(ALT_HEADER_DELIMITER);
  const usePrimaryDelimiter =
    primaryDelimiterIndex !== -1 &&
    (alternateDelimiterIndex === -1 || primaryDelimiterIndex <= alternateDelimiterIndex);
  const delimiterIndex = usePrimaryDelimiter ? primaryDelimiterIndex : alternateDelimiterIndex;

  if (delimiterIndex === -1) {
    return {
      rest: buffer,
      needsMoreData: true
    };
  }

  const delimiterLength = usePrimaryDelimiter
    ? HEADER_DELIMITER.length
    : ALT_HEADER_DELIMITER.length;
  const headersText = buffer.toString('utf-8', 0, delimiterIndex);
  const contentLength = parseContentLength(headersText);
  const bodyStart = delimiterIndex + delimiterLength;
  const bodyEnd = bodyStart + contentLength;

  if (buffer.length < bodyEnd) {
    return {
      rest: buffer,
      needsMoreData: true
    };
  }

  return {
    message: JSON.parse(buffer.toString('utf-8', bodyStart, bodyEnd)) as JsonRpcRequest,
    rest: buffer.subarray(bodyEnd),
    needsMoreData: false
  };
}

function tryReadLineDelimitedMessage(buffer: Buffer): {
  message?: JsonRpcRequest;
  rest: Buffer;
  needsMoreData: boolean;
} {
  const newlineIndex = buffer.indexOf(0x0a);
  if (newlineIndex === -1) {
    return {
      rest: buffer,
      needsMoreData: true
    };
  }

  const line = buffer.toString('utf-8', 0, newlineIndex).trim();
  return {
    message: line ? (JSON.parse(line) as JsonRpcRequest) : undefined,
    rest: buffer.subarray(newlineIndex + 1),
    needsMoreData: false
  };
}

async function callProxy(request: CdpProxyRequest): Promise<CdpProxyResponse> {
  if (!proxyUrl || !proxyToken) {
    return {
      ok: false,
      error: 'CDP proxy endpoint is not configured.'
    };
  }

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${proxyToken}`
    },
    body: JSON.stringify(request)
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      error:
        (payload as { error?: string } | null)?.error ??
        `CDP proxy request failed with status ${response.status}.`
    };
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'ok' in payload &&
    typeof (payload as { ok?: unknown }).ok === 'boolean'
  ) {
    return payload as CdpProxyResponse;
  }

  return {
    ok: false,
    error: 'CDP proxy returned an invalid response.'
  };
}

async function handleToolCall(name: string, args: Record<string, unknown> | undefined) {
  switch (name) {
    case 'list_sessions': {
      const response = await callProxy({
        action: 'list_sessions',
        clientId: typeof args?.clientId === 'number' ? args.clientId : undefined
      });
      if (!response.ok) {
        return toolError(response.error);
      }
      return toolResult(response.data as CdpListSessionsResult);
    }
    case 'get_active_target': {
      const response = await callProxy({
        action: 'get_active_target'
      });
      if (!response.ok) {
        return toolError(response.error);
      }
      return toolResult(response.data as CdpActiveTargetResult);
    }
    case 'get_supported_cdp_protocols': {
      return toolResult(KNOWN_LYNX_CDP_PROTOCOL_SUPPORT);
    }
    case 'send_cdp': {
      const method = typeof args?.method === 'string' ? args.method.trim() : '';
      if (!method) {
        return toolError('`method` is required.');
      }

      const params =
        args?.params && typeof args.params === 'object' && !Array.isArray(args.params)
          ? (args.params as Record<string, unknown>)
          : undefined;
      const response = await callProxy({
        action: 'send_cdp',
        method,
        params,
        clientId: typeof args?.clientId === 'number' ? args.clientId : undefined,
        sessionId: typeof args?.sessionId === 'number' ? args.sessionId : undefined,
        timeoutMs: typeof args?.timeoutMs === 'number' ? args.timeoutMs : undefined
      });

      if (!response.ok) {
        return toolError(response.error);
      }

      const payload = response.data as CdpSendMessageResult;
      const error = parseCdpError(payload.result);
      const rawResult = error ? null : extractCdpRawResult(payload.result);
      const adapted = rawResult === null ? null : adaptKnownCdpMethod(method, rawResult);

      if (!adapted) {
        return toolResult(payload);
      }

      const result = {
        target: {
          clientId: payload.clientId,
          sessionId: payload.sessionId,
          targetKind: payload.targetKind
        },
        cdp: {
          method: payload.method,
          params: params ?? {},
          rawResponse: payload.result,
          rawResult,
          error
        },
        adapted
      };

      return toolResult(result, {
        target: result.target,
        cdp: {
          method: result.cdp.method,
          params: result.cdp.params,
          error: result.cdp.error,
          rawResponseIncludedInStructuredContent: true,
          rawResultIncludedInStructuredContent: result.cdp.rawResult !== null
        },
        adapted: result.adapted
      });
    }
    default:
      return null;
  }
}

function listTools() {
  return {
    tools: [
      {
        name: 'list_sessions',
        title: 'List CDP Sessions',
        description: 'List known Lynx DevTool CDP sessions and highlight the currently selected one.',
        inputSchema: {
          type: 'object',
          properties: {
            clientId: {
              type: 'number',
              description: 'Optional client id filter.'
            }
          }
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true
        }
      },
      {
        name: 'get_active_target',
        title: 'Get Active CDP Target',
        description:
          'Return the currently selected client/session pair in Lynx DevTool for the active Lynx runtime session.',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true
        }
      },
      {
        name: 'send_cdp',
        title: 'Send CDP Message',
        description:
          'Send a raw Chrome DevTools Protocol message to the selected Lynx runtime session or to an explicitly specified client/session. For a small set of known CDP methods, the response may also include an adapted summary alongside the raw response.',
        inputSchema: {
          type: 'object',
          properties: {
            method: {
              type: 'string',
              description: 'CDP method name such as Runtime.evaluate.'
            },
            params: {
              type: 'object',
              description: 'Optional CDP params object.',
              additionalProperties: true
            },
            clientId: {
              type: 'number',
              description: 'Optional explicit client id.'
            },
            sessionId: {
              type: 'number',
              description: 'Optional explicit session id.'
            },
            timeoutMs: {
              type: 'number',
              description: 'Optional timeout override in milliseconds.'
            }
          },
          required: ['method']
        },
        annotations: {
          readOnlyHint: false,
          idempotentHint: false
        }
      },
      {
        name: 'get_supported_cdp_protocols',
        title: 'Get Supported CDP Protocols',
        description:
          'Return the current Lynx runtime CDP support matrix: known supported methods, known unsupported methods, and the passthrough policy for all other standard Web CDP methods.',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true
        }
      }
    ]
  };
}

async function handleRequest(message: JsonRpcRequest) {
  const id = message.id ?? null;
  switch (message.method) {
    case 'initialize':
      writeResult(id, {
        protocolVersion:
          typeof message.params?.protocolVersion === 'string'
            ? message.params.protocolVersion
            : FALLBACK_PROTOCOL_VERSION,
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION
        }
      });
      return;
    case 'notifications/initialized':
      return;
    case 'ping':
      writeResult(id, {});
      return;
    case 'tools/list':
      writeResult(id, listTools());
      return;
    case 'tools/call': {
      const toolName = typeof message.params?.name === 'string' ? message.params.name : '';
      const toolArgs =
        message.params?.arguments &&
        typeof message.params.arguments === 'object' &&
        !Array.isArray(message.params.arguments)
          ? (message.params.arguments as Record<string, unknown>)
          : undefined;
      const result = await handleToolCall(toolName, toolArgs);
      if (!result) {
        writeError(id, -32601, `Unknown tool: ${toolName || 'unknown'}`);
        return;
      }
      writeResult(id, result);
      return;
    }
    default:
      if (id !== null) {
        writeError(id, -32601, `Unsupported method: ${message.method}`);
      }
  }
}

function enqueueMessage(message: JsonRpcRequest) {
  processingQueue = processingQueue
    .then(async () => {
      await handleRequest(message);
    })
    .catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (message.id !== undefined) {
        writeError(message.id, -32000, errorMessage);
      }
    });
}

function processIncomingBuffer() {
  while (true) {
    stdinBuffer = trimLeadingControlBytes(stdinBuffer);
    if (stdinBuffer.length === 0) {
      return;
    }

    try {
      const parsed = looksLikeHeaderFramedMessage(stdinBuffer)
        ? tryReadHeaderFramedMessage(stdinBuffer)
        : tryReadLineDelimitedMessage(stdinBuffer);

      if (parsed.needsMoreData) {
        return;
      }

      stdinBuffer = parsed.rest;
      if (parsed.message) {
        enqueueMessage(parsed.message);
      }
    } catch (_) {
      writeError(null, -32700, 'Invalid JSON.');
      stdinBuffer = Buffer.alloc(0);
      return;
    }
  }
}

process.stdin.on('data', (chunk: Buffer | string) => {
  stdinBuffer = Buffer.concat([
    stdinBuffer,
    Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
  ]);
  processIncomingBuffer();
});

process.stdin.on('end', () => {
  process.exit(0);
});

process.stdin.resume();

process.on('unhandledRejection', (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
});
