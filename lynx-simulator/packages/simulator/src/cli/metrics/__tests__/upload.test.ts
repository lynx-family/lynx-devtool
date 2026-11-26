import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { writeOperationLog } from '../../../shared/logs';
import {
  flushCliMetrics,
  recordCliInvocation,
  startCliMetric,
  type CliInvocationEvent,
  type SessionMetaEvent,
} from '../api';
import {
  getCurrentMetricsPath,
  getInFlightMetricsDirectory,
  getMetricsUploadStatePath,
  getPendingMetricsDirectory,
  listPendingMetricsFiles,
  readMetricsUploadState,
  rotateCurrentMetricsFile,
  writeMetricsUploadState,
} from '../store';
import { type MetricsUploadBatchLog } from '../uploadLog';
import { METRICS_DIR_ENV, METRICS_UPLOAD_TIMEOUT_ENV, METRICS_UPLOAD_URL_ENV } from '../types';

const DISTRIBUTION_METRICS_UPLOAD_URL = 'https://metrics.example.test/distribution';

// Simulates a distribution that ships a telemetry endpoint. The public
// distribution has none; that case is covered below by clearing the endpoint.
const distribution = vi.hoisted(() => ({
  simulatorDistribution: {
    packageName: 'lynx-simulator',
    lynxtronPackage: 'lynxtron',
    updateCommand: 'npm install -g lynx-simulator',
    links: { documentation: '', changelog: '' },
    metricsUploadUrl: undefined as string | undefined,
  },
}));

vi.mock('../../../shared/distribution', () => distribution);

vi.mock('../../../shared/logs', () => ({
  writeOperationLog: vi.fn(),
}));

let metricsDirectory: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  metricsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-simulator-metrics-'));
  process.env[METRICS_DIR_ENV] = metricsDirectory;
  process.env[METRICS_UPLOAD_TIMEOUT_ENV] = '1000';
  delete process.env[METRICS_UPLOAD_URL_ENV];
  distribution.simulatorDistribution.metricsUploadUrl = DISTRIBUTION_METRICS_UPLOAD_URL;
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  delete process.env[METRICS_DIR_ENV];
  delete process.env[METRICS_UPLOAD_TIMEOUT_ENV];
  delete process.env[METRICS_UPLOAD_URL_ENV];
  vi.unstubAllGlobals();
  fs.rmSync(metricsDirectory, { recursive: true, force: true });
});

test('uploads to the distribution endpoint when the env override is unset', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

  await recordTestInvocation();

  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(getFetchRequest().url).toBe(DISTRIBUTION_METRICS_UPLOAD_URL);
  expect(fs.existsSync(getCurrentMetricsPath(metricsDirectory))).toBe(false);
  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
});

test('neither records nor uploads without any telemetry endpoint', async () => {
  distribution.simulatorDistribution.metricsUploadUrl = undefined;

  await recordTestInvocation();
  await flushCliMetrics('1.2.3');

  expect(fetchMock).not.toHaveBeenCalled();
  expect(fs.existsSync(getCurrentMetricsPath(metricsDirectory))).toBe(false);
  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
});

test('uploads gzipped pending metrics to env override and deletes the batch on success', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  process.env[METRICS_UPLOAD_URL_ENV] = 'https://metrics.example.test/upload';

  await recordTestInvocation();
  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const request = getFetchRequest();
  expect(request.url).toBe('https://metrics.example.test/upload');
  expect(request.init.method).toBe('POST');
  expect(request.init.headers).toMatchObject({
    'content-encoding': 'gzip',
    'content-type': 'application/x-ndjson',
    'User-Agent': 'lynx-simulator-metrics/1.2.3',
  });

  const events = readUploadedEvents(getRequestBody(request.init));
  expect(events.map((event) => event.type)).toEqual(['session_meta', 'cli_invocation']);
  expect((events[1] as CliInvocationEvent).command).toBe('help');
  expect(fs.existsSync(getCurrentMetricsPath(metricsDirectory))).toBe(false);
  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
});

test('logs one successful upload operation with batch details', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

  await recordTestInvocation();
  await flushCliMetrics('1.2.3');

  expect(writeOperationLog).toHaveBeenCalledTimes(1);
  expect(writeOperationLog).toHaveBeenCalledWith({
    operation: 'metrics-upload',
    result: 'success',
    uploaderVersion: '1.2.3',
    durationMs: expect.any(Number),
    pendingCountBefore: 1,
    pendingCountAfter: 0,
    attemptedBatchCount: 1,
    uploadedBatchCount: 1,
    skippedBatchCount: 0,
    failedBatchCount: 0,
    batches: [
      expect.objectContaining({
        fileName: expect.stringMatching(/\.jsonl$/),
        result: 'uploaded',
        durationMs: expect.any(Number),
        sizeBytes: expect.any(Number),
        httpStatus: 204,
      }),
    ],
  });
});

test('logs HTTP failure details once per upload operation', async () => {
  fetchMock.mockResolvedValue(
    new Response('{"error":"temporary failure"}', {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  );

  await recordTestInvocation();
  await flushCliMetrics('1.2.3');

  expect(writeOperationLog).toHaveBeenCalledTimes(1);
  expect(writeOperationLog).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: 'metrics-upload',
      result: 'failed',
      attemptedBatchCount: 1,
      uploadedBatchCount: 0,
      failedBatchCount: 1,
      pendingCountAfter: 1,
      batches: [
        expect.objectContaining({
          restoredFileName: expect.stringMatching(/\.jsonl$/),
          result: 'failed',
          httpStatus: 503,
          failure: {
            message: 'Metrics upload returned HTTP 503',
            responseSummary: '{"error":"temporary failure"}',
          },
        }),
      ],
    })
  );
});

test('logs an HTTP response body read failure', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 502,
    text: vi.fn().mockRejectedValue(new Error('stream closed')),
  });

  await recordTestInvocation();
  await flushCliMetrics('1.2.3');

  expect(writeOperationLog).toHaveBeenCalledWith(
    expect.objectContaining({
      result: 'failed',
      batches: [
        expect.objectContaining({
          result: 'failed',
          restoredFileName: expect.stringMatching(/\.jsonl$/),
          httpStatus: 502,
          failure: {
            message:
              'Metrics upload returned HTTP 502; failed to read response body: stream closed',
          },
        }),
      ],
    })
  );
});

test('logs structured network failure details', async () => {
  const cause = Object.assign(new Error('socket closed'), { code: 'ECONNRESET' });
  fetchMock.mockRejectedValue(new TypeError('fetch failed', { cause }));

  await recordTestInvocation();
  await flushCliMetrics('1.2.3');

  expect(writeOperationLog).toHaveBeenCalledTimes(1);
  expect(writeOperationLog).toHaveBeenCalledWith(
    expect.objectContaining({
      result: 'failed',
      batches: [
        expect.objectContaining({
          result: 'failed',
          restoredFileName: expect.stringMatching(/\.jsonl$/),
          failure: {
            code: 'ECONNRESET',
            message: 'Failed to upload metrics batch: fetch failed; caused by: socket closed',
          },
        }),
      ],
    })
  );
});

test('logs request failures without an error code', async () => {
  fetchMock.mockRejectedValue(new TypeError('Invalid URL'));

  await recordTestInvocation();
  await flushCliMetrics('1.2.3');

  expect(writeOperationLog).toHaveBeenCalledWith(
    expect.objectContaining({
      result: 'failed',
      batches: [
        expect.objectContaining({
          result: 'failed',
          restoredFileName: expect.stringMatching(/\.jsonl$/),
          failure: {
            message: 'Failed to upload metrics batch: Invalid URL',
          },
        }),
      ],
    })
  );
});

test('does not log when the upload gate stays closed', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  await writeRecentUploadState();
  await recordTestInvocation();

  await flushCliMetrics('1.2.3');

  expect(writeOperationLog).not.toHaveBeenCalled();
});

test('skips upload state writes when there is nothing to upload', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

  await flushCliMetrics('1.2.3');

  expect(fetchMock).not.toHaveBeenCalled();
  expect(fs.existsSync(getMetricsUploadStatePath(metricsDirectory))).toBe(false);
});

test('skips upload when recent attempt is below frequency gates', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  await writeRecentUploadState();
  await recordTestInvocation();

  await flushCliMetrics('1.2.3');

  expect(fetchMock).not.toHaveBeenCalled();
  expect(fs.existsSync(getCurrentMetricsPath(metricsDirectory))).toBe(true);
  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
});

test('uploads when the hourly attempt gate has elapsed', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  await writeMetricsUploadState(metricsDirectory, {
    lastUploadAttemptAtMs: Date.now() - 60 * 60 * 1000 - 1,
    lastUploadSuccessAtMs: Date.now() - 60 * 60 * 1000 - 1,
  });
  await recordTestInvocation();

  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const uploadState = await readMetricsUploadState(metricsDirectory);
  expect(uploadState.lastUploadAttemptAtMs).toBeGreaterThan(0);
  expect(uploadState.lastUploadSuccessAtMs).toBeGreaterThan(0);
});

test('uploads when current metrics reaches the record threshold', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  await writeRecentUploadState();
  for (let index = 0; index < 100; index += 1) {
    await recordTestInvocation();
  }

  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fs.existsSync(getCurrentMetricsPath(metricsDirectory))).toBe(false);
  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
});

test('does not retry recent failures just because pending queue has batches', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  await writeRecentUploadState();
  await createPendingBatch('help');
  await createPendingBatch('version');
  await recordTestInvocation('status');

  await flushCliMetrics('1.2.3');

  expect(fetchMock).not.toHaveBeenCalled();
  expect(fs.existsSync(getCurrentMetricsPath(metricsDirectory))).toBe(true);
  expect(await listPendingMetricsFiles(metricsDirectory)).toHaveLength(2);
});

test('hourly gate rotates current and drains up to three pending batches', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  await writeMetricsUploadState(metricsDirectory, {
    lastUploadAttemptAtMs: Date.now() - 60 * 60 * 1000 - 1,
  });
  await createPendingBatch('help');
  await createPendingBatch('version');
  await recordTestInvocation('status');

  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fs.existsSync(getCurrentMetricsPath(metricsDirectory))).toBe(false);
  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
});

test('uploads at most three pending batches per flush', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  for (let index = 0; index < 5; index += 1) {
    await createPendingBatch();
  }

  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(await listPendingMetricsFiles(metricsDirectory)).toHaveLength(2);
});

test('keeps pending metrics when upload fails', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
  process.env[METRICS_UPLOAD_URL_ENV] = 'https://metrics.example.test/upload';

  await recordTestInvocation();
  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fs.existsSync(getCurrentMetricsPath(metricsDirectory))).toBe(false);
  expect(await listPendingMetricsFiles(metricsDirectory)).toHaveLength(1);
  expect(readDirectory(getInFlightMetricsDirectory(metricsDirectory))).toEqual([]);
});

test('continues uploading pending batches after failures', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
  for (let index = 0; index < 3; index += 1) {
    await createPendingBatch();
  }

  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(await listPendingMetricsFiles(metricsDirectory)).toHaveLength(3);
  expect(readDirectory(getInFlightMetricsDirectory(metricsDirectory))).toEqual([]);
});

test('converts unexpected batch rejections into failed results', async () => {
  fetchMock
    .mockResolvedValueOnce({
      status: 204,
      get ok() {
        throw new Error('invalid response');
      },
    })
    .mockResolvedValue(new Response(null, { status: 204 }));
  for (let index = 0; index < 3; index += 1) {
    await createPendingBatch();
  }

  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
  expect(readDirectory(getInFlightMetricsDirectory(metricsDirectory))).toHaveLength(1);
  expect(writeOperationLog).toHaveBeenCalledWith(
    expect.objectContaining({
      result: 'partial',
      uploadedBatchCount: 2,
      failedBatchCount: 1,
      batches: expect.arrayContaining([
        expect.objectContaining({
          result: 'failed',
          failure: {
            message: 'Unexpected metrics batch upload failure: invalid response',
          },
        }),
      ]),
    })
  );
});

test('uploads up to three pending batches concurrently', async () => {
  const uploads = [createDeferredResponse(), createDeferredResponse(), createDeferredResponse()];
  for (const upload of uploads) {
    fetchMock.mockReturnValueOnce(upload.promise);
    await createPendingBatch();
  }

  const flush = flushCliMetrics('1.2.3');
  // None of the responses have resolved, so three fetch calls prove that the uploads started concurrently.
  await vi.waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  for (const upload of uploads) {
    upload.resolve(new Response(null, { status: 204 }));
  }
  await flush;

  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
  expect(readDirectory(getInFlightMetricsDirectory(metricsDirectory))).toEqual([]);
});

test('shares one upload deadline across concurrent batches', async () => {
  process.env[METRICS_UPLOAD_TIMEOUT_ENV] = '20';
  const signals: AbortSignal[] = [];
  let requestIndex = 0;
  fetchMock.mockImplementation((_url: string, init: RequestInit) => {
    if (!init.signal) {
      throw new Error('Expected an upload abort signal');
    }
    signals.push(init.signal);
    requestIndex += 1;
    if (requestIndex === 1) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    return new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        reject(new DOMException('This operation was aborted', 'AbortError'));
      });
    });
  });
  for (let index = 0; index < 3; index += 1) {
    await createPendingBatch();
  }

  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(signals).toHaveLength(3);
  expect(new Set(signals).size).toBe(1);
  expect(await listPendingMetricsFiles(metricsDirectory)).toHaveLength(2);
  expect(readDirectory(getInFlightMetricsDirectory(metricsDirectory))).toEqual([]);
  expect(writeOperationLog).toHaveBeenCalledWith(
    expect.objectContaining({
      result: 'partial',
      attemptedBatchCount: 3,
      uploadedBatchCount: 1,
      failedBatchCount: 2,
    })
  );
  const operationLog = vi.mocked(writeOperationLog).mock.calls[0]?.[0];
  const batches = operationLog?.batches as MetricsUploadBatchLog[] | undefined;
  const abortedBatches = batches?.filter(
    (batch) =>
      batch.result === 'failed' &&
      batch.failure?.message === 'Failed to upload metrics batch: This operation was aborted'
  );
  expect(abortedBatches).toHaveLength(2);
});

test('only one concurrent flush uploads a pending batch', async () => {
  const upload = createDeferredResponse();
  fetchMock.mockReturnValue(upload.promise);
  process.env[METRICS_UPLOAD_URL_ENV] = 'https://metrics.example.test/upload';

  await recordTestInvocation();
  await rotateCurrentMetricsFile(metricsDirectory);
  expect(await listPendingMetricsFiles(metricsDirectory)).toHaveLength(1);

  const flushes = Promise.all([flushCliMetrics('1.2.3'), flushCliMetrics('1.2.3')]);
  await vi.waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  upload.resolve(new Response(null, { status: 204 }));
  await flushes;

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
  expect(readDirectory(getInFlightMetricsDirectory(metricsDirectory))).toEqual([]);
});

test('recovers in-flight batch left by an exited owner process', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  process.env[METRICS_UPLOAD_URL_ENV] = 'https://metrics.example.test/upload';

  await recordTestInvocation();
  const pendingPath = await rotateCurrentMetricsFile(metricsDirectory);
  expect(pendingPath).toBeDefined();
  createAbandonedInFlightBatch(pendingPath as string);

  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
  expect(readDirectory(getInFlightMetricsDirectory(metricsDirectory))).toHaveLength(1);

  await flushCliMetrics('1.2.3');

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
  expect(readDirectory(getInFlightMetricsDirectory(metricsDirectory))).toEqual([]);
});

test('deletes empty pending metrics without uploading', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  process.env[METRICS_UPLOAD_URL_ENV] = 'https://metrics.example.test/upload';
  const pendingDirectory = getPendingMetricsDirectory(metricsDirectory);
  fs.mkdirSync(pendingDirectory, { recursive: true });
  fs.writeFileSync(path.join(pendingDirectory, 'empty.jsonl'), '');

  await flushCliMetrics('1.2.3');

  expect(fetchMock).not.toHaveBeenCalled();
  expect((await readMetricsUploadState(metricsDirectory)).lastUploadSuccessAtMs).toBeUndefined();
  expect(await listPendingMetricsFiles(metricsDirectory)).toEqual([]);
});

async function recordTestInvocation(command = 'help'): Promise<void> {
  await recordCliInvocation(startCliMetric([command]), {
    parsedCommand: command,
    result: { ok: true },
    packageVersion: '1.2.3',
  });
}

async function createPendingBatch(command = 'help'): Promise<string> {
  await recordTestInvocation(command);
  const pendingPath = await rotateCurrentMetricsFile(metricsDirectory);
  if (!pendingPath) {
    throw new Error('Expected current metrics to rotate into pending');
  }
  return pendingPath;
}

async function writeRecentUploadState(): Promise<void> {
  await writeMetricsUploadState(metricsDirectory, {
    lastUploadAttemptAtMs: Date.now(),
    lastUploadSuccessAtMs: Date.now(),
  });
}

function createAbandonedInFlightBatch(pendingPath: string): void {
  const result = spawnSync(process.execPath, ['-e', createAbandonedInFlightScript()], {
    encoding: 'utf8',
    env: {
      ...process.env,
      IN_FLIGHT_DIR: getInFlightMetricsDirectory(metricsDirectory),
      PENDING_PATH: pendingPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 42) {
    throw new Error(
      [`Abandoned in-flight writer exited with code ${result.status}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n')
    );
  }
}

function createAbandonedInFlightScript(): string {
  return `
    const fs = require('node:fs');
    const path = require('node:path');

    const pendingPath = process.env.PENDING_PATH;
    const inFlightDirectory = process.env.IN_FLIGHT_DIR;
    if (!pendingPath || !inFlightDirectory) {
      throw new Error('Missing pending or in-flight path');
    }

    fs.mkdirSync(inFlightDirectory, { recursive: true });
    const base = path.basename(pendingPath, '.jsonl');
    const inFlightPath = path.join(
      inFlightDirectory,
      base + '-' + process.pid + '-00000000-0000-4000-8000-000000000000.jsonl'
    );
    fs.renameSync(pendingPath, inFlightPath);
    process.exit(42);
  `;
}

function readUploadedEvents(body: Buffer): Array<SessionMetaEvent | CliInvocationEvent> {
  return gunzipSync(body)
    .toString('utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as SessionMetaEvent | CliInvocationEvent);
}

function getFetchRequest(): { init: RequestInit; url: string } {
  const call = fetchMock.mock.calls[0];
  const url = call[0];
  const init = call[1];
  if (typeof url !== 'string' || !init) {
    throw new Error('Expected metrics upload fetch call');
  }
  return {
    init: init as RequestInit,
    url,
  };
}

function getRequestBody(init: RequestInit): Buffer {
  const body = init.body;
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  throw new Error('Expected metrics upload request body');
}

function createDeferredResponse(): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function readDirectory(directory: string): string[] {
  try {
    return fs.readdirSync(directory);
  } catch (error) {
    if (isErrnoException(error, 'ENOENT')) {
      return [];
    }
    throw error;
  }
}

function isErrnoException(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}
