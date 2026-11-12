import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  recordCliInvocation,
  startCliMetric,
  type CliInvocationEvent,
  type SessionMetaEvent,
} from '../api';
import { getCurrentMetricsPath, listPendingMetricsFiles, rotateCurrentMetricsFile } from '../store';
import { METRICS_DIR_ENV, METRICS_DISABLED_ENV, METRICS_UPLOAD_URL_ENV } from '../types';

let metricsDirectory: string;

beforeEach(() => {
  metricsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-simulator-metrics-'));
  process.env[METRICS_DIR_ENV] = metricsDirectory;
  // The public distribution has no telemetry endpoint; tests opt in through the
  // env override, which spawned writer processes inherit.
  process.env[METRICS_UPLOAD_URL_ENV] = 'https://metrics.example.test/upload';
  delete process.env[METRICS_DISABLED_ENV];
  delete process.env.CI;
});

afterEach(() => {
  delete process.env[METRICS_DIR_ENV];
  delete process.env[METRICS_UPLOAD_URL_ENV];
  delete process.env[METRICS_DISABLED_ENV];
  delete process.env.CI;
  fs.rmSync(metricsDirectory, { recursive: true, force: true });
});

test('records session meta and a sanitized invocation event', async () => {
  const metric = startCliMetric([
    'open',
    'https://example.com/private.bundle?token=secret-token',
    '--instance',
    'secret-instance',
  ]);

  await recordCliInvocation(metric, {
    parsedCommand: 'open',
    parsedOptions: { instance: 'secret-instance' },
    result: {
      ok: true,
      output: 'secret-output',
    },
    packageVersion: '1.2.3',
  });

  const events = readEvents();
  expect(events).toHaveLength(2);

  const meta = events[0] as SessionMetaEvent;
  expect(meta).toMatchObject({
    type: 'session_meta',
    schemaVersion: 1,
    client: {
      name: 'lynx-simulator',
      version: '1.2.3',
    },
  });
  expect(meta.identity.uvId).toBeTruthy();
  expect(['git-email', 'install-id']).toContain(meta.identity.source);
  expect(meta.host.platform).toBe(process.platform);
  expect(meta.host.arch).toBe(process.arch);
  expect(meta.host.nodeVersion).toBe(process.version);

  const invocation = events[1] as CliInvocationEvent;
  expect(invocation).toMatchObject({
    type: 'cli_invocation',
    schemaVersion: 1,
    command: 'open',
    commandSource: 'parsed',
    argvCount: 4,
    optionNames: ['instance'],
    result: {
      ok: true,
      errorCode: '',
    },
  });
  expect(invocation.eventId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
  expect(invocation.startedAtMs).toBeGreaterThan(0);
  expect(invocation.durationMs).toBeGreaterThanOrEqual(0);

  const raw = readRawMetrics();
  expect(raw).not.toContain('https://example.com/private.bundle');
  expect(raw).not.toContain('secret-token');
  expect(raw).not.toContain('secret-instance');
  expect(raw).not.toContain('secret-output');
});

test('sets CI host metadata from the standard CI env', async () => {
  process.env.CI = 'true';

  await recordCliInvocation(startCliMetric(['help']), {
    parsedCommand: 'help',
    result: { ok: true },
    packageVersion: '1.2.3',
  });

  const meta = readEvents()[0] as SessionMetaEvent;
  expect(meta.host.ci).toBe(true);
});

test('writes session meta only once for the current metrics file', async () => {
  await recordCliInvocation(startCliMetric(['help']), {
    parsedCommand: 'help',
    result: { ok: true },
    packageVersion: '1.2.3',
  });
  await recordCliInvocation(startCliMetric(['version']), {
    parsedCommand: 'version',
    result: { ok: true },
    packageVersion: '1.2.3',
  });

  expect(readEvents().map((event) => event.type)).toEqual([
    'session_meta',
    'cli_invocation',
    'cli_invocation',
  ]);
});

test('rotates current metrics when CLI package version changes', async () => {
  await recordCliInvocation(startCliMetric(['help']), {
    parsedCommand: 'help',
    result: { ok: true },
    packageVersion: '0.0.5',
  });
  await recordCliInvocation(startCliMetric(['version']), {
    parsedCommand: 'version',
    result: { ok: true },
    packageVersion: '0.0.6',
  });

  const currentEvents = readEvents();
  expect((currentEvents[0] as SessionMetaEvent).client.version).toBe('0.0.6');
  expect((currentEvents[1] as CliInvocationEvent).command).toBe('version');

  const pendingFiles = await listPendingMetricsFiles(metricsDirectory);
  expect(pendingFiles).toHaveLength(1);
  const pendingEvents = readEventsFromFile(pendingFiles[0]);
  expect((pendingEvents[0] as SessionMetaEvent).client.version).toBe('0.0.5');
  expect((pendingEvents[1] as CliInvocationEvent).command).toBe('help');
});

test('drops metadata-only current metrics when CLI package version changes', async () => {
  await recordCliInvocation(startCliMetric(['help']), {
    parsedCommand: 'help',
    result: { ok: true },
    packageVersion: '0.0.5',
  });
  const pendingPath = await rotateCurrentMetricsFile(metricsDirectory);
  expect(pendingPath).toBeDefined();

  // The failed append/crash shape: current exists with session_meta only and no
  // invocation rows. It should not become an upload batch.
  fs.writeFileSync(
    getCurrentMetricsPath(metricsDirectory),
    `${JSON.stringify(createSessionMeta('0.0.5'))}\n`
  );

  await recordCliInvocation(startCliMetric(['version']), {
    parsedCommand: 'version',
    result: { ok: true },
    packageVersion: '0.0.6',
  });

  const currentEvents = readEvents();
  expect((currentEvents[0] as SessionMetaEvent).client.version).toBe('0.0.6');
  expect((currentEvents[1] as CliInvocationEvent).command).toBe('version');
  expect(await listPendingMetricsFiles(metricsDirectory)).toHaveLength(1);
});

test('writes session meta only once across concurrent metric processes', async () => {
  const childCount = 6;

  await runConcurrentMetricWriters(childCount);

  const events = readEvents();
  expect(events.filter((event) => event.type === 'session_meta')).toHaveLength(1);
  expect(events.filter((event) => event.type === 'cli_invocation')).toHaveLength(childCount);
}, 15000);

test('ignores obsolete session meta lock sidecar', async () => {
  const lockPath = getSessionMetaLockPath();
  fs.mkdirSync(lockPath);
  fs.writeFileSync(path.join(lockPath, 'owner.json'), 'stale owner');

  await recordCliInvocation(startCliMetric(['help']), {
    parsedCommand: 'help',
    result: { ok: true },
    packageVersion: '1.2.3',
  });

  expect(fs.existsSync(lockPath)).toBe(true);
  expect(readEvents().map((event) => event.type)).toEqual(['session_meta', 'cli_invocation']);
});

test('records help and version as PV events', async () => {
  await recordCliInvocation(startCliMetric(['--help']), {
    parsedCommand: 'help',
    result: { ok: true },
    packageVersion: '1.2.3',
  });
  await recordCliInvocation(startCliMetric(['-v']), {
    parsedCommand: 'version',
    result: { ok: true },
    packageVersion: '1.2.3',
  });

  const invocations = readEvents().filter(
    (event): event is CliInvocationEvent => event.type === 'cli_invocation'
  );
  expect(invocations.map((event) => event.command)).toEqual(['help', 'version']);
});

test('records parse failures without persisting raw command arguments', async () => {
  await recordCliInvocation(startCliMetric(['/Users/me/private.bundle']), {
    result: {
      ok: false,
      code: 'COMMAND_UNKNOWN',
      message: 'Unknown command: /Users/me/private.bundle',
    },
    packageVersion: '1.2.3',
  });

  const invocation = readEvents()[1] as CliInvocationEvent;
  expect(invocation).toMatchObject({
    command: 'unknown',
    commandSource: 'unknown',
    result: {
      ok: false,
      errorCode: 'COMMAND_UNKNOWN',
    },
  });
  expect(readRawMetrics()).not.toContain('/Users/me/private.bundle');
});

test('attributes known command parse failures to the recognized command', async () => {
  await recordCliInvocation(startCliMetric(['status']), {
    recognizedCommand: 'status',
    result: {
      ok: false,
      code: 'OPTION_REQUIRED',
      message: '--instance is required',
    },
    packageVersion: '1.2.3',
  });

  const invocation = readEvents()[1] as CliInvocationEvent;
  expect(invocation).toMatchObject({
    command: 'status',
    commandSource: 'recognized',
    result: {
      ok: false,
      errorCode: 'OPTION_REQUIRED',
    },
  });
});

test('skips writes when metrics are disabled', async () => {
  process.env[METRICS_DISABLED_ENV] = '1';

  await recordCliInvocation(startCliMetric(['help']), {
    parsedCommand: 'help',
    result: { ok: true },
    packageVersion: '1.2.3',
  });

  expect(fs.existsSync(getCurrentMetricsPath(metricsDirectory))).toBe(false);
});

test('skips writes when the distribution has no telemetry endpoint', async () => {
  delete process.env[METRICS_UPLOAD_URL_ENV];

  await recordCliInvocation(startCliMetric(['help']), {
    parsedCommand: 'help',
    result: { ok: true },
    packageVersion: '1.2.3',
  });

  expect(fs.existsSync(getCurrentMetricsPath(metricsDirectory))).toBe(false);
});

test('swallows metrics write failures', async () => {
  const notDirectory = path.join(metricsDirectory, 'not-a-directory');
  fs.writeFileSync(notDirectory, 'existing file');
  process.env[METRICS_DIR_ENV] = notDirectory;

  await expect(
    recordCliInvocation(startCliMetric(['help']), {
      parsedCommand: 'help',
      result: { ok: true },
      packageVersion: '1.2.3',
    })
  ).resolves.toBeUndefined();

  expect(fs.readFileSync(notDirectory, 'utf8')).toBe('existing file');
});

function readEvents(): Array<SessionMetaEvent | CliInvocationEvent> {
  return readRawMetrics()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as SessionMetaEvent | CliInvocationEvent);
}

function readRawMetrics(): string {
  return fs.readFileSync(getCurrentMetricsPath(metricsDirectory), 'utf8');
}

function readEventsFromFile(filePath: string): Array<SessionMetaEvent | CliInvocationEvent> {
  return fs
    .readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as SessionMetaEvent | CliInvocationEvent);
}

function createSessionMeta(version: string): SessionMetaEvent {
  return {
    type: 'session_meta',
    schemaVersion: 1,
    fileCreatedAtMs: Date.now(),
    client: {
      name: 'lynx-simulator',
      version,
    },
    identity: {
      uvId: 'test@example.com',
      source: 'git-email',
    },
    host: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      ci: false,
    },
  };
}

async function runConcurrentMetricWriters(childCount: number): Promise<void> {
  const readyDirectory = path.join(metricsDirectory, 'ready');
  const barrierPath = path.join(metricsDirectory, 'barrier');
  const childScriptPath = path.join(metricsDirectory, 'record-metric.ts');
  fs.mkdirSync(readyDirectory);
  fs.writeFileSync(childScriptPath, createMetricWriterScript());

  const children = Array.from({ length: childCount }, (_, index) =>
    spawnMetricWriter(childScriptPath, readyDirectory, barrierPath, index)
  );
  const exitPromises = children.map(waitForChildExit);

  try {
    await waitForReadyFiles(readyDirectory, childCount);
    fs.writeFileSync(barrierPath, 'go');
    await Promise.all(exitPromises);
  } finally {
    for (const child of children) {
      child.kill();
    }
    await Promise.allSettled(exitPromises);
  }
}

function createMetricWriterScript(): string {
  const apiUrl = pathToFileURL(path.resolve(import.meta.dirname, '../api.ts')).href;
  return `
    import fs from 'node:fs';
    import { setTimeout as delay } from 'node:timers/promises';
    import { recordCliInvocation, startCliMetric } from ${JSON.stringify(apiUrl)};

    const readyPath = process.env.READY_PATH;
    const barrierPath = process.env.BARRIER_PATH;
    if (!readyPath || !barrierPath) {
      throw new Error('Missing metric writer coordination paths');
    }

    fs.writeFileSync(readyPath, 'ready');
    while (!fs.existsSync(barrierPath)) {
      await delay(5);
    }

    await recordCliInvocation(startCliMetric(['help']), {
      parsedCommand: 'help',
      result: { ok: true },
      packageVersion: '1.2.3',
    });
  `;
}

function spawnMetricWriter(
  childScriptPath: string,
  readyDirectory: string,
  barrierPath: string,
  index: number
): ChildProcess {
  return spawn(findViteNodeBin(), ['--root', getSimulatorRoot(), childScriptPath], {
    cwd: getSimulatorRoot(),
    env: {
      ...process.env,
      [METRICS_DIR_ENV]: metricsDirectory,
      READY_PATH: path.join(readyDirectory, `${index}.ready`),
      BARRIER_PATH: barrierPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForReadyFiles(readyDirectory: string, expectedCount: number): Promise<void> {
  const startedAtMs = Date.now();
  while (true) {
    if (fs.readdirSync(readyDirectory).length >= expectedCount) {
      return;
    }
    if (Date.now() - startedAtMs > 10_000) {
      throw new Error('Timed out waiting for metric writer processes');
    }
    await delay(10);
  }
}

async function waitForChildExit(child: ChildProcess): Promise<void> {
  const exit = await waitForChildResult(child);

  if (exit.code !== 0) {
    throw new Error(
      [`Metric writer exited with code ${exit.code ?? exit.signal}`, exit.stdout, exit.stderr]
        .filter(Boolean)
        .join('\n')
    );
  }
}

async function waitForChildResult(child: ChildProcess): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  child.stdout?.on('data', (chunk) => stdout.push(String(chunk)));
  child.stderr?.on('data', (chunk) => stderr.push(String(chunk)));

  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code, signal) => resolve({ code, signal }));
    }
  );

  return {
    ...exit,
    stdout: stdout.join(''),
    stderr: stderr.join(''),
  };
}

function findViteNodeBin(): string {
  const binaryName = process.platform === 'win32' ? 'vite-node.cmd' : 'vite-node';
  let directory = import.meta.dirname;

  while (true) {
    const candidate = path.join(directory, 'node_modules', '.bin', binaryName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error('Unable to locate vite-node binary');
    }
    directory = parent;
  }
}

function getSimulatorRoot(): string {
  return path.resolve(import.meta.dirname, '../../../..');
}

function getSessionMetaLockPath(): string {
  return path.join(metricsDirectory, 'current.jsonl.session-meta.lock');
}
