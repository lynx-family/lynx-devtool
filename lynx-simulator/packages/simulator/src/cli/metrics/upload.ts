import fsp from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

import {
  createMetricsUploadBatchLog,
  createMetricsUploadFailure,
  createMetricsUploadHttpFailure,
  finishMetricsUploadBatchLog,
  getMetricsUploadResult,
  writeMetricsUploadLog,
  type MetricsUploadBatchLog,
} from './uploadLog';
import {
  claimPendingMetricsFile,
  countCurrentMetricRecords,
  deleteMetricsFile,
  getMetricsDirectory,
  listPendingMetricsFiles,
  readMetricsUploadState,
  recoverAbandonedInFlightMetricsFiles,
  restorePendingMetricsFile,
  rotateCurrentMetricsFile,
  writeMetricsUploadState,
  type MetricsUploadState,
} from './store';
import { getMetricsUploadUrl } from './endpoint';
import { METRICS_UPLOAD_TIMEOUT_ENV } from './types';

const gzipAsync = promisify(gzip);
const DEFAULT_UPLOAD_TIMEOUT_MS = 3000;
const UPLOAD_INTERVAL_MS = 60 * 60 * 1000;
const CURRENT_RECORD_UPLOAD_THRESHOLD = 100;
const MAX_BATCHES_PER_FLUSH = 3;

export async function uploadCliMetrics(packageVersion: string): Promise<void> {
  const uploadUrl = getMetricsUploadUrl();
  if (!uploadUrl) {
    return;
  }
  const metricsDirectory = getMetricsDirectory();
  // Flush is gated so normal commands only pay local append cost most of the
  // time. Once the gate opens, we still wait for each POST response so retry
  // state remains unambiguous.
  await recoverAbandonedInFlightMetricsFiles(metricsDirectory);
  const pendingFiles = await listPendingMetricsFiles(metricsDirectory);
  const currentRecordCount = await countCurrentMetricRecords(metricsDirectory);
  if (pendingFiles.length === 0 && currentRecordCount === 0) {
    return;
  }

  const uploadState = await readMetricsUploadState(metricsDirectory);
  const attemptAtMs = Date.now();
  if (!shouldAttemptUpload(currentRecordCount, attemptAtMs, uploadState)) {
    return;
  }

  let nextUploadState: MetricsUploadState = {
    ...uploadState,
    lastUploadAttemptAtMs: attemptAtMs,
  };
  await writeMetricsUploadState(metricsDirectory, nextUploadState);

  // Reuse the first pending listing; rotation returns the only new pending file
  // this process creates, so a second directory scan is unnecessary.
  const rotatedFile = await rotateCurrentMetricsFile(metricsDirectory);
  if (rotatedFile) {
    pendingFiles.push(rotatedFile);
  }

  const uploadStartedAtMs = Date.now();
  const pendingCountBefore = pendingFiles.length;
  const claimedFiles: string[] = [];
  for (const filePath of pendingFiles) {
    if (claimedFiles.length >= MAX_BATCHES_PER_FLUSH) {
      break;
    }

    const inFlightPath = await claimPendingMetricsFile(filePath, metricsDirectory);
    if (inFlightPath) {
      claimedFiles.push(inFlightPath);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getUploadTimeoutMs());
  let batches: MetricsUploadBatchLog[];
  try {
    batches = await Promise.all(
      claimedFiles.map((filePath) =>
        uploadClaimedMetricsFileSafely(
          filePath,
          uploadUrl,
          packageVersion,
          metricsDirectory,
          controller.signal
        )
      )
    );
  } finally {
    clearTimeout(timeout);
  }

  const uploadedBatchCount = batches.filter((batch) => batch.result === 'uploaded').length;
  if (uploadedBatchCount > 0) {
    nextUploadState = {
      ...nextUploadState,
      lastUploadSuccessAtMs: Date.now(),
    };
    await writeMetricsUploadState(metricsDirectory, nextUploadState);
  }

  const attemptedBatches = batches.filter((batch) => batch.result !== 'skipped');
  if (attemptedBatches.length > 0) {
    const failedBatchCount = attemptedBatches.filter((batch) => batch.result === 'failed').length;
    const skippedBatchCount = batches.length - attemptedBatches.length;
    writeMetricsUploadLog({
      result: getMetricsUploadResult(uploadedBatchCount, failedBatchCount),
      uploaderVersion: packageVersion,
      durationMs: Date.now() - uploadStartedAtMs,
      pendingCountBefore,
      pendingCountAfter: (await listPendingMetricsFiles(metricsDirectory)).length,
      attemptedBatchCount: attemptedBatches.length,
      uploadedBatchCount,
      skippedBatchCount,
      failedBatchCount,
      batches,
    });
  }
}

function shouldAttemptUpload(
  currentRecordCount: number,
  nowMs: number,
  uploadState: MetricsUploadState
): boolean {
  const lastAttemptAtMs = uploadState.lastUploadAttemptAtMs;
  if (!lastAttemptAtMs || nowMs - lastAttemptAtMs >= UPLOAD_INTERVAL_MS) {
    return true;
  }
  return currentRecordCount >= CURRENT_RECORD_UPLOAD_THRESHOLD;
}

async function uploadClaimedMetricsFileSafely(
  filePath: string,
  uploadUrl: string,
  packageVersion: string,
  metricsDirectory: string,
  signal: AbortSignal
): Promise<MetricsUploadBatchLog> {
  const startedAtMs = Date.now();
  try {
    return await uploadClaimedMetricsFile(
      filePath,
      uploadUrl,
      packageVersion,
      metricsDirectory,
      signal
    );
  } catch (error) {
    const batch = createMetricsUploadBatchLog(filePath);
    batch.result = 'failed';
    batch.failure = createMetricsUploadFailure('Unexpected metrics batch upload failure', error);
    return finishMetricsUploadBatchLog(batch, startedAtMs);
  }
}

async function uploadClaimedMetricsFile(
  filePath: string,
  uploadUrl: string,
  packageVersion: string,
  metricsDirectory: string,
  signal: AbortSignal
): Promise<MetricsUploadBatchLog> {
  // This function owns an in-flight file. Success deletes it; any upload failure
  // restores it to pending so a later flush can retry the same NDJSON payload.
  const startedAtMs = Date.now();
  const batch = createMetricsUploadBatchLog(filePath);
  let ndjson: Buffer;
  try {
    ndjson = await fsp.readFile(filePath);
  } catch (error) {
    if (isErrnoException(error, 'ENOENT')) {
      return finishMetricsUploadBatchLog(batch, startedAtMs);
    }
    batch.result = 'failed';
    batch.failure = createMetricsUploadFailure('Failed to read metrics batch', error);
    const restoredPath = await restorePendingMetricsFile(filePath, metricsDirectory);
    batch.restoredFileName = restoredPath ? path.basename(restoredPath) : undefined;
    return finishMetricsUploadBatchLog(batch, startedAtMs);
  }

  batch.sizeBytes = ndjson.length;
  if (ndjson.toString('utf8').trim().length === 0) {
    await deleteMetricsFile(filePath);
    return finishMetricsUploadBatchLog(batch, startedAtMs);
  }

  let compressedBody: Awaited<ReturnType<typeof gzipAsync>>;
  try {
    compressedBody = await gzipAsync(ndjson);
  } catch (error) {
    batch.result = 'failed';
    batch.failure = createMetricsUploadFailure('Failed to compress metrics batch', error);
    const restoredPath = await restorePendingMetricsFile(filePath, metricsDirectory);
    batch.restoredFileName = restoredPath ? path.basename(restoredPath) : undefined;
    return finishMetricsUploadBatchLog(batch, startedAtMs);
  }

  let response: Response;
  try {
    response = await postGzippedNDJSON(uploadUrl, compressedBody, packageVersion, signal);
  } catch (error) {
    batch.result = 'failed';
    batch.failure = createMetricsUploadFailure('Failed to upload metrics batch', error);
    const restoredPath = await restorePendingMetricsFile(filePath, metricsDirectory);
    batch.restoredFileName = restoredPath ? path.basename(restoredPath) : undefined;
    return finishMetricsUploadBatchLog(batch, startedAtMs);
  }

  batch.httpStatus = response.status;
  if (!response.ok) {
    batch.result = 'failed';
    batch.failure = await createMetricsUploadHttpFailure(response);
    const restoredPath = await restorePendingMetricsFile(filePath, metricsDirectory);
    batch.restoredFileName = restoredPath ? path.basename(restoredPath) : undefined;
    return finishMetricsUploadBatchLog(batch, startedAtMs);
  }

  await deleteMetricsFile(filePath);
  batch.result = 'uploaded';
  return finishMetricsUploadBatchLog(batch, startedAtMs);
}

async function postGzippedNDJSON(
  uploadUrl: string,
  compressedBody: Buffer,
  packageVersion: string,
  signal: AbortSignal
): Promise<Response> {
  return await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'content-encoding': 'gzip',
      'content-type': 'application/x-ndjson',
      'User-Agent': `lynx-simulator-metrics/${packageVersion}`,
    },
    // Node's Buffer type uses ArrayBufferLike, while fetch expects an ArrayBuffer-backed view.
    // The assertion avoids copying the already-compressed payload into a new Uint8Array.
    body: compressedBody as Uint8Array<ArrayBuffer>,
    signal,
  });
}

function getUploadTimeoutMs(): number {
  const value = Number(process.env[METRICS_UPLOAD_TIMEOUT_ENV]);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return DEFAULT_UPLOAD_TIMEOUT_MS;
}

function isErrnoException(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}
