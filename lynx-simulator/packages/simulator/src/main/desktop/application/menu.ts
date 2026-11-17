// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as lynxtron from '@lynx-js/lynxtron';
import { showApplicationErrorMessage } from './errors';
import { SimulatorLinks } from './links';
import type { AppTheme } from './theme';
import { APP_ICON_PATH } from './vendorPaths';

const { dialog, Menu, shell } = lynxtron;

interface WindowMenuInfo {
  instanceId: string;
  windowId: string;
  target: string;
  size: {
    width: number;
    height: number;
  };
}

export function setupApplicationMenu(options: {
  theme: AppTheme;
  getWindowInfo: (focusedWindow: lynxtron.BaseWindow | undefined) => WindowMenuInfo | undefined;
  onOpenDevToolSettings: () => void;
  onSetTheme: (theme: AppTheme) => void;
}): void {
  const menu = Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'DevTool Settings...',
          accelerator: 'CommandOrControl+,',
          click: options.onOpenDevToolSettings,
        },
        {
          label: 'Window Info...',
          click: (_menuItem, focusedWindow) => {
            const info = options.getWindowInfo(focusedWindow);
            void showWindowInfoDialog(focusedWindow, info).catch((error) => {
              showApplicationErrorMessage(`Failed to show window info: ${String(error)}`);
            });
          },
        },
        {
          label: 'Theme',
          submenu: [
            {
              label: 'Light',
              type: 'radio',
              checked: options.theme === 'light',
              click: () => options.onSetTheme('light'),
            },
            {
              label: 'Dark',
              type: 'radio',
              checked: options.theme === 'dark',
              click: () => options.onSetTheme('dark'),
            },
          ],
        },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          enabled: SimulatorLinks.documentation.length > 0,
          click: () => openExternalLink('Documentation', SimulatorLinks.documentation),
        },
        {
          label: 'Changelog',
          enabled: SimulatorLinks.changelog.length > 0,
          click: () => openExternalLink('Changelog', SimulatorLinks.changelog),
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
}

async function showWindowInfoDialog(
  focusedWindow: lynxtron.BaseWindow | undefined,
  info: WindowMenuInfo | undefined
): Promise<void> {
  const showMessageBox = (options: lynxtron.MessageBoxOptions) =>
    focusedWindow ? dialog.showMessageBox(focusedWindow, options) : dialog.showMessageBox(options);

  if (!info) {
    await showMessageBox({
      type: 'info',
      title: 'Window Info',
      message: 'No active simulator window.',
      icon: APP_ICON_PATH,
      buttons: ['Close'],
    });
    return;
  }

  await showMessageBox({
    type: 'info',
    title: 'Window Info',
    message: 'Window Info',
    icon: APP_ICON_PATH,
    detail: [
      `Target: ${info.target}`,
      `Size: ${info.size.width} x ${info.size.height}`,
      `Instance ID: ${info.instanceId}`,
      `Window ID: ${info.windowId}`,
    ].join('\n'),
    buttons: ['Close'],
  });
}

function openExternalLink(label: string, url: string): void {
  if (!url) {
    return;
  }
  shell.openExternal(url).catch((error) => {
    showApplicationErrorMessage(`Failed to open ${label}: ${String(error)}`);
  });
}
