import { randomUUID } from 'node:crypto';

import { getMetricsUploadUrl } from './endpoint';
import { appendCliMetric } from './store';
import { uploadCliMetrics } from './upload';
import {
  CLI_METRICS_SCHEMA_VERSION,
  METRICS_DISABLED_ENV,
  type CliInvocationEvent,
  type CliMetricCommandSource,
} from './types';

// Captures the immutable invocation facts we need before parsing or dispatch can
// throw. Later metrics events use this as their timing and argv-shape baseline.
export interface StartedCliMetric {
  argv: string[];
  startedAtMs: number;
  startedAtNs: bigint;
}

// Public recording input intentionally accepts only parser-derived command
// metadata and the public result shape. Raw argv values and option values stay
// out of metrics.
export interface RecordCliInvocationInput {
  parsedCommand?: string;
  parsedOptions?: Record<string, unknown>;
  // Set only from CommandParser.tryParse(); never pass argv[0].
  recognizedCommand?: string;
  result: Record<string, unknown>;
  packageVersion: string;
}

export function startCliMetric(argv: string[]): StartedCliMetric {
  return {
    argv: Array.from(argv),
    startedAtMs: Date.now(),
    startedAtNs: process.hrtime.bigint(),
  };
}

export async function recordCliInvocation(
  metric: StartedCliMetric,
  input: RecordCliInvocationInput
): Promise<void> {
  try {
    if (isMetricsDisabled()) {
      return;
    }
    await appendCliMetric({
      packageVersion: input.packageVersion,
      event: createCliInvocationEvent(metric, input),
    });
  } catch {
    // Metrics must never affect CLI output or exit behavior.
  }
}

export async function flushCliMetrics(packageVersion: string): Promise<void> {
  try {
    if (isMetricsDisabled()) {
      return;
    }
    // Upload needs the package version for the metrics User-Agent, while record
    // needs it for session_meta. Keep both values explicit at their call sites.
    await uploadCliMetrics(packageVersion);
  } catch {
    // Metrics upload is best effort; pending batches stay on disk for retry.
  }
}

function createCliInvocationEvent(
  metric: StartedCliMetric,
  input: RecordCliInvocationInput
): CliInvocationEvent {
  const command = getCommand(metric.argv, input.parsedCommand, input.recognizedCommand);
  return {
    type: 'cli_invocation',
    schemaVersion: CLI_METRICS_SCHEMA_VERSION,
    eventId: randomUUID(),
    startedAtMs: metric.startedAtMs,
    durationMs: getDurationMs(metric.startedAtNs),
    command: command.command,
    commandSource: command.source,
    argvCount: metric.argv.length,
    optionNames: getOptionNames(input.parsedOptions),
    result: {
      ok: input.result.ok !== false,
      errorCode: typeof input.result.code === 'string' ? input.result.code : '',
    },
  };
}

function getDurationMs(startedAtNs: bigint): number {
  const durationMs = Number((process.hrtime.bigint() - startedAtNs) / 1_000_000n);
  return Math.max(0, durationMs);
}

function getCommand(
  argv: string[],
  parsedCommand: string | undefined,
  recognizedCommand: string | undefined
): { command: string; source: CliMetricCommandSource } {
  if (parsedCommand) {
    return { command: parsedCommand, source: 'parsed' };
  }
  if (recognizedCommand) {
    return { command: recognizedCommand, source: 'recognized' };
  }
  if (argv.length === 0) {
    return { command: 'home', source: 'default' };
  }

  // Unknown parse failures can contain paths, URLs, or typos in argv[0]. Keep
  // the dimension useful without persisting those raw values.
  return { command: 'unknown', source: 'unknown' };
}

function getOptionNames(options: Record<string, unknown> | undefined): string[] {
  if (!options) {
    return [];
  }
  return Object.keys(options)
    .filter((name) => options[name] !== undefined)
    .sort();
}

function isMetricsDisabled(): boolean {
  // Without an endpoint there is nowhere to send records, so do not collect them.
  if (getMetricsUploadUrl() === undefined) {
    return true;
  }
  const value = process.env[METRICS_DISABLED_ENV]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export type { CliInvocationEvent, CliMetricEvent, SessionMetaEvent } from './types';
