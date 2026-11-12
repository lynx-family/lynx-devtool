import type { SimulatorErrorInfo } from '../errors';
import type { LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterDeviceResult, SimulatorDevice } from '../device';

export type WindowId = string;

export interface SimulatorSize {
  width: number;
  height: number;
}

export interface SimulatorPosition {
  x: number;
  y: number;
}

export interface SimulatorRuntimeOptions {
  size?: SimulatorSize;
  onJSBError?: JSBErrorHandler;
}

/** Handles a URL from a DevTool OpenCard request. */
export type OpenCardCallback = (url: string) => void;

export interface SimulatorDevTool {
  /** Enables or disables the Lynx DevTool. */
  setDevToolEnabled(enabled: boolean): Promise<void>;
  /** Returns whether the Lynx DevTool is enabled. */
  isDevToolEnabled(): Promise<boolean>;
  /** Enables or disables the LogBox. */
  setLogBoxEnabled(enabled: boolean): Promise<void>;
  /** Returns whether the LogBox is enabled. */
  isLogBoxEnabled(): Promise<boolean>;
  /** Sets an OpenCard callback. Pass null to clear the current callback. */
  setOpenCardCallback(callback: OpenCardCallback | null): Promise<void>;
  /** Connects to a remote Lynx DevTool using the given URL. */
  connectDevTool(url: string): Promise<void>;
}

export interface SimulatorDevToolSettingsOptions {
  window?: SimulatorWindowOptions;
}

export interface SimulatorLynxOptions {
  data?: Record<string, unknown>;
  globalProps?: Record<string, unknown>;
}

export interface SimulatorWindowOptions {
  title?: string;
  show?: boolean;
  /** Creates the Lynx view with a windowless renderer. */
  windowless?: boolean;
  /** Device scale factor used by windowless rendering. */
  deviceScaleFactor?: number;
  frame?: boolean;
  transparent?: boolean;
  backgroundColor?: string;
  size?: SimulatorSize;
  position?: SimulatorPosition;
}

export interface SimulatorOpenOptions {
  target: string;
  cwd?: string;
  lynxOptions?: SimulatorLynxOptions;
  window?: SimulatorWindowOptions;
  // TODO: Runtime does not consume this yet. It will be used to load the target
  // into an existing simulator window; `window` remains for new-window options.
  reuseWindow?: WindowId;
  context?: Record<string, unknown>;
  /** Intercepts this window's bridge calls before named handlers. */
  onJSBInvoke?: JSBInvokeHandler;
}

export type SimulatorWindowStatus = 'loading' | 'ready' | 'failed' | 'closed';
export type SimulatorWindowEventType =
  'created' | 'ready' | 'failed' | 'focused' | 'blurred' | 'closed';

// Runtime only exposes window state that it owns and keeps in sync, such as
// load status and simulator-configured size. Native window details that may
// change outside Runtime, such as window position, should be accessed through
// SimulatorWindowRef.getLynxWindow().
export interface SimulatorWindowInfo {
  id: WindowId;
  target: string;
  status: SimulatorWindowStatus;
  size: SimulatorSize;
  windowless: boolean;
  focused: boolean;
  createdAt: number;
  updatedAt: number;
  error?: SimulatorErrorInfo;
}

// Keep this ref focused on simulator-managed behavior. Add methods here only
// when they update Runtime's window model, such as lifecycle or configured
// size. Use getLynxWindow() for native window actions such as changing position
// or sending global events. Closed windows keep their info snapshot but release
// the underlying LynxWindow, so getLynxWindow() can return undefined.
export interface SimulatorWindowRef {
  id: WindowId;
  getInfo(): SimulatorWindowInfo | undefined;
  close(): Promise<void>;
  focus(): Promise<void>;
  setSize(size: SimulatorSize): Promise<void>;
  getLynxWindow(): LynxWindow | undefined;
}

export interface JSBHandlerRegistration {
  name: string;
  handler: JSBHandler;
}

export interface JSBHandlerContext {
  window: SimulatorWindowInfo;
  context?: Record<string, unknown>;
}

export interface JSBInvokeContext extends JSBHandlerContext {
  /** Dispatch the original call to the registered handler. */
  next(): unknown | Promise<unknown>;
}

export type JSBInvokeHandler = (
  name: string,
  params: unknown,
  context: JSBInvokeContext
) => unknown | Promise<unknown>;

export interface JSBErrorContext {
  name: string;
  params: unknown;
  window?: SimulatorWindowInfo;
  context?: Record<string, unknown>;
}

export type JSBHandler = (
  params: unknown,
  context: JSBHandlerContext
) => unknown | Promise<unknown>;

export type JSBErrorHandler = (
  error: SimulatorErrorInfo,
  context: JSBErrorContext
) => unknown | Promise<unknown>;

export interface SimulatorWindowEvent {
  type: SimulatorWindowEventType;
  window: SimulatorWindowInfo;
}

export type Unsubscribe = () => void;
export type WindowEventListener = (event: SimulatorWindowEvent) => void;

export interface SimulatorNativeExtension {
  name?: string;
  setUp(): void | Promise<void>;
}

export interface SimulatorRuntime {
  readonly devTool: SimulatorDevTool;
  open(options: SimulatorOpenOptions): Promise<SimulatorWindowRef>;
  openDevToolSettingsWindow(options?: SimulatorDevToolSettingsOptions): Promise<SimulatorWindowRef>;
  registerDevice(device: SimulatorDevice): RegisterDeviceResult;
  registerDevices(devices: SimulatorDevice[]): RegisterDeviceResult[];
  getDevice(name: string): SimulatorDevice | undefined;
  listDevices(): SimulatorDevice[];
  registerJSBHandler(handler: JSBHandlerRegistration): void;
  registerJSBHandlers(handlers: JSBHandlerRegistration[]): void;
  registerNativeExtension(extension: SimulatorNativeExtension): Promise<void>;
  getWindow(id: WindowId): SimulatorWindowRef | undefined;
  listWindows(): SimulatorWindowInfo[];
  getFocusedWindow(): SimulatorWindowRef | undefined;
  closeAllWindows(): Promise<void>;
  addWindowEventListener(listener: WindowEventListener): Unsubscribe;
  dispose(): Promise<void>;
}
