// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest';

import { createSimulatorCommandParser } from '../commands';

describe('createSimulatorCommandParser', () => {
  test('parses simulator-specific open options', () => {
    const parser = createSimulatorCommandParser();

    expect(parser.parse(['open', 'https://example.com/template.js'])).toEqual({
      command: 'open',
      args: {
        target: 'https://example.com/template.js',
      },
      options: {},
      rawArgv: ['open', 'https://example.com/template.js'],
    });
    expect(
      parser.parse([
        'open',
        'https://example.com/template.js',
        '--instance',
        'sim_123',
        '--page-env',
        'page-env.json',
        '--connect-devtool',
        'ws://localhost:9222',
      ])
    ).toMatchObject({
      command: 'open',
      args: {
        target: 'https://example.com/template.js',
      },
      options: {
        instance: 'sim_123',
        'page-env': 'page-env.json',
        'connect-devtool': 'ws://localhost:9222',
      },
    });
    expect(
      parser.parse([
        'open',
        'https://example.com/template.js',
        '--window',
        'win_123',
        '--instance',
        'sim_123',
      ])
    ).toMatchObject({
      command: 'open',
      options: {
        window: 'win_123',
        instance: 'sim_123',
      },
    });
  });

  test('parses optional instance options', () => {
    const parser = createSimulatorCommandParser();

    expect(parser.parse(['devtool-settings'])).toEqual({
      command: 'devtool-settings',
      args: {},
      options: {},
      rawArgv: ['devtool-settings'],
    });
    expect(parser.parse(['devtool-settings', '--instance', 'sim_123'])).toMatchObject({
      command: 'devtool-settings',
      options: {
        instance: 'sim_123',
      },
    });
    expect(
      parser.parse(['devtool-settings', '--devtool', 'true', '--logbox', 'false'])
    ).toMatchObject({
      command: 'devtool-settings',
      options: {
        devtool: true,
        logbox: false,
      },
    });
    expect(parser.parse(['devtool-settings', '--status'])).toMatchObject({
      command: 'devtool-settings',
      options: {
        status: true,
      },
    });
    expect(() =>
      parser.parse(['devtool-settings', '--instance', 'sim_123', '--devtool', 'true'])
    ).toThrow('--instance cannot be used with --devtool.');
  });

  test('parses generate page-env output aliases', () => {
    const parser = createSimulatorCommandParser();

    expect(
      parser.parse(['generate', 'page-env', '--recorder', 'recorder.json', '-o', 'page-env.json'])
    ).toMatchObject({
      command: 'generate',
      args: {
        type: 'page-env',
      },
      options: {
        recorder: 'recorder.json',
        output: 'page-env.json',
      },
    });
  });

  test('parses global and instance-scoped status commands', () => {
    const parser = createSimulatorCommandParser();

    expect(parser.parse(['status'])).toMatchObject({
      command: 'status',
      options: {},
    });
    expect(parser.parse(['status', '--instance', 'sim_123'])).toMatchObject({
      command: 'status',
      options: {
        instance: 'sim_123',
      },
    });
    expect(() => parser.parse(['status', '--window', 'win_123'])).toThrow(
      '--window requires --instance.'
    );
    expect(parser.parse(['status', '--instance', 'sim_123', '--window', 'win_123'])).toMatchObject({
      command: 'status',
      options: {
        instance: 'sim_123',
        window: 'win_123',
      },
    });
  });

  test('requires instance for instance-scoped commands', () => {
    const parser = createSimulatorCommandParser();

    expect(
      parser.parse(['connect-devtool', 'ws://localhost:9222', '--instance', 'sim_123'])
    ).toMatchObject({
      command: 'connect-devtool',
      args: {
        url: 'ws://localhost:9222',
      },
      options: {
        instance: 'sim_123',
      },
    });
    expect(() => parser.parse(['connect-devtool', 'ws://localhost:9222'])).toThrow(
      '--instance is required.'
    );

    for (const command of ['focus', 'close']) {
      expect(() => parser.parse([command])).toThrow('--window is required.');
      expect(() => parser.parse([command, '--window', 'win_123'])).toThrow(
        '--instance is required.'
      );
      expect(parser.parse([command, '--instance', 'sim_123', '--window', 'win_123'])).toMatchObject(
        {
          command,
          options: {
            instance: 'sim_123',
            window: 'win_123',
          },
        }
      );
    }
  });

  test('parses instance and global quit commands', () => {
    const parser = createSimulatorCommandParser();

    // Requiring --instance or --all is a simulator dispatch rule.
    expect(parser.parse(['quit'])).toMatchObject({
      command: 'quit',
      options: {},
    });
    expect(parser.parse(['quit', '--instance', 'sim_123'])).toMatchObject({
      command: 'quit',
      options: {
        instance: 'sim_123',
      },
    });
    expect(parser.parse(['quit', '--all'])).toMatchObject({
      command: 'quit',
      options: {
        all: true,
      },
    });
    expect(() => parser.parse(['quit', '--instance', 'sim_123', '--all'])).toThrow(
      '--instance cannot be used with --all.'
    );
  });

  test('keeps simulator command attribution when validation fails', () => {
    const parser = createSimulatorCommandParser();

    expect(parser.tryParse(['status', '--window', 'win_123'])).toMatchObject({
      ok: false,
      recognizedCommand: 'status',
    });
    expect(parser.tryParse(['quit', '--instance', 'sim_123', '--all'])).toMatchObject({
      ok: false,
      recognizedCommand: 'quit',
    });
    expect(parser.tryParse(['clear-logs', '--instance', 'sim_123'])).toMatchObject({
      ok: false,
      recognizedCommand: 'clear-logs',
    });
  });

  test('rejects instance option for commands that do not support it', () => {
    const parser = createSimulatorCommandParser();

    expect(() => parser.parse(['devices', '--instance', 'sim_123'])).toThrow(
      'Unknown option: --instance'
    );
    expect(() => parser.parse(['clear-logs', '--instance', 'sim_123'])).toThrow(
      'Unknown option: --instance'
    );
    expect(() => parser.parse(['generate', 'page-env', '--instance', 'sim_123'])).toThrow(
      'Unknown option: --instance'
    );
  });

  test('includes simulator-specific options in help output', () => {
    const parser = createSimulatorCommandParser();
    parser.extendCommand('generate', {
      reference: 'See /path/to/page-env/README.md for page-env generation, format, and examples.',
    });

    expect(parser.getHelp('open')).toContain(
      '--instance: <string>; optional; Open the page in an existing simulator instance.'
    );
    expect(parser.getHelp('open')).toContain(
      '--page-env: <string>; optional; Provide Lynx page data and JSB mocks using page-env JSON from an HTTP(S) URL, file URL, or local path. Run "lynx-simulator help generate" for generation guidance.'
    );
    expect(parser.getHelp('devtool-settings')).toContain(
      '--instance: <string>; optional; conflicts with --devtool, --logbox, --status; Open the DevTool settings window in an existing simulator instance.'
    );
    expect(parser.getHelp('connect-devtool')).toContain(
      '--instance: <string>; required; Target simulator instance.'
    );
    expect(parser.getHelp('status')).toContain(
      '--instance: <string>; optional; Target simulator instance. If omitted, all running instances are returned.'
    );
    expect(parser.getHelp('status')).toContain(
      '--window: <string>; optional; requires --instance; Target window. If omitted, all windows are returned.'
    );
    expect(parser.getHelp('quit')).toContain(
      '--instance: <string>; optional; conflicts with --all; Target simulator instance. Required unless --all is used.'
    );
    expect(parser.getHelp('quit')).toContain(
      '--all: <boolean>; optional; conflicts with --instance; Quit all running simulator instances.'
    );
    expect(parser.getHelp('generate')).toContain(
      'type: <string>; required; Generation target. Currently supports page-env (Lynx page data and JSB mocks).'
    );
    expect(parser.getHelp('generate')).toContain(
      '--recorder: <string>; optional; Convert a Lynx recorder artifact to page-env. The input may be an HTTP(S) URL, file URL, or local path.'
    );
    expect(parser.getHelp('generate')).toContain(
      '--output, -o: <string>; optional; Output file path. Defaults to page-env.json.'
    );
    expect(parser.getHelp('generate')).toContain(
      'Reference:\n  See /path/to/page-env/README.md for page-env generation, format, and examples.'
    );
    expect(parser.getHelp('generate')).toMatch(/Help:[\s\S]*Reference:/);
  });
});
