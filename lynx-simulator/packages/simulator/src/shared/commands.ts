// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createCommandParser } from '@lynx-js/lynx-simulator-core';
import type { CommandOptionDefinition, CommandParser } from '@lynx-js/lynx-simulator-core';

export interface CreateSimulatorCommandParserOptions {
  version?: string;
}

export function createSimulatorCommandParser(options: CreateSimulatorCommandParserOptions = {}) {
  const parser = createCommandParser({
    name: 'lynx-simulator',
    version: options.version ?? '0.0.1',
  });
  registerSimulatorCommands(parser);
  return parser;
}

function registerSimulatorCommands(commandParser: CommandParser): void {
  commandParser.extendCommand('open', {
    options: [
      {
        ...createInstanceOption(false),
        description: 'Open the page in an existing simulator instance.',
      },
      {
        name: 'page-env',
        type: 'string',
        description:
          'Provide Lynx page data and JSB mocks using page-env JSON from an HTTP(S) URL, file URL, or local path. Run "lynx-simulator help generate" for generation guidance. Local .mjs/.js factory modules are also supported.',
      },
    ],
  });
  commandParser.extendCommand('devtool-settings', {
    options: [
      {
        ...createInstanceOption(false),
        conflictsWith: ['devtool', 'logbox', 'status'],
        description: 'Open the DevTool settings window in an existing simulator instance.',
      },
    ],
  });
  commandParser.extendCommand('connect-devtool', {
    options: [createInstanceOption(true)],
  });
  commandParser.extendCommand('status', {
    options: [
      {
        ...createInstanceOption(false),
        description: 'Target simulator instance. If omitted, all running instances are returned.',
      },
      {
        name: 'window',
        type: 'string',
        requires: 'instance',
        description: 'Target window. If omitted, all windows are returned.',
      },
    ],
  });
  commandParser.extendCommand('focus', {
    options: [createInstanceOption(true)],
  });
  commandParser.extendCommand('close', {
    options: [createInstanceOption(true)],
  });
  commandParser.registerCommand({
    name: 'quit',
    description: 'Quit one or all simulator instances.',
    options: [
      {
        ...createInstanceOption(false),
        conflictsWith: 'all',
        description: 'Target simulator instance. Required unless --all is used.',
      },
      {
        name: 'all',
        type: 'boolean',
        conflictsWith: 'instance',
        description: 'Quit all running simulator instances.',
      },
    ],
  });
  commandParser.registerCommand({
    name: 'clear-logs',
    description: 'Clear simulator logs.',
  });
  commandParser.registerCommand({
    name: 'generate',
    description: 'Generate simulator helper files.',
    arguments: [
      {
        name: 'type',
        type: 'string',
        required: true,
        description:
          'Generation target. Currently supports page-env (Lynx page data and JSB mocks).',
      },
    ],
    options: [
      {
        name: 'recorder',
        type: 'string',
        description:
          'Convert a Lynx recorder artifact to page-env. The input may be an HTTP(S) URL, file URL, or local path.',
      },
      {
        name: 'output',
        aliases: ['o'],
        type: 'string',
        description: 'Output file path. Defaults to page-env.json.',
      },
    ],
  });
}

function createInstanceOption(required: boolean): CommandOptionDefinition {
  return {
    name: 'instance',
    type: 'string',
    required,
    description: 'Target simulator instance.',
  };
}
