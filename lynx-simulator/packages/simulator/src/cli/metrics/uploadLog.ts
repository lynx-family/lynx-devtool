import path from 'node:path';

import { writeOperationLog } from '../../shared/logs';

const MAX_ERROR_MESSAGE_LENGTH = 512;
const MAX_RESPONSE_SUMMARY_LENGTH = 512;

type MetricsUploadResult = 'success' | 'partial' | 'failed';
export type MetricsUploadBatchResult = 'uploaded' | 'skipped' | 'failed';

interface MetricsUploadFailure {
  code?: string;
  message?: string;
  responseSummary?: string;
}

export interface MetricsUploadBatchLog {
  fileName: string;
  restoredFileName?: string;
  result: MetricsUploadBatchResult;
  durationMs: number;
  sizeBytes?: number;
  httpStatus?: number;
  failure?: MetricsUploadFailure;
}

interface MetricsUploadOperationLog {
  result: MetricsUploadResult;
  uploaderVersion: string;
  durationMs: number;
  pendingCountBefore: number;
  pendingCountAfter: number;
  attemptedBatchCount: number;
  uploadedBatchCount: number;
  skippedBatchCount: number;
  failedBatchCount: number;
  batches: MetricsUploadBatchLog[];
}

export function createMetricsUploadBatchLog(filePath: string): MetricsUploadBatchLog {
  return {
    fileName: path.basename(filePath),
    result: 'skipped',
    durationMs: 0,
  };
}

export function finishMetricsUploadBatchLog(
  batch: MetricsUploadBatchLog,
  startedAtMs: number
): MetricsUploadBatchLog {
  batch.durationMs = Date.now() - startedAtMs;
  return batch;
}

export function createMetricsUploadFailure(
  contextMessage: string,
  error: unknown
): MetricsUploadFailure {
  const failure: MetricsUploadFailure = {};
  const code = getErrorCode(error);
  if (code) {
    failure.code = code;
  }
  const errorMessage = error instanceof Error ? error.message : undefined;
  const causeMessage =
    error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
  let message = errorMessage ? `${contextMessage}: ${errorMessage}` : contextMessage;
  if (causeMessage) {
    message += `; caused by: ${causeMessage}`;
  }
  failure.message = truncateText(message, MAX_ERROR_MESSAGE_LENGTH);
  return failure;
}

export async function createMetricsUploadHttpFailure(
  response: Response
): Promise<MetricsUploadFailure> {
  const failure: MetricsUploadFailure = {
    message: `Metrics upload returned HTTP ${response.status}`,
  };
  try {
    const responseText = await response.text();
    if (responseText) {
      failure.responseSummary = truncateText(responseText, MAX_RESPONSE_SUMMARY_LENGTH);
    }
  } catch (error) {
    const responseReadMessage = error instanceof Error ? `: ${error.message}` : '';
    failure.message = truncateText(
      `${failure.message}; failed to read response body${responseReadMessage}`,
      MAX_ERROR_MESSAGE_LENGTH
    );
  }
  return failure;
}

export function getMetricsUploadResult(
  uploadedBatchCount: number,
  failedBatchCount: number
): MetricsUploadResult {
  if (failedBatchCount === 0) {
    return 'success';
  }
  return uploadedBatchCount > 0 ? 'partial' : 'failed';
}

export function writeMetricsUploadLog(log: MetricsUploadOperationLog): void {
  writeOperationLog({
    operation: 'metrics-upload',
    ...log,
  });
}

function getErrorCode(error: unknown): string | undefined {
  if (isErrorWithCode(error)) {
    return error.code;
  }
  if (error instanceof Error && isErrorWithCode(error.cause)) {
    return error.cause.code;
  }
  return undefined;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

function isErrorWithCode(error: unknown): error is Error & { code: string } {
  return error instanceof Error && 'code' in error && typeof error.code === 'string';
}
