// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Menu, MenuItemConstructorOptions, app, shell } from 'electron';
import prompt from 'electron-prompt';
import LDT from '../App';

const menuTemplate: MenuItemConstructorOptions[] = [
  {
    label: 'Lynx DevTool',
    id: 'app',
    submenu: [
      {
        role: 'about'
      },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'forceReload' },
      { type: 'separator' },
      { role: 'toggleDevTools', accelerator: 'F12' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'delete' },
      { type: 'separator' },
      { role: 'selectAll' }
    ]
  }
];

const menu = Menu.buildFromTemplate(menuTemplate);
export default menu;
