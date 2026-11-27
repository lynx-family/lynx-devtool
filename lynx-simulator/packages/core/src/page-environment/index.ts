// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type {
  JSBHandler,
  JSBHandlerRegistration,
  JSBInvokeContext,
  JSBInvokeHandler,
  ResourceFetchContext,
  ResourceRequest,
  SimulatorLynxOptions,
  SimulatorRuntime,
  SimulatorOpenOptions,
  SimulatorWindowRef,
  SimulatorWindowOptions,
} from '../runtime';
import { createSimulatorError } from '../errors/error';
import { SimulatorErrorCodes } from '../errors';

const PAGE_ENVIRONMENT_ID_KEY = 'pageEnvironmentId';

const MAX_JSB_MOCK_DELAY_MS = 2_147_483_647;

export interface PageEnvironment {
  templateData?: Record<string, unknown>;
  globalProps?: Record<string, unknown>;
  jsb?: { bridge?: BridgeMock[] } | PageEnvironmentJSBHandler;
  fetchResource?: PageEnvironmentResourceHandler;
}

export interface PageEnvironmentContext {
  /** Resolved source URL; absent for inline definitions. */
  source?: string;
  cwd: string;
  target: string;
  windowOptions?: SimulatorWindowOptions;
  context?: Record<string, unknown>;
}

export interface PageEnvironmentJSBContext extends PageEnvironmentContext, JSBInvokeContext {}

export interface PageEnvironmentResourceContext
  extends PageEnvironmentContext, Omit<ResourceFetchContext, 'next'> {
  next(): Uint8Array | undefined | Promise<Uint8Array | undefined>;
}

export type PageEnvironmentResourceHandler = (
  request: ResourceRequest,
  context: PageEnvironmentResourceContext
) => Uint8Array | undefined | Promise<Uint8Array | undefined>;

export type PageEnvironmentJSBHandler = (
  name: string,
  params: unknown,
  context: PageEnvironmentJSBContext
) => unknown | Promise<unknown>;

export type PageEnvironmentValue<T> = T | ((context: PageEnvironmentContext) => T | Promise<T>);

export interface PageEnvironmentDefinition extends Omit<
  PageEnvironment,
  'templateData' | 'globalProps'
> {
  templateData?: PageEnvironmentValue<Record<string, unknown>>;
  globalProps?: PageEnvironmentValue<Record<string, unknown>>;
}

export type PageEnvironmentFactory = (
  context: PageEnvironmentContext
) => PageEnvironmentDefinition | Promise<PageEnvironmentDefinition>;

export type PageEnvironmentSource = string | PageEnvironmentDefinition | PageEnvironmentFactory;

export interface BridgeMock {
  name: string;
  params?: unknown;
  delayMs?: number;
  result: unknown;
}

interface LoadedPageEnvironment {
  id: string;
  data: PageEnvironment;
  context: PageEnvironmentContext;
}

export interface PageEnvironmentManagerOptions {
  runtime: SimulatorRuntime;
  realHandlers?: JSBHandlerRegistration[];
  onDispatch?: (
    event: 'jsb-mock' | 'jsb-real' | 'resource-mock' | 'resource-error',
    payload: Record<string, unknown>
  ) => void;
}

export interface PageEnvironmentOpenOptions extends SimulatorOpenOptions {
  pageEnvironment?: PageEnvironmentSource;
}

export interface PageEnvironmentManager {
  open(options: PageEnvironmentOpenOptions): Promise<SimulatorWindowRef>;
  /** Release environment data and subscriptions without disposing the runtime. */
  dispose(): void;
}

type EnvironmentState = {
  runtime: SimulatorRuntime;
  realHandlers: Map<string, JSBHandler>;
  onDispatch: PageEnvironmentManagerOptions['onDispatch'];
  disposed: boolean;
  environments: Map<string, LoadedPageEnvironment>;
  windowIdToEnvironmentId: Map<string, string>;
};

/** Opt-in page environment support; leaves the generic runtime dispatch unchanged. */
export function createPageEnvironmentManager(
  options: PageEnvironmentManagerOptions
): PageEnvironmentManager {
  const state: EnvironmentState = {
    runtime: options.runtime,
    realHandlers: new Map(options.realHandlers?.map(({ name, handler }) => [name, handler])),
    onDispatch: options.onDispatch,
    disposed: false,
    environments: new Map(),
    windowIdToEnvironmentId: new Map(),
  };
  registerJSBHandlersWithMocks(state);
  const unsubscribe = state.runtime.addWindowEventListener(({ type, window }) => {
    if (type === 'closed' || type === 'failed') releaseByWindow(state, window.id);
  });
  return {
    open: (options) => open(state, options),
    dispose: () => {
      if (state.disposed) return;
      state.disposed = true;
      unsubscribe();
      state.onDispatch = undefined;
      state.environments.clear();
      state.windowIdToEnvironmentId.clear();
    },
  };
}

async function open(
  state: EnvironmentState,
  options: PageEnvironmentOpenOptions
): Promise<SimulatorWindowRef> {
  assertActive(state);
  const { pageEnvironment, ...openOptions } = options;
  const loaded = await load(state, pageEnvironment, {
    cwd: path.resolve(openOptions.cwd ?? process.cwd()),
    target: openOptions.target,
    windowOptions: openOptions.window,
    context: openOptions.context,
  });
  try {
    registerJSBHandlersWithMocks(state, loaded?.data);
    const ref = await state.runtime.open({
      ...openOptions,
      ...(loaded
        ? {
            lynxOptions: { ...getLynxOptions(loaded.data), ...openOptions.lynxOptions },
            context: { ...openOptions.context, [PAGE_ENVIRONMENT_ID_KEY]: loaded.id },
            ...(typeof loaded.data.jsb === 'function'
              ? { onJSBInvoke: createInvokeHandler(state, loaded.id, openOptions.onJSBInvoke) }
              : {}),
            ...(loaded.data.fetchResource
              ? {
                  onFetchResource: async (
                    request: ResourceRequest,
                    context: ResourceFetchContext
                  ) => {
                    const current = state.environments.get(loaded.id);
                    const next = () =>
                      openOptions.onFetchResource?.(request, context) ?? context.next();
                    if (!current?.data.fetchResource) return next();
                    try {
                      state.onDispatch?.('resource-mock', {
                        ...request,
                        simulatorWindowId: context.window.id,
                      });
                      return await current.data.fetchResource(request, {
                        ...current.context,
                        ...context,
                        next,
                      });
                    } catch (error) {
                      state.onDispatch?.('resource-error', {
                        ...request,
                        simulatorWindowId: context.window.id,
                        message: String(error),
                      });
                      throw error;
                    }
                  },
                }
              : {}),
          }
        : {}),
    });
    const info = ref.getInfo();
    if (state.disposed || info?.error || info?.status === 'closed') release(state, loaded?.id);
    else attachWindow(state, ref.id, loaded?.id);
    return ref;
  } catch (error) {
    release(state, loaded?.id);
    throw error;
  }
}

function assertActive(state: EnvironmentState): void {
  if (state.disposed) {
    throw createSimulatorError({
      module: 'runtime',
      code: SimulatorErrorCodes.RuntimePageEnvironmentDisposed,
      message: 'Page environment manager has been disposed.',
    });
  }
}

async function load(
  state: EnvironmentState,
  source: PageEnvironmentSource | undefined,
  context: PageEnvironmentContext
): Promise<LoadedPageEnvironment | undefined> {
  const loaded = await readEnvironment(source, context);
  assertActive(state);
  if (loaded) state.environments.set(loaded.id, loaded);
  return loaded;
}

function createInvokeHandler(
  state: EnvironmentState,
  id: string,
  fallback: JSBInvokeHandler | undefined
): JSBInvokeHandler {
  return (name, params, context) => {
    const loaded = state.environments.get(id);
    const next = () => (fallback ? fallback(name, params, context) : context.next());
    if (typeof loaded?.data.jsb !== 'function') return next();
    state.onDispatch?.('jsb-mock', { name, params, dynamic: true });
    return loaded.data.jsb(name, params, { ...loaded.context, ...context, next });
  };
}

function getLynxOptions(
  pageEnvironment: PageEnvironment | undefined
): SimulatorLynxOptions | undefined {
  if (!pageEnvironment) {
    return undefined;
  }

  const lynxOptions: SimulatorLynxOptions = {};
  if (pageEnvironment.templateData) {
    lynxOptions.data = pageEnvironment.templateData;
  }
  if (pageEnvironment.globalProps) {
    lynxOptions.globalProps = pageEnvironment.globalProps;
  }
  return Object.keys(lynxOptions).length > 0 ? lynxOptions : undefined;
}

function release(state: EnvironmentState, id: string | undefined): void {
  if (id) {
    state.environments.delete(id);
  }
}

function attachWindow(state: EnvironmentState, windowId: string, id: string | undefined): void {
  if (!id) {
    return;
  }

  state.windowIdToEnvironmentId.set(windowId, id);
}

function releaseByWindow(state: EnvironmentState, windowId: string): void {
  const environmentId = state.windowIdToEnvironmentId.get(windowId);
  state.windowIdToEnvironmentId.delete(windowId);
  release(state, environmentId);
}

function registerJSBHandlersWithMocks(
  state: EnvironmentState,
  pageEnvironment?: PageEnvironment
): void {
  const mocks = getBridgeMocks(pageEnvironment);
  const { realHandlers } = state;
  const handlers: JSBHandlerRegistration[] = [];

  // Runtime keeps one handler per JSB name, so register the union of real and
  // mocked names. Each composed handler checks the calling window's page
  // environment first and falls back to the real implementation.
  //
  // The same JSB name may be registered again when another window opens. Resolve
  // the environment from handlerContext.context instead of capturing the
  // pageEnvironment argument, so each window keeps using its own environment.
  const names = new Set([...realHandlers.keys(), ...mocks.map((mock) => mock.name)]);
  for (const name of names) {
    handlers.push({
      name,
      handler: (params, handlerContext) => {
        const currentEnvironment = getEnvironment(state, handlerContext.context);
        const sameNameMocks = getBridgeMocks(currentEnvironment).filter(
          (mock) => mock.name === name
        );
        const mock = findBridgeMock(sameNameMocks, params);
        if (sameNameMocks.length > 0) {
          state.onDispatch?.('jsb-mock', {
            name,
            matched: mock !== undefined,
            params,
            matchedParams: mock?.params,
            delayMs: mock?.delayMs,
          });
        }
        if (mock) {
          const result = clone(mock.result);
          if (mock.delayMs === undefined || mock.delayMs === 0) {
            return result;
          }
          return new Promise((resolve) => {
            setTimeout(() => resolve(result), mock.delayMs);
          });
        }

        const realHandler = realHandlers.get(name);
        if (!realHandler) {
          return undefined;
        }
        state.onDispatch?.('jsb-real', { name, params });
        return realHandler(params, handlerContext);
      },
    });
  }

  if (handlers.length > 0) {
    state.runtime.registerJSBHandlers(handlers);
  }
}

async function readEnvironment(
  source: PageEnvironmentSource | undefined,
  context: PageEnvironmentContext
): Promise<LoadedPageEnvironment | undefined> {
  if (source === undefined) {
    return undefined;
  }

  try {
    let definition: unknown = source;
    if (typeof source === 'string') {
      const url =
        path.isAbsolute(source) || !URL.canParse(source)
          ? pathToFileURL(path.resolve(context.cwd, source))
          : new URL(source);
      context = { ...context, source: url.href };
      if (/\.(mjs|js)$/i.test(url.pathname)) {
        if (url.protocol !== 'file:')
          throw new Error('JavaScript page environments must be local files.');
        const module = await import(/* webpackIgnore: true */ url.href);
        if (typeof module.default !== 'function') {
          throw new Error('Page environment module must default-export a function.');
        }
        definition = module.default;
      } else {
        definition = JSON.parse(await readSource(url));
      }
    }
    if (typeof definition === 'function') definition = await definition(context);
    if (!isRecord(definition)) throw new Error('Page environment must be an object.');
    const input = definition as PageEnvironmentDefinition;
    const evaluate = async (
      value: PageEnvironmentValue<Record<string, unknown>> | undefined,
      field: string
    ) => {
      const result = typeof value === 'function' ? await value(context) : value;
      if (value !== undefined && !isRecord(result)) {
        throw new Error(`pageEnvironment.${field} must be an object.`);
      }
      return result;
    };
    const [templateData, globalProps] = await Promise.all([
      evaluate(input.templateData, 'templateData'),
      evaluate(input.globalProps, 'globalProps'),
    ]);
    const data: PageEnvironment = { ...input, templateData, globalProps };
    validatePageEnvironment(data);
    return { id: createId(), data, context };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createSimulatorError({
      module: 'runtime',
      code: SimulatorErrorCodes.RuntimeInvalidPageEnvironment,
      message: `Failed to load page environment${typeof source === 'string' ? `: ${source}` : ''}. ${message}`,
      cause: error,
    });
  }
}

async function readSource(source: URL): Promise<string> {
  if (source.protocol === 'http:' || source.protocol === 'https:') {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to download ${source}: ${message}`);
    }
  }
  return readFile(fileURLToPath(source), 'utf8');
}

function findBridgeMock(sameNameMocks: BridgeMock[], params: unknown): BridgeMock | undefined {
  // Match params-specific mocks first. If none match, use a mock without params
  // as the fallback response for this JSB name.
  const matchedMock = sameNameMocks.find(
    (mock) => mock.params !== undefined && doesParamsMatch(mock.params, params)
  );
  if (matchedMock) {
    return matchedMock;
  }

  return sameNameMocks.find((mock) => mock.params === undefined);
}

function getBridgeMocks(pageEnvironment: PageEnvironment | undefined): BridgeMock[] {
  const jsb = pageEnvironment?.jsb;
  return typeof jsb === 'function' ? [] : (jsb?.bridge?.filter(isBridgeMock) ?? []);
}

function getEnvironment(
  state: EnvironmentState,
  context: Record<string, unknown> | undefined
): PageEnvironment | undefined {
  const id = context?.[PAGE_ENVIRONMENT_ID_KEY];
  return typeof id === 'string' ? state.environments.get(id)?.data : undefined;
}

function createId(): string {
  return `env_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function validatePageEnvironment(pageEnvironment: PageEnvironment): void {
  if (!pageEnvironment || typeof pageEnvironment !== 'object' || Array.isArray(pageEnvironment)) {
    throw new Error('Page environment must be a JSON object.');
  }
  if (pageEnvironment.templateData !== undefined && !isRecord(pageEnvironment.templateData)) {
    throw new Error('pageEnvironment.templateData must be an object.');
  }
  if (pageEnvironment.globalProps !== undefined && !isRecord(pageEnvironment.globalProps)) {
    throw new Error('pageEnvironment.globalProps must be an object.');
  }
  if (
    pageEnvironment.fetchResource !== undefined &&
    typeof pageEnvironment.fetchResource !== 'function'
  ) {
    throw new Error('pageEnvironment.fetchResource must be a function.');
  }
  const jsb = pageEnvironment.jsb;
  if (jsb !== undefined && typeof jsb !== 'function' && !isRecord(jsb)) {
    throw new Error('pageEnvironment.jsb must be an object or a function.');
  }
  if (typeof jsb === 'function') return;
  if (jsb?.bridge !== undefined && !Array.isArray(jsb.bridge)) {
    throw new Error('pageEnvironment.jsb.bridge must be an array.');
  }
  jsb?.bridge?.forEach((mock, index) => {
    const delayMs: unknown = isRecord(mock) ? mock.delayMs : undefined;
    if (
      delayMs !== undefined &&
      (typeof delayMs !== 'number' ||
        !Number.isInteger(delayMs) ||
        delayMs < 0 ||
        delayMs > MAX_JSB_MOCK_DELAY_MS)
    ) {
      throw new Error(
        `pageEnvironment.jsb.bridge[${index}].delayMs must be an integer between 0 and ${MAX_JSB_MOCK_DELAY_MS}.`
      );
    }
  });
}

function isBridgeMock(value: unknown): value is BridgeMock {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { name?: unknown }).name === 'string' &&
    Object.prototype.hasOwnProperty.call(value, 'result')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

// Object params use partial matching: every expected field must match, while
// actual params may contain extra fields. Arrays are strict to avoid ambiguous
// matches, and primitive values must be exactly equal.
function doesParamsMatch(expected: unknown, actual: unknown): boolean {
  if (Object.is(expected, actual)) {
    return true;
  }

  if (Array.isArray(expected) || Array.isArray(actual)) {
    return (
      Array.isArray(expected) &&
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => doesParamsMatch(item, actual[index]))
    );
  }

  if (!isRecord(expected) || !isRecord(actual)) {
    return false;
  }

  return Object.keys(expected).every(
    (key) =>
      Object.prototype.hasOwnProperty.call(actual, key) &&
      doesParamsMatch(expected[key], actual[key])
  );
}

function clone<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}
