#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const targetRoot = process.argv[2];

if (!targetRoot) {
  console.error('Usage: patch-upstream-lynx-features.js <path-to-upstream-checkout>');
  process.exit(1);
}

const read = relativePath => {
  const filePath = path.join(targetRoot, relativePath);
  return {filePath, source: fs.readFileSync(filePath, 'utf8')};
};

const writeIfChanged = (relativePath, nextSource) => {
  const filePath = path.join(targetRoot, relativePath);
  const currentSource = fs.readFileSync(filePath, 'utf8');
  if (currentSource === nextSource) {
    console.log(`Already patched: ${relativePath}`);
    return;
  }
  fs.writeFileSync(filePath, nextSource);
  console.log(`Patched: ${relativePath}`);
};

const ensureContains = (source, anchor, filePath) => {
  if (!source.includes(anchor)) {
    throw new Error(`Patch anchor not found in ${filePath}: ${anchor}`);
  }
};

const replaceOnce = (source, searchValue, replaceValue, filePath) => {
  ensureContains(source, searchValue, filePath);
  return source.replace(searchValue, replaceValue);
};

const patchInspectorBackend = () => {
  const relativePath = 'front_end/core/protocol_client/InspectorBackend.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes('export interface LynxAgentApi {')) {
    next = replaceOnce(
        next,
        `interface DispatcherMap extends Map<ProtocolDomainName, ProtocolProxyApi.ProtocolDispatchers[ProtocolDomainName]> {
  get<Domain extends ProtocolDomainName>(key: Domain): DispatcherManager<Domain>|undefined;
  set<Domain extends ProtocolDomainName>(key: Domain, value: DispatcherManager<Domain>): this;
}

export class TargetBase {`,
        `interface DispatcherMap extends Map<ProtocolDomainName, ProtocolProxyApi.ProtocolDispatchers[ProtocolDomainName]> {
  get<Domain extends ProtocolDomainName>(key: Domain): DispatcherManager<Domain>|undefined;
  set<Domain extends ProtocolDomainName>(key: Domain, value: DispatcherManager<Domain>): this;
}

export interface LynxAgentApi {
  invoke_getComponentId(params: {nodeId: number}): Promise<Protocol.ProtocolResponseWithError&{componentId?: number}>;
  invoke_getProperties(params: {nodeId: number}): Promise<Protocol.ProtocolResponseWithError&{properties?: unknown}>;
  invoke_getData(params: {nodeId: number}): Promise<Protocol.ProtocolResponseWithError&{data?: unknown}>;
  invoke_setTraceMode(params: {enableTraceMode: boolean}): Promise<Protocol.ProtocolResponseWithError>;
}

export class TargetBase {`,
        filePath,
    );
  }

  if (!next.includes(`  lynxAgent(): LynxAgentApi {`)) {
    next = replaceOnce(
        next,
        `  webAuthnAgent(): ProtocolProxyApi.WebAuthnApi {
    return this.getAgent('WebAuthn');
  }

  // Dispatcher registration and de-registration, keep alphabetically sorted.`,
        `  webAuthnAgent(): ProtocolProxyApi.WebAuthnApi {
    return this.getAgent('WebAuthn');
  }

  lynxAgent(): LynxAgentApi {
    return this.getAgent('Lynx' as ProtocolDomainName) as unknown as LynxAgentApi;
  }

  // Dispatcher registration and de-registration, keep alphabetically sorted.`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchGeneratedInspectorBackendCommands = () => {
  const relativePath = 'front_end/generated/InspectorBackendCommands.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes(`inspectorBackend.registerEvent("Debugger.removeScriptsForLynxView"`)) {
    next = replaceOnce(
        next,
        `inspectorBackend.registerEvent("Debugger.breakpointResolved", ["breakpointId", "location"]);`,
        `inspectorBackend.registerEvent("Debugger.breakpointResolved", ["breakpointId", "location"]);
inspectorBackend.registerEvent("Debugger.removeScriptsForLynxView", ["viewId"]);`,
        filePath,
    );
  }

  if (!next.includes(`inspectorBackend.registerCommand("Lynx.setTraceMode"`)) {
    next = replaceOnce(
        next,
        `// Schema.`,
        `// Lynx.
inspectorBackend.registerCommand("Lynx.getComponentId", [{"name": "nodeId", "type": "number", "optional": false, "description": "Frontend node identifier.", "typeRef": "DOM.NodeId"}], ["componentId"], "Resolve the Lynx component identifier for a DOM node.");
inspectorBackend.registerCommand("Lynx.getProperties", [{"name": "nodeId", "type": "number", "optional": false, "description": "Frontend node identifier.", "typeRef": "DOM.NodeId"}], ["properties"], "Fetch Lynx component properties for a DOM node.");
inspectorBackend.registerCommand("Lynx.getData", [{"name": "nodeId", "type": "number", "optional": false, "description": "Frontend node identifier.", "typeRef": "DOM.NodeId"}], ["data"], "Fetch Lynx component data for a DOM node.");
inspectorBackend.registerCommand("Lynx.setTraceMode", [{"name": "enableTraceMode", "type": "boolean", "optional": false, "description": "Whether Lynx trace mode should be enabled.", "typeRef": null}], [], "Toggle Lynx trace mode while recording performance traces.");

// Schema.`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchRuntimeModel = () => {
  const relativePath = 'front_end/core/sdk/RuntimeModel.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes(`  LynxViewDestroyed = 'LynxViewDestroyed',`)) {
    next = replaceOnce(
        next,
        `export enum Events {
  /* eslint-disable @typescript-eslint/naming-convention -- Used by web_tests. */
  BindingCalled = 'BindingCalled',
  ExecutionContextCreated = 'ExecutionContextCreated',
  ExecutionContextDestroyed = 'ExecutionContextDestroyed',
  ExecutionContextChanged = 'ExecutionContextChanged',
  ExecutionContextOrderChanged = 'ExecutionContextOrderChanged',
  ExceptionThrown = 'ExceptionThrown',
  ExceptionRevoked = 'ExceptionRevoked',
  ConsoleAPICalled = 'ConsoleAPICalled',
  QueryObjectRequested = 'QueryObjectRequested',
  /* eslint-enable @typescript-eslint/naming-convention */
}`,
        `export enum Events {
  /* eslint-disable @typescript-eslint/naming-convention -- Used by web_tests. */
  BindingCalled = 'BindingCalled',
  ExecutionContextCreated = 'ExecutionContextCreated',
  ExecutionContextDestroyed = 'ExecutionContextDestroyed',
  ExecutionContextChanged = 'ExecutionContextChanged',
  ExecutionContextOrderChanged = 'ExecutionContextOrderChanged',
  ExceptionThrown = 'ExceptionThrown',
  ExceptionRevoked = 'ExceptionRevoked',
  ConsoleAPICalled = 'ConsoleAPICalled',
  QueryObjectRequested = 'QueryObjectRequested',
  LynxViewDestroyed = 'LynxViewDestroyed',
  /* eslint-enable @typescript-eslint/naming-convention */
}`,
        filePath,
    );
  }

  if (!next.includes(`[Events.LynxViewDestroyed]: number;`)) {
    next = replaceOnce(
        next,
        `export interface EventTypes {
  [Events.BindingCalled]: Protocol.Runtime.BindingCalledEvent;
  [Events.ExecutionContextCreated]: ExecutionContext;
  [Events.ExecutionContextDestroyed]: ExecutionContext;
  [Events.ExecutionContextChanged]: ExecutionContext;
  [Events.ExecutionContextOrderChanged]: RuntimeModel;
  [Events.ExceptionThrown]: ExceptionWithTimestamp;
  [Events.ExceptionRevoked]: number;
  [Events.ConsoleAPICalled]: ConsoleAPICall;
  [Events.QueryObjectRequested]: QueryObjectRequestedEvent;
}`,
        `export interface EventTypes {
  [Events.BindingCalled]: Protocol.Runtime.BindingCalledEvent;
  [Events.ExecutionContextCreated]: ExecutionContext;
  [Events.ExecutionContextDestroyed]: ExecutionContext;
  [Events.ExecutionContextChanged]: ExecutionContext;
  [Events.ExecutionContextOrderChanged]: RuntimeModel;
  [Events.ExceptionThrown]: ExceptionWithTimestamp;
  [Events.ExceptionRevoked]: number;
  [Events.ConsoleAPICalled]: ConsoleAPICall;
  [Events.QueryObjectRequested]: QueryObjectRequestedEvent;
  [Events.LynxViewDestroyed]: number;
}`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchDebuggerModel = () => {
  const relativePath = 'front_end/core/sdk/DebuggerModel.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes(`Events as RuntimeModelEvents`)) {
    next = replaceOnce(
        next,
        `import {type EvaluationOptions, type EvaluationResult, type ExecutionContext, RuntimeModel} from './RuntimeModel.js';`,
        `import {type EvaluationOptions, type EvaluationResult, type ExecutionContext, Events as RuntimeModelEvents, RuntimeModel} from './RuntimeModel.js';`,
        filePath,
    );
  }

  if (!next.includes(`  scriptsForLynxView(viewId: number): Script[] {`)) {
    next = replaceOnce(
        next,
        `  scriptsForExecutionContext(executionContext: ExecutionContext): Script[] {
    const result = [];
    for (const script of this.#scripts.values()) {
      if (script.executionContextId === executionContext.id) {
        result.push(script);
      }
    }
    return result;
  }

  get callFrames(): CallFrame[]|null {`,
        `  scriptsForExecutionContext(executionContext: ExecutionContext): Script[] {
    const result = [];
    for (const script of this.#scripts.values()) {
      if (script.executionContextId === executionContext.id) {
        result.push(script);
      }
    }
    return result;
  }

  scriptsForLynxView(viewId: number): Script[] {
    const result = [];
    for (const script of this.#scripts.values()) {
      if (script.contentURL().includes(\`/view\${viewId}/\`)) {
        result.push(script);
      }
    }
    return result;
  }

  removeScriptsForLynxView(viewId: number): void {
    this.#runtimeModel.dispatchEventToListeners(RuntimeModelEvents.LynxViewDestroyed, viewId);
    for (const script of this.scriptsForLynxView(viewId)) {
      this.#sourceMapManager.detachSourceMap(script);
    }
  }

  get callFrames(): CallFrame[]|null {`,
        filePath,
    );
  }

  if (!next.includes(`show-lynx-shared-context-sources`)) {
    next = replaceOnce(
        next,
        `    if (!this.#debuggerModel.debuggerEnabled()) {
      return;
    }
    this.#debuggerModel.parsedScriptSource(`,
        `    if (!this.#debuggerModel.debuggerEnabled()) {
      return;
    }
    const showSharedContextSources =
        Common.Settings.Settings.instance().createSetting('show-lynx-shared-context-sources', false).get();
    if (!showSharedContextSources && viewId) {
      const matchedView = String(url).match(/^file:\\/\\/view(\\d+)\\//);
      if (matchedView && Number(matchedView[1]) !== viewId) {
        return;
      }
    }
    this.#debuggerModel.parsedScriptSource(`,
        filePath,
    );
  }

  if (!next.includes(`}: Protocol.Debugger.ScriptParsedEvent & {viewId?: number}`)) {
    next = replaceOnce(
        next,
        `    embedderName,
    buildId,
  }: Protocol.Debugger.ScriptParsedEvent): void {`,
        `    embedderName,
    buildId,
    viewId,
  }: Protocol.Debugger.ScriptParsedEvent & {viewId?: number}): void {`,
        filePath,
    );
  }

  if (!next.includes(`  removeScriptsForLynxView({viewId}: {viewId: number}): void {`)) {
    next = replaceOnce(
        next,
        `  breakpointResolved({breakpointId, location}: Protocol.Debugger.BreakpointResolvedEvent): void {
    if (!this.#debuggerModel.debuggerEnabled()) {
      return;
    }
    this.#debuggerModel.breakpointResolved(breakpointId, location);
  }
}`,
        `  breakpointResolved({breakpointId, location}: Protocol.Debugger.BreakpointResolvedEvent): void {
    if (!this.#debuggerModel.debuggerEnabled()) {
      return;
    }
    this.#debuggerModel.breakpointResolved(breakpointId, location);
  }

  removeScriptsForLynxView({viewId}: {viewId: number}): void {
    if (!this.#debuggerModel.debuggerEnabled()) {
      return;
    }
    this.#debuggerModel.removeScriptsForLynxView(viewId);
  }
}`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchResourceScriptMapping = () => {
  const relativePath = 'front_end/models/bindings/ResourceScriptMapping.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes(`SDK.RuntimeModel.Events.LynxViewDestroyed`)) {
    next = replaceOnce(
        next,
        `      runtimeModel.addEventListener(
          SDK.RuntimeModel.Events.ExecutionContextDestroyed, this.executionContextDestroyed, this),
      runtimeModel.target().targetManager().addEventListener(
          SDK.TargetManager.Events.INSPECTED_URL_CHANGED, this.inspectedURLChanged, this),`,
        `      runtimeModel.addEventListener(
          SDK.RuntimeModel.Events.ExecutionContextDestroyed, this.executionContextDestroyed, this),
      runtimeModel.addEventListener(
          SDK.RuntimeModel.Events.LynxViewDestroyed, this.lynxViewDestroyed, this),
      runtimeModel.target().targetManager().addEventListener(
          SDK.TargetManager.Events.INSPECTED_URL_CHANGED, this.inspectedURLChanged, this),`,
        filePath,
    );
  }

  if (!next.includes(`  private lynxViewDestroyed(event: Common.EventTarget.EventTargetEvent<number>): void {`)) {
    next = replaceOnce(
        next,
        `  private globalObjectCleared(): void {
    const scripts = Array.from(this.#scriptToUISourceCode.keys());
    this.removeScripts(scripts);
  }`,
        `  private lynxViewDestroyed(event: Common.EventTarget.EventTargetEvent<number>): void {
    this.removeScripts(this.debuggerModel.scriptsForLynxView(event.data));
  }

  private globalObjectCleared(): void {
    const scripts = Array.from(this.#scriptToUISourceCode.keys());
    this.removeScripts(scripts);
  }`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchSdkMeta = () => {
  const relativePath = 'front_end/core/sdk/sdk-meta.ts';
  const {source} = read(relativePath);
  let next = source;

  if (!next.includes(`settingName: 'screencast-fps'`)) {
    next += `

Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.RENDERING,
  title: i18n.i18n.lockedLazyString('Screencast FPS'),
  settingName: 'screencast-fps',
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: '2',
  options: [
    {value: '1', title: i18n.i18n.lockedLazyString('1'), text: i18n.i18n.lockedLazyString('1')},
    {value: '2', title: i18n.i18n.lockedLazyString('2'), text: i18n.i18n.lockedLazyString('2')},
    {value: '5', title: i18n.i18n.lockedLazyString('5'), text: i18n.i18n.lockedLazyString('5')},
    {value: '8', title: i18n.i18n.lockedLazyString('8'), text: i18n.i18n.lockedLazyString('8')},
  ],
});

Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  title: i18n.i18n.lockedLazyString('Show Lynx shared context sources'),
  settingName: 'show-lynx-shared-context-sources',
  settingType: Common.Settings.SettingType.BOOLEAN,
  defaultValue: false,
});
`;
  }

  writeIfChanged(relativePath, next);
};

const patchScreenCaptureModel = () => {
  const relativePath = 'front_end/core/sdk/ScreenCaptureModel.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes(`import * as Common from '../common/common.js';`)) {
    next = replaceOnce(
        next,
        `import type * as Protocol from '../../generated/protocol.js';

import {OverlayModel} from './OverlayModel.js';`,
        `import type * as Protocol from '../../generated/protocol.js';
import * as Common from '../common/common.js';

import {envLogger} from '../protocol_client/InspectorBackend.js';
import {OverlayModel} from './OverlayModel.js';`,
        filePath,
    );
  }

  if (!next.includes(`mode?: string,`)) {
    next = replaceOnce(
        next,
        `    quality: number,
    maxWidth: number|undefined,
    maxHeight: number|undefined,
    everyNthFrame: number|undefined,
  };`,
        `    quality: number,
    maxWidth: number|undefined,
    maxHeight: number|undefined,
    everyNthFrame: number|undefined,
    mode?: string,
  };`,
        filePath,
    );
  }

  if (!next.includes(`#screencastAckTimeout:`)) {
    next = replaceOnce(
        next,
        `export class ScreenCaptureModel extends SDKModel<void> implements ProtocolProxyApi.PageDispatcher {
  readonly #agent: ProtocolProxyApi.PageApi;
  #nextScreencastOperationId = 1;
  #screencastOperations: ScreencastOperation[] = [];
  constructor(target: Target) {`,
        `export class ScreenCaptureModel extends SDKModel<void> implements ProtocolProxyApi.PageDispatcher {
  readonly #agent: ProtocolProxyApi.PageApi;
  #nextScreencastOperationId = 1;
  #screencastOperations: ScreencastOperation[] = [];
  #screencastAckTimeout: number|null = null;
  #cachedScreencastFrame: Protocol.Page.ScreencastFrameEvent|null = null;
  constructor(target: Target) {`,
        filePath,
    );
  }

  if (!next.includes(`const screencastMode = Common.Settings.Settings.instance().createSetting('pageScreencastMode', 'fullscreen').get();`)) {
    next = replaceOnce(
        next,
        `    const operation = {
      id: this.#nextScreencastOperationId++,
      request: {
        format,
        quality,
        maxWidth,
        maxHeight,
        everyNthFrame,
      },
      callbacks: {
        onScreencastFrame: onFrame,
        onScreencastVisibilityChanged: onVisibilityChanged,
      }
    };
    this.#screencastOperations.push(operation);
    void this.#agent.invoke_startScreencast({format, quality, maxWidth, maxHeight, everyNthFrame});

    return operation.id;`,
        `    const screencastMode = Common.Settings.Settings.instance().createSetting('pageScreencastMode', 'fullscreen').get();
    const operation = {
      id: this.#nextScreencastOperationId++,
      request: {
        format,
        quality,
        maxWidth,
        maxHeight,
        everyNthFrame,
        mode: screencastMode,
      },
      callbacks: {
        onScreencastFrame: onFrame,
        onScreencastVisibilityChanged: onVisibilityChanged,
      }
    };
    this.#screencastOperations.push(operation);
    const screencastRequest = {
      format,
      quality,
      maxWidth,
      maxHeight,
      everyNthFrame,
      mode: screencastMode,
    } as Protocol.Page.StartScreencastRequest&{mode?: string};
    void this.#agent.invoke_startScreencast(screencastRequest);
    if (this.#cachedScreencastFrame) {
      onFrame(this.#cachedScreencastFrame.data, this.#cachedScreencastFrame.metadata);
      envLogger.info('CachedScreencastFrame is used to call onScreencastFrame', {tag: 'Screencast'});
    }

    return operation.id;`,
        filePath,
    );
  }

  if (!next.includes(`if (this.#screencastAckTimeout) {`)) {
    next = replaceOnce(
        next,
        `    if (operationToStop.id !== id) {
      throw new Error('Trying to stop a screencast operation that is not being served right now.');
    }
    void this.#agent.invoke_stopScreencast();

    // The latest operation is concluded, let's return back to the previous request now, if it exists.
    const nextOperation = this.#screencastOperations.at(-1);
    if (nextOperation) {
      void this.#agent.invoke_startScreencast({
        format: nextOperation.request.format,
        quality: nextOperation.request.quality,
        maxWidth: nextOperation.request.maxWidth,
        maxHeight: nextOperation.request.maxHeight,
        everyNthFrame: nextOperation.request.everyNthFrame,
      });
    }`,
        `    if (operationToStop.id !== id) {
      throw new Error('Trying to stop a screencast operation that is not being served right now.');
    }
    if (this.#screencastAckTimeout) {
      clearTimeout(this.#screencastAckTimeout);
      this.#screencastAckTimeout = null;
    }
    void this.#agent.invoke_stopScreencast();

    // The latest operation is concluded, let's return back to the previous request now, if it exists.
    const nextOperation = this.#screencastOperations.at(-1);
    if (nextOperation) {
      const screencastRequest = {
        format: nextOperation.request.format,
        quality: nextOperation.request.quality,
        maxWidth: nextOperation.request.maxWidth,
        maxHeight: nextOperation.request.maxHeight,
        everyNthFrame: nextOperation.request.everyNthFrame,
        mode: nextOperation.request.mode,
      } as Protocol.Page.StartScreencastRequest&{mode?: string};
      void this.#agent.invoke_startScreencast(screencastRequest);
    }`,
        filePath,
    );
  }

  if (!next.includes(`const fps = Number(Common.Settings.Settings.instance().createSetting('screencast-fps', '2').get());`)) {
    next = replaceOnce(
        next,
        `  screencastFrame({data, metadata, sessionId}: Protocol.Page.ScreencastFrameEvent): void {
    void this.#agent.invoke_screencastFrameAck({sessionId});

    const currentRequest = this.#screencastOperations.at(-1);
    if (currentRequest) {
      currentRequest.callbacks.onScreencastFrame.call(null, data, metadata);
    }
  }`,
        `  screencastFrame({data, metadata, sessionId}: Protocol.Page.ScreencastFrameEvent): void {
    this.#cachedScreencastFrame = {data, metadata, sessionId};

    const currentRequest = this.#screencastOperations.at(-1);
    if (currentRequest) {
      currentRequest.callbacks.onScreencastFrame.call(null, data, metadata);
      envLogger.info('call onScreencastFrame callback', {tag: 'Screencast'});
    } else {
      envLogger.error('onScreencastFrame callback is not bound.', {tag: 'Screencast'});
    }

    const fps = Number(Common.Settings.Settings.instance().createSetting('screencast-fps', '2').get());
    const ackWaitTime = 1000 / (Number.isFinite(fps) && fps > 0 ? fps : 2);
    if (this.#screencastAckTimeout) {
      clearTimeout(this.#screencastAckTimeout);
    }
    this.#screencastAckTimeout = window.setTimeout(() => {
      this.#screencastAckTimeout = null;
      void this.#agent.invoke_screencastFrameAck({sessionId});
    }, ackWaitTime);
  }`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchTracingManager = () => {
  const relativePath = 'front_end/services/tracing/TracingManager.ts';
  const lynxTracingManager = `// Copyright 2014 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../../core/common/common.js';
import * as Host from '../../core/host/host.js';
import * as SDK from '../../core/sdk/sdk.js';
import type {LynxAgentApi} from '../../core/protocol_client/InspectorBackend.js';
import type * as ProtocolProxyApi from '../../generated/protocol-proxy-api.js';
import * as Protocol from '../../generated/protocol.js';
import type * as Trace from '../../models/trace/trace.js';

interface LynxRuntimeInfo {
  osType?: string;
  sdkVersion?: string;
}

interface TraceWorkerProgress {
  type: 'progress';
  message?: string;
}

interface TraceConversionResult {
  traceEvents?: Trace.Types.Events.Event[];
}

const isTraceWorkerProgress = (data: unknown): data is TraceWorkerProgress => {
  return Boolean(data) && typeof data === 'object' && (data as TraceWorkerProgress).type === 'progress';
};

const decodeBase64 = (data: string): Uint8Array => {
  const binary = atob(data);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i);
  }
  return result;
};

export class TracingManager extends SDK.SDKModel.SDKModel<void> {
  readonly #tracingAgent: ProtocolProxyApi.TracingApi;
  readonly #lynxAgent: LynxAgentApi;
  readonly #pageAgent: ProtocolProxyApi.PageApi;
  readonly #ioAgent: ProtocolProxyApi.IOApi;
  readonly #screencastSetting: Common.Settings.Setting<boolean>;
  #screencastEnabled: boolean;
  #activeClient: TracingManagerClient|null;
  #eventsRetrieved: number;
  #traceDataSizeMB = 0;
  #finishing?: boolean;
  #worker?: Worker;
  #timer?: number;

  constructor(target: SDK.Target.Target) {
    super(target);
    this.#tracingAgent = target.tracingAgent();
    this.#lynxAgent = target.lynxAgent();
    this.#pageAgent = target.pageAgent();
    this.#ioAgent = target.ioAgent();
    this.#screencastSetting =
        Common.Settings.Settings.instance().createSetting<boolean>('screencastEnabled', true);
    this.#screencastEnabled = this.#screencastSetting.get();
    target.registerTracingDispatcher(new TracingDispatcher(this));

    this.#activeClient = null;
    this.#eventsRetrieved = 0;
  }

  bufferUsage(usage?: number, percentFull?: number): void {
    if (this.#activeClient) {
      this.#activeClient.tracingBufferUsage(usage || percentFull || 0);
    }
  }

  eventsCollected(events: Trace.Types.Events.Event[]): void {
    if (!this.#activeClient) {
      return;
    }
    this.#activeClient.traceEventsCollected(events);
    this.#eventsRetrieved += events.length;

    const progress = Math.min((this.#eventsRetrieved / 900_000) + 0.15, 0.90);
    this.#activeClient.eventsRetrievalProgress(progress);
  }

  tracingComplete(args?: Protocol.Tracing.TracingCompleteEvent): void {
    if (args?.stream) {
      void this.#tracingCompleteFromStream(args);
      return;
    }

    this.#eventsRetrieved = 0;
    if (this.#activeClient) {
      this.#activeClient.tracingComplete();
      this.#activeClient = null;
    }
    this.#finishing = false;
  }

  async reset(): Promise<void> {
    if (this.#activeClient) {
      await this.#tracingAgent.invoke_end();
    }
    this.#eventsRetrieved = 0;
    this.#activeClient = null;
    this.#finishLynxTracing(false);
  }

  async start(client: TracingManagerClient, categoryFilter: string): Promise<Protocol.ProtocolResponseWithError> {
    if (this.#activeClient) {
      throw new Error('Tracing is already started');
    }
    this.#activeClient = client;

    const includedCategories = new Set([
      'lynx',
      'vitals',
      'disabled-by-default-devtools.timeline.frame',
      'disabled-by-default-devtools.timeline',
      'jsb',
      'javascript',
    ]);
    for (const category of categoryFilter.split(',')) {
      const trimmed = category.trim();
      if (trimmed && trimmed !== '-*' && trimmed !== '*') {
        includedCategories.add(trimmed);
      }
    }

    const enableSystrace =
        Common.Settings.Settings.instance().createSetting('timelineSystemTrace', false).get();
    if (enableSystrace) {
      includedCategories.add('system');
    }

    const args = {
      streamCompression: Protocol.Tracing.StreamCompression.None,
      streamFormat: Protocol.Tracing.StreamFormat.Proto,
      traceConfig: {
        includedCategories: Array.from(includedCategories),
        excludedCategories: ['*'],
        enableSystrace,
        traceBufferSizeInKb: 50 * 1024,
      },
      transferMode: Protocol.Tracing.StartRequestTransferMode.ReturnAsStream,
    };

    this.#screencastEnabled = this.#screencastSetting.get();
    if (this.#screencastEnabled) {
      this.#screencastSetting.set(false);
    }
    await this.#lynxAgent.invoke_setTraceMode({enableTraceMode: true});
    const response = await this.#tracingAgent.invoke_start(args);
    if (response.getError()) {
      this.#activeClient = null;
      this.#finishLynxTracing(false);
      this.#reportTraceStatistic('start_trace', {result: 'fail', reason: response.getError()});
    } else {
      void this.#pageAgent.invoke_stopScreencast();
      this.#reportTraceStatistic('start_trace', {result: 'success'});
    }

    return response;
  }

  stop(): void {
    if (!this.#activeClient) {
      throw new Error('Tracing is not started');
    }
    if (this.#finishing) {
      throw new Error('Tracing is already being stopped');
    }
    this.#finishing = true;
    void this.#stop();
  }

  async #stop(): Promise<void> {
    const response = await this.#tracingAgent.invoke_end();
    if (response.getError()) {
      this.#activeClient?.tracingComplete();
      this.#activeClient = null;
      this.#finishLynxTracing(false);
    }
  }

  async #tracingCompleteFromStream(args: Protocol.Tracing.TracingCompleteEvent): Promise<void> {
    const client = this.#activeClient;
    if (!client || !args.stream) {
      this.#finishLynxTracing(false);
      return;
    }

    let lynxTracingFinished = false;
    try {
      const response = await this.#readTraceStream(args.stream);
      this.#traceDataSizeMB = response.byteLength / (1024 * 1024);
      this.#reportTraceStatistic('trace_data_transmit', {
        traceDataSizeMBRounded: Math.round(this.#traceDataSizeMB),
      }, {
        traceDataSizeMB: this.#traceDataSizeMB,
        traceDataTransTime: this.#timer ? (Date.now() - this.#timer) / 1000 : 0,
        traceDataTransSpeedy: this.#timer ? this.#traceDataSizeMB / (Date.now() - this.#timer) * 1000 : 0,
      });

      this.#finishLynxTracing(true);
      lynxTracingFinished = true;
      this.#timer = Date.now();
      const conversionResult = await this.#convertTraceData(response);
      if (Array.isArray(conversionResult.traceEvents)) {
        client.traceEventsCollected(conversionResult.traceEvents);
      }
      this.#reportTraceStatistic('trace_data_convert', {
        traceDataSizeMBRounded: Math.round(this.#traceDataSizeMB),
      }, {
        traceDataSizeMB: this.#traceDataSizeMB,
        traceDataConvertTime: this.#timer ? (Date.now() - this.#timer) / 1000 : 0,
        traceDataConvertSpeed: this.#timer ? this.#traceDataSizeMB / (Date.now() - this.#timer) * 1000 : 0,
      });
      client.eventsRetrievalProgress(1);
    } finally {
      if (!lynxTracingFinished) {
        this.#finishLynxTracing(false);
      }
      this.#eventsRetrieved = 0;
      client.tracingComplete();
      this.#activeClient = null;
      this.#finishing = false;
    }
  }

  async #readTraceStream(stream: Protocol.IO.StreamHandle): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    let totalByteLength = 0;
    this.#timer = Date.now();
    while (true) {
      const piece = await this.#ioAgent.invoke_read({
        handle: stream,
        size: 1024 * 1024,
      });
      if (piece.getError()) {
        throw new Error(piece.getError());
      }
      const pieceArr = piece.base64Encoded ? decodeBase64(piece.data) : new TextEncoder().encode(piece.data);
      chunks.push(pieceArr);
      totalByteLength += pieceArr.byteLength;
      this.#activeClient?.eventsRetrievalProgress(Math.min(totalByteLength / (50 * 1024 * 1024), 0.90));
      if (piece.eof) {
        await this.#ioAgent.invoke_close({handle: stream});
        break;
      }
    }

    const response = new Uint8Array(totalByteLength);
    let offset = 0;
    for (const chunk of chunks) {
      response.set(chunk, offset);
      offset += chunk.length;
    }
    return response;
  }

  #convertTraceData(response: Uint8Array): Promise<TraceConversionResult> {
    if (!this.#worker) {
      this.#worker = new Worker(new URL('../../trace/worker.js', import.meta.url), {type: 'module'});
    }

    return new Promise((resolve, reject) => {
      const worker = this.#worker;
      if (!worker) {
        reject(new Error('Trace conversion worker was not created'));
        return;
      }

      worker.onmessage = (event: MessageEvent<TraceWorkerProgress|TraceConversionResult>) => {
        if (isTraceWorkerProgress(event.data)) {
          this.#activeClient?.eventsRetrievalProgress(0.95);
          return;
        }
        resolve(event.data);
      };
      worker.onerror = error => {
        reject(new Error(error.message));
      };
      worker.postMessage(response);
    });
  }

  #finishLynxTracing(reloadPage: boolean): void {
    void this.#lynxAgent.invoke_setTraceMode({enableTraceMode: false});
    if (this.#screencastEnabled) {
      this.#screencastSetting.set(true);
    }
    if (reloadPage) {
      void this.#pageAgent.invoke_reload({});
    }
    this.#finishing = false;
  }

  #reportTraceStatistic(
      action: string, categories: Record<string, unknown> = {}, metrics?: Record<string, unknown>): void {
    const info = (globalThis as typeof globalThis&{info?: LynxRuntimeInfo}).info ?? {};
    Host.InspectorFrontendHost.reportToStatistics('devtool_panel_performance', {
      type: 'lynx',
      action,
      osType: info.osType,
      lynxVersion: info.sdkVersion,
      ...categories,
    }, metrics);
  }
}

export interface TracingManagerClient {
  traceEventsCollected(events: Trace.Types.Events.Event[]): void;

  tracingComplete(): void;
  tracingBufferUsage(usage: number): void;
  eventsRetrievalProgress(progress: number): void;
}

class TracingDispatcher implements ProtocolProxyApi.TracingDispatcher {
  readonly #tracingManager: TracingManager;
  constructor(tracingManager: TracingManager) {
    this.#tracingManager = tracingManager;
  }

  bufferUsage({value, percentFull}: Protocol.Tracing.BufferUsageEvent): void {
    this.#tracingManager.bufferUsage(value, percentFull);
  }

  dataCollected({value}: Protocol.Tracing.DataCollectedEvent): void {
    this.#tracingManager.eventsCollected(value);
  }

  tracingComplete(event: Protocol.Tracing.TracingCompleteEvent): void {
    this.#tracingManager.tracingComplete(event);
  }
}

SDK.SDKModel.SDKModel.register(TracingManager, {capabilities: SDK.Target.Capability.TRACING, autostart: false});
`;

  writeIfChanged(relativePath, lynxTracingManager);
};

const patchPreactDevtoolsPanel = () => {
  const relativePath = 'front_end/panels/preact_devtools/PreactDevtoolsPanel.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (next.includes(`declare global {
  interface Window {
    React: typeof import('react');
    ReactDOM: typeof import('react-dom');
  }
}`)) {
    next = replaceOnce(
        next,
        `declare global {
  interface Window {
    React: typeof import('react');
    ReactDOM: typeof import('react-dom');
  }
}`,
        `type ReactRuntime = {
  createElement: (type: unknown, props: Record<string, unknown>) => unknown,
};

type ReactDOMRuntime = {
  render: (element: unknown, container: Element) => void,
};

declare global {
  interface Window {
    React: ReactRuntime;
    ReactDOM: ReactDOMRuntime;
  }
}`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchPreactDevtoolsMeta = () => {
  const relativePath = 'front_end/panels/preact_devtools/preact_devtools-meta.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (next.includes(`import * as Root from '../../core/root/root.js';
`)) {
    next = replaceOnce(
        next,
        `import * as Root from '../../core/root/root.js';
`,
        ``,
        filePath,
    );
  }

  if (next.includes(`    // Side-effect import resources in module.json
    await Root.Runtime.Runtime.instance().loadModulePromise('panels/preact_devtools');
`)) {
    next = replaceOnce(
        next,
        `    // Side-effect import resources in module.json
    await Root.Runtime.Runtime.instance().loadModulePromise('panels/preact_devtools');
`,
        ``,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchPreactDevtoolsBuild = () => {
  const relativePath = 'front_end/panels/preact_devtools/BUILD.gn';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (next.includes(`devtools_module("preact_devtools") {`)) {
    next = replaceOnce(
        next,
        `devtools_module("preact_devtools") {`,
        `devtools_ui_module("preact_devtools") {`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchDevtoolsAppBuild = () => {
  const relativePath = 'front_end/entrypoints/devtools_app/BUILD.gn';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes(`../../panels/preact_devtools:meta`)) {
    next = replaceOnce(
        next,
        `    "../../panels/performance_monitor:meta",
    "../../panels/recorder:meta",`,
        `    "../../panels/performance_monitor:meta",
    "../../panels/preact_devtools:meta",
    "../../panels/recorder:meta",`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchEntrypointTemplate = () => {
  const relativePath = 'front_end/entrypoint_template.html';
  const {filePath, source} = read(relativePath);
  let next = source;

  next = next.replace(
      /<script>\n\(\(\) => \{\n[\s\S]*?window\.addEventListener\('unhandledrejection', event => \{\n[\s\S]*?\n\}\)\(\);\n<\/script>\n/,
      '',
  );

  if (!next.includes(`https://cdn.jsdelivr.net`)) {
    next = replaceOnce(
        next,
        `  'self' https://chrome-devtools-frontend.appspot.com; img-src 'self' data:; frame-src * data:; connect-src data:`,
        `  'self' https://chrome-devtools-frontend.appspot.com https://cdn.jsdelivr.net https://unpkg.com; img-src 'self' data:; frame-src * data:; connect-src data:`,
        filePath,
    );
  }

  const bootstrapReplacement = `<meta name="referrer" content="no-referrer">
<script src="./base64js.min.js"></script>
<script src="./apexcharts.js"></script>
<script src="./inflate.min.js"></script>
<script src="./compare-versions.js"></script>
<script type="module" src="./entrypoints/%ENTRYPOINT_NAME%/%ENTRYPOINT_NAME%.js"></script>`;

  if (!next.includes(`src="./compare-versions.js"`)) {
    const bootstrapPattern =
        /<meta name="referrer" content="no-referrer">\n[\s\S]*?<script type="module" src="\.\/entrypoints\/%ENTRYPOINT_NAME%\/%ENTRYPOINT_NAME%\.js"><\/script>/;
    if (!bootstrapPattern.test(next)) {
      throw new Error(`Patch anchor not found in ${filePath}: entrypoint bootstrap block`);
    }
    next = next.replace(bootstrapPattern, bootstrapReplacement);
  }

  writeIfChanged(relativePath, next);
};

const patchKitIconStyles = () => {
  const relativePath = 'front_end/ui/kit/icons/icon.css';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes(`  -webkit-mask: var(--icon-url, url("data:image/svg+xml,%3Csvg width='1' height='1' fill='%23000' xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E ")) center / contain no-repeat;`)) {
    next = replaceOnce(
        next,
        `  mask: var(--icon-url, url("data:image/svg+xml,%3Csvg width='1' height='1' fill='%23000' xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E ")) center / contain no-repeat;`,
        `  -webkit-mask: var(--icon-url, url("data:image/svg+xml,%3Csvg width='1' height='1' fill='%23000' xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E ")) center / contain no-repeat;
  mask: var(--icon-url, url("data:image/svg+xml,%3Csvg width='1' height='1' fill='%23000' xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E ")) center / contain no-repeat;`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchTreeOutlineMaskStyles = () => {
  const patches = [
    {
      relativePath: 'front_end/panels/elements/elementsTreeOutline.css',
      replacements: [
        {
          standard: `  mask-image: var(--image-file-arrow-collapse);`,
          webkit: `  -webkit-mask-image: var(--image-file-arrow-collapse);`,
        },
        {
          standard: `  mask-image: var(--image-file-arrow-drop-down);`,
          webkit: `  -webkit-mask-image: var(--image-file-arrow-drop-down);`,
        },
      ],
    },
    {
      relativePath: 'front_end/ui/legacy/treeoutline.css',
      replacements: [
        {
          standard: `  mask-position: left center;`,
          webkit: `  -webkit-mask-position: left center;`,
        },
        {
          standard: `  mask-image: var(--image-file-arrow-collapse);`,
          webkit: `  -webkit-mask-image: var(--image-file-arrow-collapse);`,
        },
        {
          standard: `  mask-image: var(--image-file-arrow-drop-down);`,
          webkit: `  -webkit-mask-image: var(--image-file-arrow-drop-down);`,
        },
      ],
    },
    {
      relativePath: 'front_end/ui/components/tree_outline/treeOutline.css',
      replacements: [
        {
          standard: `  mask-image: var(--image-file-arrow-collapse);`,
          webkit: `  -webkit-mask-image: var(--image-file-arrow-collapse);`,
        },
        {
          standard: `  mask-size: 0;`,
          webkit: `  -webkit-mask-size: 0;`,
        },
        {
          standard: `  mask-image: var(--image-file-arrow-drop-down);`,
          webkit: `  -webkit-mask-image: var(--image-file-arrow-drop-down);`,
        },
      ],
    },
  ];

  for (const {relativePath, replacements} of patches) {
    const {filePath, source} = read(relativePath);
    let next = source;

    for (const {standard, webkit} of replacements) {
      if (next.includes(standard) && !next.includes(webkit)) {
        next = replaceOnce(next, standard, `${webkit}\n${standard}`, filePath);
      }
    }

    writeIfChanged(relativePath, next);
  }
};

const patchTimeUtilities = () => {
  const relativePath = 'front_end/core/i18n/time-utilities.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (next.includes(`unit: 'microsecond'`)) {
    next = replaceOnce(
        next,
        `const narrowMicrosecondsInteger = defineFormatter({
  style: 'unit',
  unit: 'microsecond',
  unitDisplay: 'narrow',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});`,
        `const narrowMicrosecondsInteger = defineFormatter({
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});`,
        filePath,
    );
  }

  if (!next.includes(`\\u03bcs`)) {
    next = replaceOnce(
        next,
        `  if (higherResolution && ms < 0.1) {
    return narrowMicrosecondsInteger.format(ms * 1000);
  }`,
        `  if (higherResolution && ms < 0.1) {
    return \`\${narrowMicrosecondsInteger.format(ms * 1000)}\\xA0\\u03bcs\`;
  }`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchAiAssistanceUnitFormatters = () => {
  const relativePath = 'front_end/models/ai_assistance/data_formatters/UnitFormatters.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (next.includes(`unit: 'microsecond'`)) {
    next = replaceOnce(
        next,
        `  micro: new Intl.NumberFormat('en-US', {
    ...defaultTimeFormatterOptions,
    unit: 'microsecond',
  }),`,
        `  micro: new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),`,
        filePath,
    );
  }

  if (!next.includes(`\\u03bcs`)) {
    next = replaceOnce(
        next,
        `  if (x < 100) {
    return formatAndEnsureSpace(timeFormatters.micro, x);
  }`,
        `  if (x < 100) {
    return \`\${timeFormatters.micro.format(x)}\\xA0\\u03bcs\`;
  }`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchMainImplLoadingProgress = () => {
  const relativePath = 'front_end/entrypoints/main/MainImpl.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes(`#lynxLoadingTimestamps`)) {
    next = replaceOnce(
        next,
        `  #readyForTestPromise = Promise.withResolvers<void>();
  #veStartPromise!: Promise<void>;
  #universe!: Foundation.Universe.Universe;
`,
        `  #readyForTestPromise = Promise.withResolvers<void>();
  #veStartPromise!: Promise<void>;
  #universe!: Foundation.Universe.Universe;
  readonly #lynxLoadingTimestamps = new Map<string, number>();
`,
        filePath,
    );
  }

  if (!next.includes(`#markLynxLoadingProgress(type: string`)) {
    next = replaceOnce(
        next,
        `  static timeEnd(label: string): void {
    if (Host.InspectorFrontendHost.isUnderTest()) {
      return;
    }
    console.timeEnd(label);
  }

  async #loaded(): Promise<void> {`,
        `  static timeEnd(label: string): void {
    if (Host.InspectorFrontendHost.isUnderTest()) {
      return;
    }
    console.timeEnd(label);
  }

  #markLynxLoadingProgress(type: string, message: unknown = null): void {
    Host.InspectorFrontendHost.sendWindowMessage({
      type: 'update_loading_progress',
      content: {
        timestamp: Date.now(),
        type,
        message,
      },
    });
  }

  #startLynxTiming(label: string): void {
    this.#lynxLoadingTimestamps.set(label, Date.now());
  }

  #endLynxTiming(label: string, metricName = label): void {
    const timeStarted = this.#lynxLoadingTimestamps.get(label);
    if (!timeStarted) {
      console.error(\`\${label} does not have a start timestamp\`);
      return;
    }
    Host.InspectorFrontendHost.reportToStatistics('devtool_firstLoad', undefined, {
      [metricName]: Date.now() - timeStarted,
    });
    this.#lynxLoadingTimestamps.delete(label);
  }

  async #loaded(): Promise<void> {`,
        filePath,
    );
  }

  if (!next.includes(`#startLynxTiming('loadEnv')`)) {
    next = replaceOnce(
        next,
        `  async #loaded(): Promise<void> {
    console.timeStamp('Main._loaded');`,
        `  async #loaded(): Promise<void> {
    this.#markLynxLoadingProgress('start_progress', {reason: 'windowLoaded'});
    this.#startLynxTiming('loadEnv');
    console.timeStamp('Main._loaded');`,
        filePath,
    );
  }

  if (!next.includes(`#markLynxLoadingProgress('loadEnv')`)) {
    next = replaceOnce(
        next,
        `    await this.requestAndRegisterLocaleData();

    Host.userMetrics.syncSetting(Common.Settings.Settings.instance().moduleSetting<boolean>('sync-preferences').get());`,
        `    await this.requestAndRegisterLocaleData();

    this.#endLynxTiming('loadEnv');
    this.#markLynxLoadingProgress('loadEnv');

    Host.userMetrics.syncSetting(Common.Settings.Settings.instance().moduleSetting<boolean>('sync-preferences').get());`,
        filePath,
    );
  }

  if (!next.includes(`#startLynxTiming('createAppUI')`)) {
    next = replaceOnce(
        next,
        `  async #createAppUI(): Promise<void> {
    MainImpl.time('Main._createAppUI');

    // Request filesystems early`,
        `  async #createAppUI(): Promise<void> {
    MainImpl.time('Main._createAppUI');
    this.#startLynxTiming('createAppUI');

    // Request filesystems early`,
        filePath,
    );
  }

  if (!next.includes(`#markLynxLoadingProgress('create_appUI')`)) {
    next = replaceOnce(
        next,
        `    MainImpl.timeEnd('Main._createAppUI');

    const appProvider = Common.AppProvider.getRegisteredAppProviders()[0];`,
        `    MainImpl.timeEnd('Main._createAppUI');
    this.#endLynxTiming('createAppUI');
    this.#markLynxLoadingProgress('create_appUI');

    const appProvider = Common.AppProvider.getRegisteredAppProviders()[0];`,
        filePath,
    );
  }

  if (!next.includes(`#startLynxTiming('showAppUI')`)) {
    next = replaceOnce(
        next,
        `  async #showAppUI(appProvider: Object): Promise<void> {
    MainImpl.time('Main._showAppUI');
    const app = (appProvider as Common.AppProvider.AppProvider).createApp();`,
        `  async #showAppUI(appProvider: Object): Promise<void> {
    MainImpl.time('Main._showAppUI');
    this.#startLynxTiming('showAppUI');
    const app = (appProvider as Common.AppProvider.AppProvider).createApp();`,
        filePath,
    );
  }

  if (!next.includes(`#markLynxLoadingProgress('show_appUI')`)) {
    next = replaceOnce(
        next,
        `    window.setTimeout(this.#initializeTarget.bind(this), 0);
    MainImpl.timeEnd('Main._showAppUI');
  }

  async #initializeTarget(): Promise<void> {`,
        `    window.setTimeout(this.#initializeTarget.bind(this), 0);
    MainImpl.timeEnd('Main._showAppUI');
    this.#endLynxTiming('showAppUI');
    this.#markLynxLoadingProgress('show_appUI');
  }

  async #initializeTarget(): Promise<void> {`,
        filePath,
    );
  }

  if (!next.includes(`#startLynxTiming('initializeTarget')`)) {
    next = replaceOnce(
        next,
        `  async #initializeTarget(): Promise<void> {
    MainImpl.time('Main._initializeTarget');

    // We rely on having the early initialization runnables registered`,
        `  async #initializeTarget(): Promise<void> {
    MainImpl.time('Main._initializeTarget');
    this.#startLynxTiming('initializeTarget');

    // We rely on having the early initialization runnables registered`,
        filePath,
    );
  }

  if (!next.includes(`#markLynxLoadingProgress('initialize_target')`)) {
    next = replaceOnce(
        next,
        `    MainImpl.timeEnd('Main._initializeTarget');
  }

  async #maybeInstallVeInspectionBinding(): Promise<void> {`,
        `    MainImpl.timeEnd('Main._initializeTarget');
    this.#endLynxTiming('initializeTarget');
    this.#markLynxLoadingProgress('initialize_target');
  }

  async #maybeInstallVeInspectionBinding(): Promise<void> {`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchOverlayModel = () => {
  const relativePath = 'front_end/core/sdk/OverlayModel.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes(`import {addPluginEventListener} from '../protocol_client/InspectorBackend.js';`)) {
    next = replaceOnce(
        next,
        `import {SDKModel} from './SDKModel.js';
import {Capability, type Target} from './Target.js';
import {TargetManager} from './TargetManager.js';`,
        `import {SDKModel} from './SDKModel.js';
import {Capability, type Target} from './Target.js';
import {TargetManager} from './TargetManager.js';
import {addPluginEventListener} from '../protocol_client/InspectorBackend.js';`,
        filePath,
    );
  }

  if (!next.includes(`const highlightPluginNode = (message: unknown): void => {`)) {
    next = replaceOnce(
        next,
        `    if (!target.suspended()) {
      void this.overlayAgent.invoke_enable();
      void this.wireAgentToSettings();
    }

    this.#persistentHighlighter = new OverlayPersistentHighlighter(this, {`,
        `    if (!target.suspended()) {
      void this.overlayAgent.invoke_enable();
      void this.wireAgentToSettings();
    }

    const highlightPluginNode = (message: unknown): void => {
      if (!message || typeof message !== 'object' || !('UINodeId' in message)) {
        return;
      }
      const nodeId = Number((message as {UINodeId: number|string}).UINodeId);
      if (!Number.isFinite(nodeId)) {
        return;
      }
      const node = this.#domModel.nodeForId(nodeId as Protocol.DOM.NodeId);
      if (!node) {
        return;
      }
      this.highlightInOverlay({node, selectorList: undefined}, 'all', true);
    };

    addPluginEventListener('uitree-panel', highlightPluginNode);
    addPluginEventListener('uitree-drawer', highlightPluginNode);

    window.addEventListener('message', event => {
      const data = event.data as {
        type?: string,
        content?: {type?: string, message?: {UINodeId?: number|string}},
      }|undefined;
      if (!data || data.type !== 'panel:preact_devtools' ||
          data.content?.type !== 'PreactDevtoolsPanelUINodeIdSelected' || !data.content.message?.UINodeId) {
        return;
      }
      highlightPluginNode(data.content.message);
    });

    this.#persistentHighlighter = new OverlayPersistentHighlighter(this, {`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchScreencastView = () => {
  const relativePath = 'front_end/panels/screencast/ScreencastView.ts';
  const {filePath, source} = read(relativePath);
  let next = source;

  if (!next.includes(`import {postPluginMessage} from '../../core/protocol_client/InspectorBackend.js';`)) {
    next = replaceOnce(
        next,
        `import * as UI from '../../ui/legacy/legacy.js';

import {InputModel} from './InputModel.js';`,
        `import * as UI from '../../ui/legacy/legacy.js';
import {postPluginMessage} from '../../core/protocol_client/InspectorBackend.js';

import {InputModel} from './InputModel.js';`,
        filePath,
    );
  }

  if (!next.includes(`const qualityValue = localStorage.getItem('isHD') === 'true' ? 100 : 20;`)) {
    next = replaceOnce(
        next,
        `    dimensions.width *= window.devicePixelRatio;
    dimensions.height *= window.devicePixelRatio;
    // Note: startScreencast width and height are expected to be integers so must be floored.
    this.screencastOperationId = await this.screenCaptureModel.startScreencast(
        Protocol.Page.StartScreencastRequestFormat.Jpeg, 80, Math.floor(Math.min(maxImageDimension, dimensions.width)),
        Math.floor(Math.min(maxImageDimension, dimensions.height)), undefined, this.screencastFrame.bind(this),
        this.screencastVisibilityChanged.bind(this));`,
        `    dimensions.width *= window.devicePixelRatio;
    dimensions.height *= window.devicePixelRatio;
    const qualityValue = localStorage.getItem('isHD') === 'true' ? 100 : 20;
    // Note: startScreencast width and height are expected to be integers so must be floored.
    this.screencastOperationId = await this.screenCaptureModel.startScreencast(
        Protocol.Page.StartScreencastRequestFormat.Jpeg, qualityValue,
        Math.floor(Math.min(maxImageDimension, dimensions.width)),
        Math.floor(Math.min(maxImageDimension, dimensions.height)), undefined, this.screencastFrame.bind(this),
        this.screencastVisibilityChanged.bind(this));`,
        filePath,
    );
  }

  if (!next.includes(`type: 'panel:preact_devtools'`)) {
    next = replaceOnce(
        next,
        `    if (!node) {
      return;
    }

    if (event.type === 'mousemove') {
      void this.updateHighlightInOverlayAndRepaint({node}, this.inspectModeConfig);
      this.domModel.overlayModel().nodeHighlightRequested({nodeId: node.id});
    } else if (event.type === 'click') {
      this.domModel.overlayModel().inspectNodeRequested({backendNodeId: node.backendNodeId()});
    }`,
        `    if (!node) {
      return;
    }

    postPluginMessage('uitree-panel', {UINodeId: node.id});
    postPluginMessage('uitree-drawer', {UINodeId: node.id});
    window.postMessage({
      type: 'panel:preact_devtools',
      content: {
        type: 'ScreenCastPanelUINodeIdSelected',
        message: {UINodeId: node.id},
      },
    }, '*');

    if (event.type === 'mousemove') {
      void this.updateHighlightInOverlayAndRepaint({node}, this.inspectModeConfig);
      this.domModel.overlayModel().nodeHighlightRequested({nodeId: node.id});
    } else if (event.type === 'click') {
      const inspectorView = UI.InspectorView.InspectorView.instance();
      if (inspectorView.tabbedPane.selectedTabId === 'uitree-panel') {
        void inspectorView.showPanel('elements');
        inspectorView.showDrawer({focus: false, hasTargetDrawer: true});
        void UI.ViewManager.ViewManager.instance().showView('uitree-drawer');
        postPluginMessage('uitree-drawer', {UINodeId: node.id});
        this.overlayModel?.setHighlighter(this);
      }
      this.domModel.overlayModel().inspectNodeRequested({backendNodeId: node.backendNodeId()});
    }`,
        filePath,
    );
  }

  if (!next.includes(`const qualityToggleLabel = this.navigationBar.createChild('label');`)) {
    next = replaceOnce(
        next,
        `    this.navigationReload = this.navigationBar.createChild('button', 'navigation');
    this.navigationReload.appendChild(createIcon('refresh'));
    UI.ARIAUtils.setLabel(this.navigationReload, i18nString(UIStrings.reload));

    this.navigationUrl = this.navigationBar.appendChild(UI.UIUtils.createInput());`,
        `    this.navigationReload = this.navigationBar.createChild('button', 'navigation');
    this.navigationReload.appendChild(createIcon('refresh'));
    UI.ARIAUtils.setLabel(this.navigationReload, i18nString(UIStrings.reload));

    const qualityToggleLabel = this.navigationBar.createChild('label');
    qualityToggleLabel.style.display = 'flex';
    qualityToggleLabel.style.alignItems = 'center';
    qualityToggleLabel.style.gap = '4px';
    qualityToggleLabel.style.flex = 'none';
    qualityToggleLabel.style.marginLeft = '8px';
    UI.UIUtils.createTextChild(qualityToggleLabel, 'HD');
    const qualityToggle = qualityToggleLabel.createChild('input') as HTMLInputElement;
    qualityToggle.type = 'checkbox';
    qualityToggle.checked = localStorage.getItem('isHD') === 'true';
    qualityToggle.style.flex = 'none';
    qualityToggle.style.width = '14px';
    qualityToggle.style.margin = '0';

    const modeToggleLabel = this.navigationBar.createChild('label');
    modeToggleLabel.style.display = 'flex';
    modeToggleLabel.style.alignItems = 'center';
    modeToggleLabel.style.gap = '4px';
    modeToggleLabel.style.flex = 'none';
    modeToggleLabel.style.marginLeft = '8px';
    UI.UIUtils.createTextChild(modeToggleLabel, 'Fullscreen');
    const modeToggle = modeToggleLabel.createChild('input') as HTMLInputElement;
    modeToggle.type = 'checkbox';
    modeToggle.checked =
        Common.Settings.Settings.instance().createSetting('pageScreencastMode', 'fullscreen').get() === 'fullscreen';
    modeToggle.style.flex = 'none';
    modeToggle.style.width = '14px';
    modeToggle.style.margin = '0';

    this.navigationUrl = this.navigationBar.appendChild(UI.UIUtils.createInput());`,
        filePath,
    );
  }

  if (!next.includes(`qualityToggle.addEventListener('change', this.navigateScreenCastQuality.bind(this), false);`)) {
    next = replaceOnce(
        next,
        `      this.navigationBack.addEventListener('click', this.navigateToHistoryEntry.bind(this, -1), false);
      this.navigationForward.addEventListener('click', this.navigateToHistoryEntry.bind(this, 1), false);
      this.navigationReload.addEventListener('click', this.navigateReload.bind(this), false);
      this.navigationUrl.addEventListener('keyup', this.navigationUrlKeyUp.bind(this), true);
      this.touchInputToggle.addEventListener('click', this.#toggleTouchEmulation.bind(this, true), false);
      this.mouseInputToggle.addEventListener('click', this.#toggleTouchEmulation.bind(this, false), false);`,
        `      this.navigationBack.addEventListener('click', this.navigateToHistoryEntry.bind(this, -1), false);
      this.navigationForward.addEventListener('click', this.navigateToHistoryEntry.bind(this, 1), false);
      this.navigationReload.addEventListener('click', this.navigateReload.bind(this), false);
      qualityToggle.addEventListener('change', this.navigateScreenCastQuality.bind(this), false);
      modeToggle.addEventListener('change', this.navigationScreenCastModeChange.bind(this), false);
      this.navigationUrl.addEventListener('keyup', this.navigationUrlKeyUp.bind(this), true);
      this.touchInputToggle.addEventListener('click', this.#toggleTouchEmulation.bind(this, true), false);
      this.mouseInputToggle.addEventListener('click', this.#toggleTouchEmulation.bind(this, false), false);`,
        filePath,
    );
  }

  if (!next.includes(`type: 'a11y_mark_lynx'`)) {
    next = replaceOnce(
        next,
        `  private navigateReload(): void {
    if (!this.resourceTreeModel) {
      return;
    }
    this.resourceTreeModel.reloadPage();
  }

  private navigationUrlKeyUp(event: KeyboardEvent): void {`,
        `  private navigateReload(): void {
    if (!this.resourceTreeModel) {
      return;
    }
    this.resourceTreeModel.reloadPage();
    Host.InspectorFrontendHost.sendWindowMessage({
      type: 'a11y_mark_lynx',
      content: {
        type: 'a11y_start_mark',
        message: (globalThis as typeof globalThis&{sessionUrl?: string}).sessionUrl ?? '',
      },
    });
  }

  private navigateScreenCastQuality(event: Event): void {
    localStorage.setItem('isHD', (event.target as HTMLInputElement).checked ? 'true' : 'false');
    this.stopCasting();
    void this.startCasting();
  }

  private navigationScreenCastModeChange(event: Event): void {
    const mode = (event.target as HTMLInputElement).checked ? 'fullscreen' : 'lynxview';
    Common.Settings.Settings.instance().createSetting('pageScreencastMode', 'fullscreen').set(mode);
    this.stopCasting();
    void this.startCasting();
  }

  private navigationUrlKeyUp(event: KeyboardEvent): void {`,
        filePath,
    );
  }

  writeIfChanged(relativePath, next);
};

const patchAll = () => {
  patchInspectorBackend();
  patchGeneratedInspectorBackendCommands();
  patchRuntimeModel();
  patchDebuggerModel();
  patchResourceScriptMapping();
  patchSdkMeta();
  patchScreenCaptureModel();
  patchTracingManager();
  patchPreactDevtoolsPanel();
  patchPreactDevtoolsMeta();
  patchPreactDevtoolsBuild();
  patchDevtoolsAppBuild();
  patchEntrypointTemplate();
  patchKitIconStyles();
  patchTreeOutlineMaskStyles();
  patchTimeUtilities();
  patchAiAssistanceUnitFormatters();
  patchMainImplLoadingProgress();
  patchOverlayModel();
  patchScreencastView();
};

try {
  patchAll();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
