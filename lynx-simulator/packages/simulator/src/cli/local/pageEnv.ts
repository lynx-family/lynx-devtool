import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

import type { ParsedCommandContext } from '@lynx-js/lynx-simulator-core';

import { readResourceBuffer } from '../../shared/resource';
import type { CliResult } from '../output';
import { getPageEnvGuidePath } from '../package';

const RECORDER_KEYS = {
  actionList: 'Action List',
  invokedMethodData: 'Invoked Method Data',
  callback: 'Callback',
};

export interface PageEnvOptions {
  recorder?: string;
  output?: string;
}

export interface PageEnvResult extends CliResult {
  ok: true;
  output: string;
  reference: string;
  templateData: boolean;
  globalProps: boolean;
  jsb: Record<string, number>;
}

interface PageEnvironment {
  templateData?: Record<string, unknown>;
  globalProps?: Record<string, unknown>;
  jsb?: Record<string, unknown[]>;
}

type RecorderAction = {
  functionName: string;
  params?: {
    templateData?: unknown;
    globalProps?: unknown;
  };
};

type RecorderInvocation = {
  moduleName: string;
  methodName: string;
  params?: InvocationParams;
};

type InvocationParams = {
  args?: unknown[];
  callback?: unknown[];
  returnValue?: unknown;
};

type BridgeMock = {
  name: string;
  params?: unknown;
  result: unknown;
};

type ModuleMock = {
  name: string;
  params?: unknown;
  result?: unknown;
};

export async function handleGenerateCommand(
  parsed: ParsedCommandContext,
  cwd: string
): Promise<CliResult> {
  const type = parsed.args.type;
  if (type !== 'page-env') {
    return {
      ok: false,
      code: 'GENERATE_TARGET_UNSUPPORTED',
      message: `Unsupported generate target: ${String(type)}.`,
    };
  }

  return handlePageEnvGenerateCommand(parsed.options as PageEnvOptions, cwd);
}

async function handlePageEnvGenerateCommand(
  options: PageEnvOptions,
  cwd: string
): Promise<PageEnvResult> {
  const output = path.resolve(cwd, options.output ?? 'page-env.json');
  const pageEnv = options.recorder
    ? createPageEnvironment(await decodeRecorder(options.recorder, cwd))
    : createEmptyPageEnvironment();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(pageEnv, null, 2)}\n`);
  return {
    ok: true,
    output,
    reference: getPageEnvGuidePath(),
    templateData: Boolean(pageEnv.templateData),
    globalProps: Boolean(pageEnv.globalProps),
    jsb: Object.fromEntries(
      Object.entries(pageEnv.jsb ?? {}).map(([moduleName, mocks]) => [
        moduleName,
        Array.isArray(mocks) ? mocks.length : 0,
      ])
    ),
  };
}

function createEmptyPageEnvironment(): PageEnvironment {
  return {
    templateData: {},
    globalProps: {},
    jsb: {
      bridge: [],
    },
  };
}

async function decodeRecorder(
  inputPathOrURL: string,
  cwd: string
): Promise<Record<string, unknown>> {
  const input = await readResourceBuffer(inputPathOrURL, cwd);
  const recorder = decodeRecorderBuffer(input);
  if (!isRecord(recorder)) {
    throw new Error('Decoded recorder data must be a JSON object.');
  }
  return recorder;
}

function decodeRecorderBuffer(buffer: Buffer): unknown {
  const bufferString = new TextDecoder().decode(buffer);
  try {
    return JSON.parse(bufferString);
  } catch {
    const base64Buffer = Buffer.from(bufferString, 'base64');
    const base64String = base64Buffer.toString();
    if (base64String.startsWith('{')) {
      return JSON.parse(base64String);
    }

    const output = zlib.inflateSync(base64Buffer);
    try {
      return JSON.parse(output.toString());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const decodedOutput = new TextDecoder('utf-8').decode(output);
      throw new Error(
        `Failed to parse inflated recorder data: ${message}. Decoded output: ${decodedOutput}`
      );
    }
  }
}

function createPageEnvironment(recorder: Record<string, unknown>): PageEnvironment {
  const actionList = toArray(recorder[RECORDER_KEYS.actionList]);
  const invokedMethodData = toArray(recorder[RECORDER_KEYS.invokedMethodData]);
  const callbackData = recorder[RECORDER_KEYS.callback];
  const callbacks: Record<string, unknown> = isRecord(callbackData) ? callbackData : {};

  const pageEnv: PageEnvironment = {};
  const templateData = extractTemplateData(actionList);
  if (templateData) {
    pageEnv.templateData = templateData;
  }

  const globalProps = extractGlobalProps(actionList);
  if (globalProps) {
    pageEnv.globalProps = globalProps;
  }

  const jsb = extractJSBMocks(invokedMethodData, callbacks);
  if (Object.keys(jsb).length > 0) {
    pageEnv.jsb = jsb;
  }
  return pageEnv;
}

function extractTemplateData(actionList: unknown[]): Record<string, unknown> | undefined {
  const loadTemplate = findRecorderAction(actionList, 'loadTemplate', 'loadTemplateBundle');
  const templateData = loadTemplate?.params?.templateData;
  return isRecord(templateData) ? templateData : undefined;
}

function extractGlobalProps(actionList: unknown[]): Record<string, unknown> | undefined {
  const setGlobalProps = findRecorderAction(actionList, 'setGlobalProps');
  const globalProps = setGlobalProps?.params?.globalProps;
  return isRecord(globalProps) ? globalProps : undefined;
}

function findRecorderAction(
  actionList: unknown[],
  ...functionNames: string[]
): RecorderAction | undefined {
  return actionList
    .map((item) => toRecorderAction(item))
    .find((action) => action && functionNames.includes(action.functionName));
}

function extractJSBMocks(
  invokedMethodData: unknown[],
  callbacks: Record<string, unknown>
): Record<string, unknown[]> {
  const jsb: Record<string, unknown[]> = {};
  for (const invocation of invokedMethodData) {
    const item = toRecorderInvocation(invocation);
    if (!item) {
      continue;
    }

    if (item.moduleName === 'bridge' && item.methodName === 'call') {
      const mock = createBridgeMock(item.params, callbacks);
      if (mock) {
        pushJSBMock(jsb, item.moduleName, mock);
      }
      continue;
    }

    const mock = createModuleMock(item.methodName, item.params, callbacks);
    if (mock) {
      pushJSBMock(jsb, item.moduleName, mock);
    }
  }
  return jsb;
}

function createBridgeMock(
  params: InvocationParams | undefined,
  callbacks: Record<string, unknown>
): BridgeMock | undefined {
  if (!Array.isArray(params?.args) || typeof params.args[0] !== 'string') {
    return undefined;
  }

  const result = getInvocationResult(params, callbacks);
  if (result === undefined) {
    return undefined;
  }

  const mock: BridgeMock = {
    name: params.args[0],
    result,
  };
  const mockParams = normalizeBridgeParams(params.args[1]);
  if (mockParams !== undefined) {
    mock.params = mockParams;
  }
  return mock;
}

function normalizeBridgeParams(params: unknown): unknown {
  if (!isRecord(params)) {
    return normalizeParamsValue(params);
  }

  if (Object.prototype.hasOwnProperty.call(params, 'data')) {
    const data = normalizeParamsValue(params.data);
    return data === undefined ? undefined : { data };
  }

  return normalizeParamsValue(params);
}

function normalizeParamsValue(value: unknown): unknown {
  if (value === undefined || value === 'undefined') {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => normalizeParamsValue(item))
      .filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  if (!isRecord(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const normalized = normalizeParamsValue(item);
    if (normalized !== undefined) {
      result[key] = normalized;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function createModuleMock(
  methodName: string,
  params: InvocationParams | undefined,
  callbacks: Record<string, unknown>
): ModuleMock | undefined {
  const mock: ModuleMock = { name: methodName };
  const callParams = getCallParams(params);
  if (callParams !== undefined) {
    mock.params = callParams;
  }

  const result = getInvocationResult(params, callbacks);
  if (result !== undefined) {
    mock.result = result;
  }

  return Object.prototype.hasOwnProperty.call(mock, 'params') ||
    Object.prototype.hasOwnProperty.call(mock, 'result')
    ? mock
    : undefined;
}

function getCallParams(params: InvocationParams | undefined): unknown {
  if (!Array.isArray(params?.args)) {
    return undefined;
  }

  const args = params.args
    .filter((arg) => arg !== 'function')
    .map((arg) => normalizeParamsValue(arg))
    .filter((arg) => arg !== undefined);
  if (args.length === 0) {
    return undefined;
  }
  return args.length === 1 ? args[0] : args;
}

function pushJSBMock(jsb: Record<string, unknown[]>, moduleName: string, mock: unknown): void {
  if (!Array.isArray(jsb[moduleName])) {
    jsb[moduleName] = [];
  }
  jsb[moduleName].push(mock);
}

function getInvocationResult(
  params: InvocationParams | undefined,
  callbacks: Record<string, unknown>
): unknown {
  const callbackId = Array.isArray(params?.callback) ? params.callback[0] : undefined;
  if (callbackId !== undefined) {
    const callback = callbacks[String(callbackId)];
    if (
      isRecord(callback) &&
      isRecord(callback.Params) &&
      Object.prototype.hasOwnProperty.call(callback.Params, 'returnValue')
    ) {
      return callback.Params.returnValue === 'undefined' ? undefined : callback.Params.returnValue;
    }
  }

  if (params && Object.prototype.hasOwnProperty.call(params, 'returnValue')) {
    return params.returnValue === 'undefined' ? undefined : params.returnValue;
  }
  return undefined;
}

function toRecorderAction(value: unknown): RecorderAction | undefined {
  if (!isRecord(value) || typeof value['Function Name'] !== 'string') {
    return undefined;
  }

  const params = isRecord(value.Params) ? value.Params : undefined;
  return {
    functionName: value['Function Name'],
    params: {
      templateData: params?.templateData,
      globalProps: params?.global_props,
    },
  };
}

function toRecorderInvocation(value: unknown): RecorderInvocation | undefined {
  if (
    !isRecord(value) ||
    typeof value['Module Name'] !== 'string' ||
    typeof value['Method Name'] !== 'string'
  ) {
    return undefined;
  }

  return {
    moduleName: value['Module Name'],
    methodName: value['Method Name'],
    params: isRecord(value.Params) ? (value.Params as InvocationParams) : undefined,
  };
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
