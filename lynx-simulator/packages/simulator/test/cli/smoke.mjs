// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const packageRoot = path.resolve(import.meta.dirname, '../..');
const cliEntry = path.join(packageRoot, 'bin', 'lynx-simulator.js');
const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

test('prints help without starting the app', () => {
  const help = runCli(['help']);
  assert.match(help, /^Usage: lynx-simulator <command> \[options\]/);
  assert.match(help, /generate: Generate simulator helper files\./);
  assert.equal(runCli(['--help']), help);
  assert.equal(runCli(['-h']), help);

  const openHelp = runCli(['help', 'open']);
  assert.match(openHelp, /^Usage: lynx-simulator open <target> \[options\]/);
  assert.equal(runCli(['open', '--help']), openHelp);
});

test('prints version without starting the app', () => {
  const version = `${packageJson.version}\n`;
  assert.equal(runCli(['version']), version);
  assert.equal(runCli(['--version']), version);
  assert.equal(runCli(['-v']), version);
});

test('lists built-in devices without starting the app', () => {
  const output = runCli(['devices']);
  assert.match(output, /iphone-15/);
  assert.match(output, /pixel-7/);
});

test('generates an empty page environment at the default output path', () => {
  const directory = createTemporaryDirectory();
  try {
    const result = JSON.parse(runCli(['generate', 'page-env'], directory));
    // executeCli runs the CLI in a child process, whose cwd may resolve symlinks
    // such as /var to /private/var on macOS. Use realpathSync so the expected
    // path matches the cwd used by the child process.
    const outputPath = path.join(fs.realpathSync(directory), 'page-env.json');

    assert.equal(result.ok, true);
    assert.equal(result.output, outputPath);
    assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), {
      templateData: {},
      globalProps: {},
      jsb: { bridge: [] },
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('reports command errors as JSON', () => {
  assert.deepEqual(runCliFailure(['unknown']), {
    ok: false,
    code: 'COMMAND_UNKNOWN',
    message: 'Unknown command: unknown',
  });
  assert.deepEqual(runCliFailure(['generate', 'unknown']), {
    ok: false,
    code: 'GENERATE_TARGET_UNSUPPORTED',
    message: 'Unsupported generate target: unknown.',
  });
  assert.deepEqual(runCliFailure(['quit']), {
    ok: false,
    code: 'QUIT_TARGET_REQUIRED',
    message: '--instance or --all is required.',
  });
});

test('routes instance commands without starting a new app', () => {
  assert.deepEqual(runCliFailure(['status', '--instance', 'sim_missing']), {
    ok: false,
    code: 'INSTANCE_NOT_FOUND',
    message: 'Instance not found: sim_missing.',
    instanceId: 'sim_missing',
  });
});

test('lists all simulator instances without starting a new app', () => {
  const homeDirectory = createTemporaryDirectory();

  try {
    assert.deepEqual(JSON.parse(runCli(['status'], packageRoot, homeDirectory)), {
      ok: true,
      instances: [],
    });
  } finally {
    fs.rmSync(homeDirectory, { recursive: true, force: true });
  }
});

test('quits all simulator instances without starting a new app', () => {
  const homeDirectory = createTemporaryDirectory();

  try {
    assert.deepEqual(JSON.parse(runCli(['quit', '--all'], packageRoot, homeDirectory)), {
      ok: true,
      quitInstances: [],
    });
  } finally {
    fs.rmSync(homeDirectory, { recursive: true, force: true });
  }
});

test('clears logs from an isolated simulator data directory', () => {
  const homeDirectory = createTemporaryDirectory();
  const logsDirectory = path.join(homeDirectory, '.lynx-simulator', 'logs');
  fs.mkdirSync(path.join(logsDirectory, 'operations'), { recursive: true });
  fs.mkdirSync(path.join(logsDirectory, 'instances'), { recursive: true });
  fs.writeFileSync(path.join(logsDirectory, 'operations', 'operation.jsonl'), '{}\n');
  fs.writeFileSync(path.join(logsDirectory, 'instances', 'stale.jsonl'), '{}\n');

  try {
    const result = JSON.parse(runCli(['clear-logs'], packageRoot, homeDirectory));
    assert.deepEqual(result, {
      ok: true,
      deletedOperationLogs: 1,
      deletedInstanceLogs: 1,
      keptActiveInstanceLogs: 0,
    });
    assert.equal(fs.existsSync(logsDirectory), false);
  } finally {
    fs.rmSync(homeDirectory, { recursive: true, force: true });
  }
});

// The CLI writes both successful and structured error results to stdout, so
// these commands should not produce stderr output.
function runCli(args, cwd = packageRoot, homeDirectory) {
  const result = executeCli(args, cwd, homeDirectory);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(result.stderr, '');
  return result.stdout;
}

function runCliFailure(args, cwd = packageRoot, homeDirectory) {
  const result = executeCli(args, cwd, homeDirectory);
  assert.equal(result.status, 1, result.stderr || result.error?.message);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

function executeCli(args, cwd = packageRoot, homeDirectory) {
  const isolatedHomeDirectory = homeDirectory ?? createTemporaryDirectory();
  try {
    return spawnSync(process.execPath, [cliEntry, ...args], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: isolatedHomeDirectory,
        USERPROFILE: isolatedHomeDirectory,
        LYNX_SIMULATOR_METRICS_DISABLED: '1',
      },
      timeout: 10_000,
    });
  } finally {
    if (homeDirectory === undefined) {
      fs.rmSync(isolatedHomeDirectory, { recursive: true, force: true });
    }
  }
}

function createTemporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-simulator-cli-'));
}
