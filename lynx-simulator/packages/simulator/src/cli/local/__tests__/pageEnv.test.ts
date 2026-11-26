// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { ParsedCommandContext } from '@lynx-js/lynx-simulator-core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createSimulatorCommandParser } from '../../../shared/commands';
import { handleGenerateCommand } from '../pageEnv';

vi.mock('../../package', () => ({
  getPageEnvGuidePath: vi.fn(() => '/path/to/page-env/README.md'),
}));

let tempDirectory: string;

beforeEach(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-simulator-page-env-'));
});

afterEach(() => {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('generate page-env', () => {
  test('writes an empty page environment without recorder input', async () => {
    const output = path.join(tempDirectory, 'empty-page-env.json');

    await expect(runGeneratePageEnv(['generate', 'page-env', '--output', output])).resolves.toEqual(
      {
        ok: true,
        output,
        reference: '/path/to/page-env/README.md',
        templateData: true,
        globalProps: true,
        jsb: {
          bridge: 0,
        },
      }
    );

    expect(readJSON(output)).toEqual({
      templateData: {},
      globalProps: {},
      jsb: {
        bridge: [],
      },
    });
  });

  test('loads recorder input from a file URL', async () => {
    const recorder = path.join(tempDirectory, 'recorder.json');
    const output = path.join(tempDirectory, 'file-url.json');
    fs.writeFileSync(
      recorder,
      JSON.stringify({
        'Action List': [
          {
            'Function Name': 'loadTemplate',
            Params: {
              templateData: {
                title: 'From file URL',
              },
            },
          },
        ],
      })
    );

    await runGeneratePageEnv([
      'generate',
      'page-env',
      '--recorder',
      pathToFileURL(recorder).href,
      '--output',
      output,
    ]);

    expect(readJSON(output).templateData).toEqual({
      title: 'From file URL',
    });
  });

  test.each(['loadTemplate', 'loadTemplateBundle'])(
    'extracts template data from %s actions',
    async (functionName) => {
      const recorder = path.join(tempDirectory, 'recorder.json');
      const output = path.join(tempDirectory, 'page-env.json');
      fs.writeFileSync(
        recorder,
        JSON.stringify({
          'Action List': [
            {
              'Function Name': functionName,
              Params: {
                templateData: {
                  title: 'Template data',
                },
              },
            },
          ],
        })
      );

      const result = await runGeneratePageEnv([
        'generate',
        'page-env',
        '--recorder',
        recorder,
        '--output',
        output,
      ]);

      expect(result.templateData).toBe(true);
      expect(readJSON(output).templateData).toEqual({
        title: 'Template data',
      });
    }
  );
});

async function runGeneratePageEnv(argv: string[]) {
  const parser = createSimulatorCommandParser();
  const parsed = parser.parse(argv);
  expect(parsed).toBeDefined();
  return handleGenerateCommand(parsed as ParsedCommandContext, process.cwd());
}

function readJSON(filePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>;
}
