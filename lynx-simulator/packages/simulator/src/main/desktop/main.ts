// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as lynxtron from '@lynx-js/lynxtron';
import fs from 'node:fs';
import {
  createSimulatorRuntime,
  createPageEnvironmentManager,
  formatDevices,
  toSimulatorErrorInfo,
  type ParsedCommandContext,
  type WindowId,
} from '@lynx-js/lynx-simulator-core';
import { showApplicationErrorMessage, showErrorInfo } from './application/errors';
import { setupApplicationMenu } from './application/menu';
import { getOpenDeviceScaleFactor, resolveOpenSize } from './support/openOptions';
import { applyDevToolConfig } from './support/devtool';
import { registerOpenCardHandler } from './support/openCard';
import { registerApplicationJSBHandlers } from './jsb/handlers';
import { createDesktopJSBHandlers, setupDesktopExtensions } from './extensions';
import { startInstanceIpcServer, type InstanceIpcServer } from './instance/ipc';
import { createInstanceRequestHandler } from './instance/handlers';
import { createInstanceId } from '../../shared/instanceRegistry';
import type { InstanceResponse } from '../../shared/instanceProtocol';
import { writeInstanceLog } from '../../shared/logs';
import { ActionTriggers } from './support/actionTriggers';
import {
  getAppTheme,
  getAppWindowBackgroundColor,
  setAppTheme,
  type AppTheme,
} from './application/theme';
import { APP_ICON_PATH, LYNX_BUNDLE_PATH } from './application/vendorPaths';
import { createSimulatorCommandParser } from '../../shared/commands';

setupDesktopExtensions();

const { app } = lynxtron;

const appVersion = app.getVersion();
const lynxtronVersion = process.versions.lynxtron ?? '0.0.0';

const parser = createSimulatorCommandParser({
  version: appVersion,
});

const runtime = createSimulatorRuntime({
  size: {
    width: 390,
    height: 844,
  },
  onJSBError: (error) => {
    return {
      ok: false,
      message: `[${error.code}] ${error.message}`,
    };
  },
});

let homeWindowId: WindowId | undefined;
let instanceServer: InstanceIpcServer | undefined;
let applicationState: 'running' | 'cleaning-up' | 'quit-allowed' = 'running';

const WindowTypes = {
  Home: 'home',
  Page: 'page',
  DevToolSettings: 'devtool-settings',
} as const;

process.on('uncaughtExceptionMonitor', (error) => {
  recordInstanceEvent('uncaught-exception', {
    error: formatProcessError(error),
  });
  console.error(
    `[lynx-simulator] Uncaught exception: ${error instanceof Error ? error.message : String(error)}`
  );
});

process.on('unhandledRejection', (reason) => {
  recordInstanceEvent('unhandled-rejection', {
    error: formatProcessError(reason),
  });
  console.error(
    `[lynx-simulator] Unhandled rejection: ${
      reason instanceof Error ? reason.message : String(reason)
    }`
  );
});

registerApplicationJSBHandlers({
  runtime,
  cwd: process.cwd(),
  writeLog: recordInstanceEvent,
});
const pageEnvironment = createPageEnvironmentManager({
  runtime,
  realHandlers: createDesktopJSBHandlers(runtime),
  onDispatch: recordInstanceEvent,
});

runtime.addWindowEventListener((event) => {
  const { window } = event;
  console.log(
    `[lynx-simulator] window ${event.type}: ${window.id} ${window.status} ${window.target}`
  );
  recordInstanceEvent('window-event', {
    type: event.type,
    window,
  });

  if (event.type === 'closed') {
    if (window.id === homeWindowId) {
      homeWindowId = undefined;
    }
  }
});

app.on('window-all-closed', () => {
  recordInstanceEvent('window-all-closed');
  shutdownApplication().catch((error) => {
    console.warn(`[lynx-simulator] Failed to quit: ${String(error)}`);
    app.quit();
  });
});

app.on('before-quit', (event) => {
  if (applicationState === 'quit-allowed') {
    return;
  }

  // A quit request can come from the menu, shortcut, or window close. We need
  // async cleanup first, so stop this quit attempt and let shutdownApplication()
  // call app.quit() again after cleanup is complete.
  event.preventDefault();
  shutdownApplication().catch((error) => {
    console.warn(`[lynx-simulator] Failed to quit: ${String(error)}`);
    app.quit();
  });
});

app.whenReady().then(async () => {
  try {
    setupApplicationIdentity();
    updateApplicationMenu();
    await executeLaunchCommand(getCommandArgv(process.argv));
  } catch (error) {
    const errorInfo = toSimulatorErrorInfo(error);
    recordInstanceEvent('startup-failed', {
      code: errorInfo.code,
      message: errorInfo.message,
      details: errorInfo.details,
    });
    if (
      !writeCliLaunchResult({
        ok: false,
        code: errorInfo.code,
        message: errorInfo.message,
      })
    ) {
      showErrorInfo(errorInfo);
    }
    await shutdownApplication();
  }
});

function setupApplicationIdentity(): void {
  app.setName('Lynx Simulator');

  app.setAboutPanelOptions({
    applicationName: 'Lynx Simulator',
    applicationVersion: appVersion,
    version: lynxtronVersion,
    copyright: 'Copyright © 2026 The Lynx Authors',
    iconPath: APP_ICON_PATH,
  });

  try {
    app.dock?.setIcon(APP_ICON_PATH);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[lynx-simulator] Failed to set dock icon: ${message}`);
  }
}

async function executeLaunchCommand(argv: string[]) {
  if (argv.length === 0) {
    await openHomeWindow();
    return;
  }

  const parsed = parser.parse(argv);

  switch (parsed.command) {
    case 'devices':
      printDevices();
      await shutdownApplication();
      return;
    case 'devtool-settings':
      await handleDevToolSettingsLaunchCommand(parsed);
      return;
    case 'open':
      await openFromLaunchCommand(parsed);
      return;
    default:
      throw new Error(`Cannot handle command: ${parsed.command}.`);
  }
}

async function openFromLaunchCommand(parsed: ParsedCommandContext): Promise<void> {
  if (typeof parsed.options.window === 'string') {
    const message = 'open --window requires --instance.';
    if (
      !writeCliLaunchResult({
        ok: false,
        code: 'WINDOW_REUSE_REQUIRES_INSTANCE',
        message,
      })
    ) {
      showApplicationErrorMessage(`[WINDOW_REUSE_REQUIRES_INSTANCE] ${message}`);
    }
    await shutdownApplication();
    return;
  }

  await ensureInstanceServer();
  recordInstanceEvent('command', {
    trigger: ActionTriggers.LaunchCommand,
    command: parsed.command,
    rawArgv: parsed.rawArgv,
  });
  if (typeof parsed.options['connect-devtool'] === 'string') {
    await runtime.devTool.connectDevTool(parsed.options['connect-devtool']);
  }
  const target = parsed.args.target as string;
  const sizeResult = resolveOpenSize(parsed.options, runtime);
  if (sizeResult.error) {
    if (
      !writeCliLaunchResult({
        ok: false,
        message: sizeResult.error,
      })
    ) {
      showApplicationErrorMessage(sizeResult.error);
    }
    await shutdownApplication();
    return;
  }

  const source = parsed.options['page-env'];
  const ref = await pageEnvironment.open({
    target,
    cwd: process.cwd(),
    pageEnvironment: typeof source === 'string' ? source || undefined : undefined,
    window: {
      size: sizeResult.size,
      backgroundColor: getAppWindowBackgroundColor(),
      windowless: parsed.options.windowless === true,
      deviceScaleFactor: getOpenDeviceScaleFactor(parsed.options, runtime),
    },
  });
  const error = ref.getInfo()?.error;
  if (error) {
    if (
      !writeCliLaunchResult({
        ok: false,
        code: error.code,
        message: error.message,
      })
    ) {
      showErrorInfo(error);
    }
    await shutdownApplication();
    return;
  }
  writeCliLaunchResult({
    ok: true,
    windowType: WindowTypes.Page,
    instanceId: instanceServer?.record.instanceId,
    windowId: ref.id,
  });
}

async function handleDevToolSettingsLaunchCommand(parsed: ParsedCommandContext): Promise<void> {
  if (
    parsed.options.devtool !== undefined ||
    parsed.options.logbox !== undefined ||
    parsed.options.status !== undefined
  ) {
    await applyDevToolConfig(runtime.devTool, {
      devToolEnabled: parsed.options.devtool,
      logBoxEnabled: parsed.options.logbox,
    });
    const [devToolEnabled, logBoxEnabled] = await Promise.all([
      runtime.devTool.isDevToolEnabled(),
      runtime.devTool.isLogBoxEnabled(),
    ]);
    writeCliLaunchResult({
      ok: true,
      devToolEnabled,
      logBoxEnabled,
    });
    await shutdownApplication();
    return;
  }

  await ensureInstanceServer();
  recordInstanceEvent('command', {
    trigger: ActionTriggers.LaunchCommand,
    command: parsed.command,
    rawArgv: parsed.rawArgv,
  });

  const result = await openDevToolSettingsWindow({
    trigger: ActionTriggers.LaunchCommand,
  });
  writeCliLaunchResult(result);
  if (result.ok === false) {
    await shutdownApplication();
  }
}

function printDevices(): void {
  const output = formatDevices(runtime.listDevices());
  if (!writeCliLaunchResult({ ok: true, output, stdout: 'text' })) {
    console.log(output);
  }
}

async function openHomeWindow() {
  await ensureInstanceServer();
  recordInstanceEvent('command', {
    trigger: ActionTriggers.LaunchCommand,
    command: '',
    rawArgv: [],
  });

  const homeWindow = await runtime.open({
    target: LYNX_BUNDLE_PATH,
    cwd: process.cwd(),
    lynxOptions: {
      globalProps: getHomeGlobalProps(),
    },
    window: {
      title: 'Lynx Simulator',
      size: {
        width: 760,
        height: 560,
      },
      backgroundColor: getAppWindowBackgroundColor(),
    },
  });
  const error = homeWindow.getInfo()?.error;
  if (error) {
    recordInstanceEvent('home-failed', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    if (
      !writeCliLaunchResult({
        ok: false,
        code: error.code,
        message: error.message,
      })
    ) {
      showErrorInfo(error);
    }
    await shutdownApplication();
    return;
  }

  homeWindowId = homeWindow.id;
  recordInstanceEvent('home-opened', {
    windowId: homeWindow.id,
  });
  writeCliLaunchResult({
    ok: true,
    windowType: WindowTypes.Home,
    instanceId: instanceServer?.record.instanceId,
    windowId: homeWindow.id,
  });
}

async function openDevToolSettingsWindow(options: {
  trigger: (typeof ActionTriggers)[keyof typeof ActionTriggers];
}): Promise<InstanceResponse> {
  const ref = await runtime.openDevToolSettingsWindow({
    window: {
      backgroundColor: getAppWindowBackgroundColor(),
    },
  });
  const error = ref.getInfo()?.error;
  if (error) {
    recordInstanceEvent('devtool-settings-failed', {
      trigger: options.trigger,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return {
      ok: false,
      code: error.code,
      message: error.message,
    };
  }

  recordInstanceEvent('devtool-settings-opened', {
    trigger: options.trigger,
    windowId: ref.id,
  });

  return {
    ok: true,
    windowType: WindowTypes.DevToolSettings,
    instanceId: instanceServer?.record.instanceId,
    windowId: ref.id,
  };
}

function applyAppTheme(theme: AppTheme): void {
  recordInstanceEvent('theme-change-requested', {
    theme,
  });
  setAppTheme(theme);
  setAllWindowBackgroundColor(getAppWindowBackgroundColor());
  syncHomeTheme();
  updateApplicationMenu();
  recordInstanceEvent('theme-change-applied', {
    theme,
  });
}

function updateApplicationMenu(): void {
  setupApplicationMenu({
    theme: getAppTheme(),
    getWindowInfo: (focusedWindow) => {
      if (!instanceServer) {
        return undefined;
      }

      const window = runtime
        .listWindows()
        .find(({ id }) => runtime.getWindow(id)?.getLynxWindow() === focusedWindow);
      return window
        ? {
            instanceId: instanceServer.record.instanceId,
            windowId: window.id,
            target: window.target,
            size: window.size,
          }
        : undefined;
    },
    onOpenDevToolSettings: () => {
      openDevToolSettingsWindow({ trigger: ActionTriggers.Menu })
        .then((result) => {
          if (result.ok === false) {
            showApplicationErrorMessage(
              result.code && result.message
                ? `[${String(result.code)}] ${String(result.message)}`
                : String(result.message ?? 'Failed to open DevTool settings.')
            );
          }
        })
        .catch((error) => {
          const errorInfo = toSimulatorErrorInfo(error);
          recordInstanceEvent('devtool-settings-failed', {
            code: errorInfo.code,
            message: errorInfo.message,
            details: errorInfo.details,
          });
          showErrorInfo(errorInfo);
        });
    },
    onSetTheme: applyAppTheme,
  });
}

function syncHomeTheme(): void {
  if (!homeWindowId) {
    return;
  }
  const homeWindow = runtime.getWindow(homeWindowId);
  const homeWindowInfo = homeWindow?.getInfo();
  if (!homeWindow || homeWindowInfo?.status === 'closed') {
    return;
  }

  try {
    homeWindow.getLynxWindow()?.setGlobalProps(getHomeGlobalProps());
  } catch (error) {
    const errorInfo = toSimulatorErrorInfo(error);
    recordInstanceEvent('theme-change-failed', {
      windowId: homeWindowId,
      code: errorInfo.code,
      message: errorInfo.message,
      details: errorInfo.details,
    });
  }
}

function setAllWindowBackgroundColor(color: string): void {
  for (const window of runtime.listWindows()) {
    if (window.status === 'closed') {
      continue;
    }

    try {
      runtime.getWindow(window.id)?.getLynxWindow()?.setBackgroundColor(color);
    } catch (error) {
      const errorInfo = toSimulatorErrorInfo(error);
      recordInstanceEvent('theme-change-failed', {
        windowId: window.id,
        code: errorInfo.code,
        message: errorInfo.message,
        details: errorInfo.details,
      });
    }
  }
}

function formatProcessError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    type: typeof error,
    message: String(error),
    value: error,
  };
}

function getHomeGlobalProps(): Record<string, unknown> {
  return {
    simulatorTheme: getAppTheme(),
    simulatorDevices: runtime.listDevices(),
  };
}

function getCommandArgv(argv: string[]) {
  const separatorIndex = argv.indexOf('--');
  return separatorIndex >= 0 ? argv.slice(separatorIndex + 1) : [];
}

async function ensureInstanceServer(): Promise<InstanceIpcServer> {
  if (!instanceServer) {
    await registerOpenCardHandler({
      runtime,
      getBackgroundColor: getAppWindowBackgroundColor,
      writeLog: recordInstanceEvent,
    });
    const instanceId = createInstanceId();
    instanceServer = await startInstanceIpcServer({
      instanceId,
      handleRequest: createInstanceRequestHandler({
        parser,
        runtime,
        pageEnvironment,
        instanceId,
        openDevToolSettingsWindow: () => {
          return openDevToolSettingsWindow({
            trigger: ActionTriggers.InstanceCommand,
          });
        },
        focusApplication: () => {
          app.focus?.({ steal: true });
        },
        shutdownApplication,
        writeLog: recordInstanceEvent,
      }),
    });
  }
  return instanceServer;
}

async function closeInstanceServer(): Promise<void> {
  if (!instanceServer) {
    return;
  }
  const server = instanceServer;
  instanceServer = undefined;
  await server.close();
}

async function shutdownApplication(): Promise<void> {
  if (applicationState !== 'running') {
    return;
  }

  // Quit state flow: running -> cleaning-up -> quit-allowed. cleaning-up keeps
  // cleanup running once, and quit-allowed lets before-quit pass through.
  applicationState = 'cleaning-up';
  const instanceId = instanceServer?.record.instanceId;
  recordInstanceEvent('shutdown-started', { instanceId }, instanceId);

  await closeInstanceServer();
  await runtime.dispose();
  pageEnvironment.dispose();

  applicationState = 'quit-allowed';
  recordInstanceEvent('shutdown-ready', { instanceId }, instanceId);
  app.quit();
}

// Only used when the CLI starts a new app process. Returns true when the
// result belongs to that CLI launch flow.
function writeCliLaunchResult(result: InstanceResponse): boolean {
  if (!isCliLaunchMode()) {
    return false;
  }

  recordInstanceEvent('command-result', {
    trigger: ActionTriggers.LaunchCommand,
    result,
  });

  // The app writes the launch command result to this temporary file so the
  // launcher process can read and print it.
  // Later --instance commands return through IPC instead.
  const resultFile = process.env.LYNX_SIMULATOR_RESULT_FILE;
  if (!resultFile) {
    console.warn('[lynx-simulator] Missing CLI launch result file.');
    return true;
  }

  try {
    fs.writeFileSync(resultFile, `${JSON.stringify(result)}\n`);
  } catch (error) {
    console.warn(`[lynx-simulator] Failed to write CLI launch result: ${String(error)}`);
  }
  return true;
}

// The CLI launcher sets this temporary result file path when it starts a new app process.
function isCliLaunchMode(): boolean {
  return typeof process.env.LYNX_SIMULATOR_RESULT_FILE === 'string';
}

function recordInstanceEvent(
  event: string,
  detail: Record<string, unknown> = {},
  instanceId = instanceServer?.record.instanceId
): void {
  writeInstanceLog(instanceId, {
    event,
    detail,
  });
}
