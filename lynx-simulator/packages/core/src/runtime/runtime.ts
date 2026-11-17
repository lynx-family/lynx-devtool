import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import type * as Lynxtron from '@lynx-js/lynxtron';

import { SimulatorErrorCodes, type SimulatorErrorCode, type SimulatorErrorInfo } from '../errors';
import { createSimulatorError, toSimulatorErrorInfoWithFallback } from '../errors/error';
import { type RegisterDeviceResult, type SimulatorDevice } from '../device';
import { cloneDevice, getBuiltinDevices, normalizeDeviceName } from '../device/presets';
import { createSimulatorDevTool, type SimulatorDevToolInternal } from './devtool';
import { type LoadTarget, resolveLoadTarget } from './target';
import { loadLynxtron, type LynxtronModule } from '../distribution';
import type {
  JSBErrorContext,
  JSBErrorHandler,
  JSBHandler,
  JSBHandlerRegistration,
  JSBInvokeHandler,
  SimulatorDevToolSettingsOptions,
  SimulatorDevTool,
  SimulatorLynxOptions,
  SimulatorNativeExtension,
  SimulatorOpenOptions,
  SimulatorPosition,
  SimulatorRuntime,
  SimulatorRuntimeOptions,
  SimulatorSize,
  SimulatorWindowEvent,
  SimulatorWindowEventType,
  SimulatorWindowInfo,
  SimulatorWindowRef,
  SimulatorWindowStatus,
  WindowEventListener,
  WindowId,
  Unsubscribe,
} from './types';

type LynxWindow = Lynxtron.LynxWindow;

interface ResolvedSimulatorRuntimeOptions {
  size: SimulatorSize;
  onJSBError?: JSBErrorHandler;
}

interface LynxWindowLoadEvents {
  once(event: typeof LOAD_SUCCESS_EVENT, listener: () => void): this;
  once(
    event: typeof LOAD_ERROR_EVENT,
    listener: (event: unknown, code: unknown, message: unknown) => void
  ): this;
}

type BridgeCallback = {
  sendReply(reply?: unknown): void;
};

interface LynxWindowBridgeEvents {
  on(
    event: typeof BRIDGE_INVOKE_EVENT,
    listener: (callback: BridgeCallback, name: string, params: unknown) => void
  ): this;
}

// Internal window state owned by Runtime. Do not copy LynxWindow state into
// this record unless Runtime controls every update path for that state.
// Runtime keeps closed records for status/history queries, but releases the
// native LynxWindow after close so callers cannot operate on a destroyed window.
type WindowRecord = {
  id: WindowId;
  target: string;
  lynxWindow?: LynxWindow;
  size: SimulatorSize;
  windowless: boolean;
  status: SimulatorWindowStatus;
  context?: Record<string, unknown>;
  onJSBInvoke?: JSBInvokeHandler;
  error?: SimulatorErrorInfo;
  createdAt: number;
  updatedAt: number;
};

const DEFAULT_SIZE = Object.freeze({ width: 390, height: 844 });
const DEFAULT_WINDOW_TITLE = 'Lynx Simulator';
const DEFAULT_DEVTOOL_SETTINGS_TITLE = 'DevTool Settings';
const LOAD_SUCCESS_EVENT = 'ready-to-show';
const LOAD_ERROR_EVENT = '--lynx-error';
const BRIDGE_INVOKE_EVENT = '-lynx-invoke';

let windowSeq = 0;

export function createSimulatorRuntime(options: SimulatorRuntimeOptions = {}): SimulatorRuntime {
  return new SimulatorRuntimeImpl(options);
}

class SimulatorRuntimeImpl implements SimulatorRuntime {
  readonly devTool: SimulatorDevTool;
  #options: ResolvedSimulatorRuntimeOptions;
  #events = new EventEmitter();
  #windows = new Map<WindowId, WindowRecord>();
  #focusedWindowId?: WindowId;
  #nativeExtensions = new Set<SimulatorNativeExtension>();
  #jsbHandlers = new Map<string, JSBHandler>();
  #devices = new Map<string, SimulatorDevice>();
  #lynxtronPromise?: Promise<LynxtronModule>;
  #devTool: SimulatorDevToolInternal;

  constructor(options: SimulatorRuntimeOptions) {
    this.#options = {
      size: options.size ?? DEFAULT_SIZE,
      onJSBError: options.onJSBError,
    };
    // Use a function so Lynxtron is loaded only when a DevTool API is called.
    const loadDevTool = async () => (await this.#getLynxtron()).devtool;
    this.#devTool = createSimulatorDevTool({
      setDevToolEnabled: async (enabled) => {
        return (await loadDevTool()).setDevToolEnabled(enabled);
      },
      isDevToolEnabled: async () => {
        return (await loadDevTool()).isDevtoolEnabled();
      },
      setLogBoxEnabled: async (enabled) => {
        return (await loadDevTool()).setLogboxEnabled(enabled);
      },
      isLogBoxEnabled: async () => {
        return (await loadDevTool()).isLogboxEnabled();
      },
      setOpenCardCallback: async (callback) => {
        return (await loadDevTool()).setOpenCardCallback(callback);
      },
      connectDevTool: async (url) => {
        return (await loadDevTool()).connectDevtool(url);
      },
    });
    this.devTool = this.#devTool;
    this.registerDevices(getBuiltinDevices());
  }

  async open(options: SimulatorOpenOptions): Promise<SimulatorWindowRef> {
    if (!options || typeof options.target !== 'string' || options.target.length === 0) {
      throw runtimeError(
        SimulatorErrorCodes.RuntimeInvalidTarget,
        'runtime.open requires a non-empty target.',
        { target: options?.target }
      );
    }

    const loadTargetInfo = resolveLoadTarget(options.target, options.cwd ?? process.cwd());

    const size = options.window?.size ?? this.#options.size ?? DEFAULT_SIZE;
    validateSize(size, 'runtime.open');
    if (options.window?.position) {
      validatePosition(options.window.position, 'runtime.open');
    }
    if (options.window?.deviceScaleFactor !== undefined) {
      validateDeviceScaleFactor(options.window.deviceScaleFactor, 'runtime.open');
    }

    const { LynxWindow } = await this.#getLynxtron();
    const id = createWindowId();
    const windowOptions: Lynxtron.LynxWindowConstructorOptions = {
      width: size.width,
      height: size.height,
      title: options.window?.title ?? DEFAULT_WINDOW_TITLE,
      backgroundColor: options.window?.backgroundColor,
      show: options.window?.show ?? true,
      x: options.window?.position?.x,
      y: options.window?.position?.y,
    };
    if (options.window?.windowless !== undefined) {
      windowOptions.windowless = options.window.windowless;
    }
    if (options.window?.deviceScaleFactor !== undefined) {
      windowOptions.deviceScaleFactor = options.window.deviceScaleFactor;
    }
    if (options.window?.frame !== undefined) {
      windowOptions.frame = options.window.frame;
    }
    if (options.window?.transparent !== undefined) {
      windowOptions.transparent = options.window.transparent;
    }
    const win = new LynxWindow(windowOptions);

    const record: WindowRecord = {
      id,
      target: options.target,
      lynxWindow: win,
      size,
      windowless: options.window?.windowless ?? false,
      status: 'loading',
      context: options.context,
      onJSBInvoke: options.onJSBInvoke,
      error: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.#windows.set(id, record);
    this.#emitWindowEvent('created', record);

    const windowWithLoadEvents = win as LynxWindow & LynxWindowLoadEvents;
    windowWithLoadEvents.once(LOAD_SUCCESS_EVENT, () => {
      this.#updateWindow(id, { status: 'ready', error: undefined });
      this.#emitWindowEvent('ready', this.#windows.get(id));
    });

    windowWithLoadEvents.once(LOAD_ERROR_EVENT, (_event, code, message) => {
      const error: SimulatorErrorInfo = {
        module: 'runtime',
        code: SimulatorErrorCodes.RuntimeLoadFailed,
        message: String(message),
        details: { lynxCode: String(code) },
      };
      this.#updateWindow(id, { status: 'failed', error });
      this.#emitWindowEvent('failed', this.#windows.get(id));
    });

    win.on('focus', () => {
      this.#focusedWindowId = id;
      this.#emitWindowEvent('focused', this.#windows.get(id));
    });

    win.on('blur', () => {
      if (this.#focusedWindowId === id) {
        this.#focusedWindowId = undefined;
      }
      this.#emitWindowEvent('blurred', this.#windows.get(id));
    });

    win.on('resize', () => {
      const [width, height] = win.getSize();
      this.#updateWindow(id, {
        size: { width, height },
      });
    });

    win.on('closed', () => {
      this.#updateWindow(id, {
        status: 'closed',
        lynxWindow: undefined,
        onJSBInvoke: undefined,
      });
      if (this.#focusedWindowId === id) {
        this.#focusedWindowId = undefined;
      }
      this.#emitWindowEvent('closed', this.#windows.get(id));
    });

    this.#registerBridgeListener(id, win);

    const loadError = loadResolvedTarget(win, loadTargetInfo, options.lynxOptions);
    if (loadError) {
      this.#updateWindow(id, { status: 'failed', error: loadError });
      this.#emitWindowEvent('failed', this.#windows.get(id));
    }

    return this.#toWindowRef(record);
  }

  async openDevToolSettingsWindow(
    options: SimulatorDevToolSettingsOptions = {}
  ): Promise<SimulatorWindowRef> {
    return this.open({
      target: resolveDefaultDevToolSettingsTarget(),
      window: {
        title: DEFAULT_DEVTOOL_SETTINGS_TITLE,
        size: DEFAULT_SIZE,
        ...options.window,
      },
    });
  }

  async registerNativeExtension(extension: SimulatorNativeExtension): Promise<void> {
    if (!extension || typeof extension.setUp !== 'function') {
      throw runtimeError(
        SimulatorErrorCodes.RuntimeInvalidExtension,
        'extension.setUp must be a function.'
      );
    }
    if (this.#nativeExtensions.has(extension)) {
      return;
    }
    await extension.setUp();
    this.#nativeExtensions.add(extension);
  }

  registerDevice(device: SimulatorDevice): RegisterDeviceResult {
    const normalizedDevice = normalizeDevice(device);
    const overwritten = this.#devices.get(normalizedDevice.name);
    this.#devices.set(normalizedDevice.name, normalizedDevice);

    return {
      device: cloneDevice(normalizedDevice),
      overwritten: overwritten ? cloneDevice(overwritten) : undefined,
    };
  }

  registerDevices(devices: SimulatorDevice[]): RegisterDeviceResult[] {
    return devices.map((device) => this.registerDevice(device));
  }

  getDevice(name: string): SimulatorDevice | undefined {
    if (typeof name !== 'string') {
      return undefined;
    }
    const device = this.#devices.get(normalizeDeviceName(name));
    return device ? cloneDevice(device) : undefined;
  }

  listDevices(): SimulatorDevice[] {
    return Array.from(this.#devices.values()).map(cloneDevice);
  }

  registerJSBHandler(handler: JSBHandlerRegistration): void {
    if (!handler || typeof handler.name !== 'string' || handler.name.length === 0) {
      throw runtimeError(
        SimulatorErrorCodes.RuntimeInvalidJSB,
        'registerJSBHandler requires a non-empty name.'
      );
    }
    if (typeof handler.handler !== 'function') {
      throw runtimeError(
        SimulatorErrorCodes.RuntimeInvalidJSB,
        'registerJSBHandler requires a handler function.',
        {
          name: handler.name,
        }
      );
    }
    this.#jsbHandlers.set(handler.name, handler.handler);
  }

  registerJSBHandlers(handlers: JSBHandlerRegistration[]): void {
    for (const handler of handlers) {
      this.registerJSBHandler(handler);
    }
  }

  getWindow(id: WindowId): SimulatorWindowRef | undefined {
    const record = this.#windows.get(id);
    return record ? this.#toWindowRef(record) : undefined;
  }

  listWindows(): SimulatorWindowInfo[] {
    return Array.from(this.#windows.values()).map((record) => this.#toWindowInfo(record));
  }

  getFocusedWindow(): SimulatorWindowRef | undefined {
    return this.#focusedWindowId ? this.getWindow(this.#focusedWindowId) : undefined;
  }

  async closeAllWindows(): Promise<void> {
    await Promise.all(Array.from(this.#windows.keys()).map((id) => this.#closeWindow(id)));
  }

  addWindowEventListener(listener: WindowEventListener): Unsubscribe {
    this.#events.on('window-event', listener);
    return () => this.#events.off('window-event', listener);
  }

  async dispose(): Promise<void> {
    await this.closeAllWindows();
    await this.#devTool.dispose();
    this.#events.removeAllListeners();
    this.#windows.clear();
    this.#focusedWindowId = undefined;
  }

  async #getLynxtron(): Promise<LynxtronModule> {
    if (!this.#lynxtronPromise) {
      this.#lynxtronPromise = loadLynxtron();
    }
    return this.#lynxtronPromise;
  }

  #updateWindow(id: WindowId, patch: Partial<WindowRecord>): void {
    const record = this.#windows.get(id);
    if (!record) {
      return;
    }
    Object.assign(record, patch, { updatedAt: Date.now() });
  }

  #emitWindowEvent(type: SimulatorWindowEventType, record?: WindowRecord): void {
    if (!record) {
      return;
    }
    this.#events.emit('window-event', {
      type,
      window: this.#toWindowInfo(record),
    } satisfies SimulatorWindowEvent);
  }

  #registerBridgeListener(id: WindowId, win: LynxWindow): void {
    const bridgeWindow = win as LynxWindow & LynxWindowBridgeEvents;
    bridgeWindow.on(BRIDGE_INVOKE_EVENT, async (callback, name, params) => {
      const handler = this.#jsbHandlers.get(name);
      const record = this.#windows.get(id);
      if (!record) {
        const error: SimulatorErrorInfo = {
          module: 'runtime',
          code: SimulatorErrorCodes.RuntimeWindowNotFound,
          message: `Window not found: ${id}`,
          details: { windowId: id },
        };
        callback.sendReply(
          await this.#handleJSBError(error, {
            name,
            params,
          })
        );
        return;
      }

      try {
        const context = {
          window: this.#toWindowInfo(record),
          context: record.context,
        };
        const next = () => {
          if (handler) return handler(params, context);
          return this.#handleJSBError(
            {
              module: 'runtime',
              code: SimulatorErrorCodes.RuntimeJSBUnhandled,
              message: `Unhandled JSB: ${name}`,
              details: { name },
            },
            { name, params, ...context }
          );
        };
        const result = await (record.onJSBInvoke
          ? record.onJSBInvoke(name, params, { ...context, next })
          : next());
        callback.sendReply(result);
      } catch (error) {
        const errorInfo = toSimulatorErrorInfoWithFallback(error, {
          module: 'runtime',
          code: SimulatorErrorCodes.RuntimeJSBFailed,
          details: { name },
        });
        callback.sendReply(
          await this.#handleJSBError(errorInfo, {
            name,
            params,
            window: this.#toWindowInfo(record),
            context: record.context,
          })
        );
      }
    });
  }

  async #handleJSBError(error: SimulatorErrorInfo, context: JSBErrorContext): Promise<unknown> {
    if (!this.#options.onJSBError) {
      logJSBError(error, context);
      return undefined;
    }
    return this.#options.onJSBError(error, context);
  }

  #toWindowRef(record: WindowRecord): SimulatorWindowRef {
    return {
      id: record.id,
      getInfo: () => {
        const latest = this.#windows.get(record.id);
        return latest ? this.#toWindowInfo(latest) : undefined;
      },
      close: () => this.#closeWindow(record.id),
      focus: () => this.#focusWindow(record.id),
      setSize: (size) => this.#setWindowSize(record.id, size),
      getLynxWindow: () => record.lynxWindow,
    };
  }

  async #closeWindow(id: WindowId): Promise<void> {
    const record = this.#windows.get(id);
    if (!record || record.status === 'closed' || !record.lynxWindow) {
      return;
    }
    record.lynxWindow.close();
  }

  async #focusWindow(id: WindowId): Promise<void> {
    const record = this.#windows.get(id);
    if (!record || record.status === 'closed' || !record.lynxWindow) {
      return;
    }
    if (record.windowless) {
      throw runtimeError(
        SimulatorErrorCodes.RuntimeWindowOperationUnsupported,
        'focus is not supported for windowless windows.',
        {
          windowId: id,
          operation: 'focus',
        }
      );
    }
    record.lynxWindow.focus();
  }

  async #setWindowSize(id: WindowId, size: SimulatorSize): Promise<void> {
    validateSize(size, 'setSize');

    const record = this.#windows.get(id);
    if (!record || record.status === 'closed' || !record.lynxWindow) {
      return;
    }

    record.lynxWindow.setSize(size.width, size.height);
    this.#updateWindow(id, { size });
  }

  #toWindowInfo(record: WindowRecord): SimulatorWindowInfo {
    return {
      id: record.id,
      target: record.target,
      status: record.status,
      size: record.size,
      windowless: record.windowless,
      error: record.error,
      focused: record.id === this.#focusedWindowId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

function loadResolvedTarget(
  win: LynxWindow,
  target: LoadTarget,
  lynxOptions?: SimulatorLynxOptions
): SimulatorErrorInfo | undefined {
  try {
    if (target.kind === 'file') {
      if (!fs.existsSync(target.path)) {
        return {
          module: 'runtime',
          code: SimulatorErrorCodes.RuntimeLoadFileNotFound,
          message: `Lynx target does not exist: ${target.path}`,
          details: { path: target.path },
        };
      }

      const accepted = win.loadFile(target.path, lynxOptions);
      if (!accepted) {
        return {
          module: 'runtime',
          code: SimulatorErrorCodes.RuntimeLoadRejected,
          message: `LynxWindow rejected file target: ${target.path}`,
          details: { path: target.path },
        };
      }
      return undefined;
    }

    const accepted = win.loadURL(target.url, lynxOptions);
    if (!accepted) {
      return {
        module: 'runtime',
        code: SimulatorErrorCodes.RuntimeLoadRejected,
        message: `LynxWindow rejected URL target: ${target.url}`,
        details: { url: target.url },
      };
    }
    return undefined;
  } catch (error) {
    return toSimulatorErrorInfoWithFallback(error, {
      module: 'runtime',
      code: SimulatorErrorCodes.RuntimeLoadFailed,
      details: target.kind === 'file' ? { path: target.path } : { url: target.url },
    });
  }
}

function createWindowId(): WindowId {
  windowSeq += 1;
  return `win_${Date.now().toString(36)}_${windowSeq.toString(36)}`;
}

function normalizeDevice(device: SimulatorDevice): SimulatorDevice {
  // Runtime guard for JavaScript consumers; TypeScript types are erased at runtime.
  if (!device || typeof device.name !== 'string') {
    throw runtimeError(SimulatorErrorCodes.RuntimeInvalidDevice, 'Device requires a name.');
  }

  const name = normalizeDeviceName(device.name);
  // Keep device names stable for CLI usage and internal lookup.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw runtimeError(
      SimulatorErrorCodes.RuntimeInvalidDevice,
      'Device name must be a kebab-case identifier.',
      {
        name: device.name,
      }
    );
  }

  validateSize(device.size, 'registerDevice');
  if (
    device.devicePixelRatio !== undefined &&
    (typeof device.devicePixelRatio !== 'number' ||
      !Number.isFinite(device.devicePixelRatio) ||
      device.devicePixelRatio <= 0)
  ) {
    throw runtimeError(
      SimulatorErrorCodes.RuntimeInvalidDevice,
      'Device devicePixelRatio must be a positive number.',
      { devicePixelRatio: device.devicePixelRatio }
    );
  }

  return {
    ...device,
    name,
    size: {
      width: device.size.width,
      height: device.size.height,
    },
  };
}

function validateSize(size: SimulatorSize, methodName: string): void {
  if (
    !size ||
    typeof size.width !== 'number' ||
    typeof size.height !== 'number' ||
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw runtimeError(
      SimulatorErrorCodes.RuntimeInvalidSize,
      `${methodName} requires a positive width and height.`,
      { size }
    );
  }
}

function validatePosition(position: SimulatorPosition, methodName: string): void {
  if (
    !position ||
    typeof position.x !== 'number' ||
    typeof position.y !== 'number' ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y)
  ) {
    throw runtimeError(
      SimulatorErrorCodes.RuntimeInvalidPosition,
      `${methodName} requires a finite x and y.`,
      { position }
    );
  }
}

function validateDeviceScaleFactor(deviceScaleFactor: number, methodName: string): void {
  if (
    typeof deviceScaleFactor !== 'number' ||
    !Number.isFinite(deviceScaleFactor) ||
    deviceScaleFactor <= 0
  ) {
    throw runtimeError(
      SimulatorErrorCodes.RuntimeInvalidDeviceScaleFactor,
      `${methodName} requires a positive deviceScaleFactor.`,
      { deviceScaleFactor }
    );
  }
}

function resolveDefaultDevToolSettingsTarget(): string {
  return path.join(__dirname, 'assets', 'devtool-settings.js');
}

function runtimeError(
  code: SimulatorErrorCode,
  message: string,
  details?: Record<string, unknown>
) {
  return createSimulatorError({
    module: 'runtime',
    code,
    message,
    details,
  });
}

function logJSBError(error: SimulatorErrorInfo, context: JSBErrorContext): void {
  console.error(`[lynx-simulator-core] JSB error ${error.code}: ${error.message}`, {
    name: context.name,
    windowId: context.window?.id,
    details: error.details,
  });
}
