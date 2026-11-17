import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { UPDATE_REGISTRY_TTL_MS } from '../state';
import { refreshUpdateCheck } from '../check';
import { runUpdateManager } from '../manager';

const originalNoColor = process.env.NO_COLOR;
let stateDirectory: string;

beforeEach(() => {
  stateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-simulator-updates-'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalNoColor === undefined) {
    delete process.env.NO_COLOR;
  } else {
    process.env.NO_COLOR = originalNoColor;
  }
  fs.rmSync(stateDirectory, { recursive: true, force: true });
});

test('prints a cached update once and does not start a fresh worker', () => {
  writeCheckCache({ lastCheckedAtMs: 10_000, latestVersion: '1.3.0' });
  const messages: string[] = [];
  let workerStarts = 0;

  runUpdateManager({
    stateDirectory,
    command: 'open',
    currentVersion: '1.2.0',
    env: {},
    isTTY: true,
    now: () => 20_000,
    spawnWorker: () => {
      workerStarts += 1;
    },
    writeStderr: (message) => messages.push(message),
  });
  runUpdateManager({
    stateDirectory,
    command: 'open',
    currentVersion: '1.2.0',
    env: {},
    isTTY: true,
    now: () => 20_001,
    spawnWorker: () => {
      workerStarts += 1;
    },
    writeStderr: (message) => messages.push(message),
  });

  expect(messages).toEqual([
    '\nA new Lynx Simulator version is available: 1.2.0 → 1.3.0\n' +
      'Update with: npm install -g @lynx-js/lynx-simulator@latest\n\n',
  ]);
  expect(workerStarts).toBe(0);
});

test('highlights an update notification when terminal colors are enabled', () => {
  delete process.env.NO_COLOR;
  vi.stubEnv('FORCE_COLOR', '1');
  writeCheckCache({ lastCheckedAtMs: 10_000, latestVersion: '1.3.0' });
  const messages: string[] = [];

  runUpdateManager({
    stateDirectory,
    command: 'open',
    currentVersion: '1.2.0',
    env: {},
    isTTY: true,
    now: () => 20_000,
    writeStderr: (message) => messages.push(message),
  });

  expect(messages).toEqual([
    '\nA new \u001B[1mLynx Simulator\u001B[22m version is available: 1.2.0 → ' +
      '\u001B[1m\u001B[94m1.3.0\u001B[39m\u001B[22m\n' +
      'Update with: \u001B[4mnpm install -g @lynx-js/lynx-simulator@latest\u001B[24m\n\n',
  ]);
});

test('retries a notification when stderr rejected the previous message', () => {
  writeCheckCache({ lastCheckedAtMs: 10_000, latestVersion: '1.3.0' });
  const messages: string[] = [];

  runUpdateManager({
    stateDirectory,
    command: 'open',
    currentVersion: '1.2.0',
    env: {},
    isTTY: true,
    now: () => 20_000,
    writeStderr: () => {
      throw new Error('broken pipe');
    },
  });
  runUpdateManager({
    stateDirectory,
    command: 'open',
    currentVersion: '1.2.0',
    env: {},
    isTTY: true,
    now: () => 20_001,
    writeStderr: (message) => messages.push(message),
  });

  expect(messages).toHaveLength(1);
});

test('starts a detached worker for a stale cache without printing an update', () => {
  writeCheckCache({
    lastCheckedAtMs: 0,
    latestVersion: '1.2.0',
  });
  const messages: string[] = [];
  let workerStarts = 0;

  runUpdateManager({
    stateDirectory,
    command: 'open',
    currentVersion: '1.2.0',
    env: {},
    isTTY: true,
    now: () => UPDATE_REGISTRY_TTL_MS,
    spawnWorker: () => {
      workerStarts += 1;
    },
    writeStderr: (message) => messages.push(message),
  });

  expect(workerStarts).toBe(1);
  expect(messages).toEqual([]);
});

test.each([
  { command: 'help', env: {}, isTTY: true },
  { command: 'version', env: {}, isTTY: true },
  { command: 'open', env: { CI: 'true' }, isTTY: true },
  { command: 'open', env: { LYNX_SIMULATOR_UPDATE_CHECK_DISABLED: '1' }, isTTY: true },
  { command: 'open', env: {}, isTTY: false },
])('does not check or notify for ineligible invocations: %#', ({ command, env, isTTY }) => {
  let workerStarts = 0;
  const messages: string[] = [];

  runUpdateManager({
    stateDirectory,
    command,
    currentVersion: '1.2.0',
    env,
    isTTY,
    spawnWorker: () => {
      workerStarts += 1;
    },
    writeStderr: (message) => messages.push(message),
  });

  expect(workerStarts).toBe(0);
  expect(messages).toEqual([]);
});

test('does not notify for equal, older, invalid, or prerelease latest versions', () => {
  const messages: string[] = [];
  for (const latestVersion of ['1.2.0', '1.1.9', 'not-a-version', '1.3.0-beta.1']) {
    writeCheckCache({ lastCheckedAtMs: 10_000, latestVersion });
    runUpdateManager({
      stateDirectory,
      command: 'open',
      currentVersion: '1.2.0',
      env: {},
      isTTY: true,
      now: () => 20_000,
      writeStderr: (message) => messages.push(message),
    });
  }

  expect(messages).toEqual([]);
});

test('refreshes the cache with the registry latest version', async () => {
  await refreshUpdateCheck({
    stateDirectory,
    fetchImpl: async (url) => {
      expect(url.toString()).toBe('https://registry.example/%40lynx-js%2Flynx-simulator/latest');
      return new Response(JSON.stringify({ version: '1.3.0' }), { status: 200 });
    },
    now: () => 42,
    packageName: '@lynx-js/lynx-simulator',
    registry: 'https://registry.example',
  });

  expect(readCheckCache()).toEqual({ lastCheckedAtMs: 42, latestVersion: '1.3.0' });
});

test('records a failed refresh attempt without discarding the prior latest version', async () => {
  writeCheckCache({ lastCheckedAtMs: 10, latestVersion: '1.3.0' });

  await refreshUpdateCheck({
    stateDirectory,
    fetchImpl: async () => {
      throw new Error('offline');
    },
    now: () => 42,
    packageName: '@lynx-js/lynx-simulator',
    registry: 'https://registry.example',
  });

  expect(readCheckCache()).toEqual({ lastCheckedAtMs: 42, latestVersion: '1.3.0' });
});

function getCheckCachePath(): string {
  return path.join(stateDirectory, 'registry.json');
}

function writeCheckCache(value: { lastCheckedAtMs: number; latestVersion?: string }): void {
  fs.writeFileSync(getCheckCachePath(), `${JSON.stringify(value)}\n`);
}

function readCheckCache(): unknown {
  return JSON.parse(fs.readFileSync(getCheckCachePath(), 'utf8'));
}
