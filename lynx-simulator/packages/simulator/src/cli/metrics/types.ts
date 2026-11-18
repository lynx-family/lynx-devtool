export const CLI_METRICS_SCHEMA_VERSION = 1;

export const METRICS_DISABLED_ENV = 'LYNX_SIMULATOR_METRICS_DISABLED';
export const METRICS_DIR_ENV = 'LYNX_SIMULATOR_METRICS_DIR';
export const METRICS_UPLOAD_TIMEOUT_ENV = 'LYNX_SIMULATOR_METRICS_UPLOAD_TIMEOUT_MS';
export const METRICS_UPLOAD_URL_ENV = 'LYNX_SIMULATOR_METRICS_UPLOAD_URL';

// Local JSONL and uploaded gzip NDJSON share these event shapes, so keep schema
// changes additive after v1.
export type CliMetricEvent = SessionMetaEvent | CliInvocationEvent;

export type CliMetricCommandSource = 'parsed' | 'recognized' | 'default' | 'unknown';

export interface CliMetricClientInfo {
  name: 'lynx-simulator';
  version: string;
}

export interface CliMetricIdentity {
  uvId: string;
  source: 'git-email' | 'install-id';
}

export interface CliMetricHostInfo {
  platform: NodeJS.Platform;
  arch: string;
  nodeVersion: string;
  ci: boolean;
}

export interface SessionMetaEvent {
  type: 'session_meta';
  schemaVersion: typeof CLI_METRICS_SCHEMA_VERSION;
  fileCreatedAtMs: number;
  client: CliMetricClientInfo;
  identity: CliMetricIdentity;
  host: CliMetricHostInfo;
}

export interface CliInvocationEvent {
  type: 'cli_invocation';
  schemaVersion: typeof CLI_METRICS_SCHEMA_VERSION;
  eventId: string;
  startedAtMs: number;
  durationMs: number;
  command: string;
  commandSource: CliMetricCommandSource;
  argvCount: number;
  optionNames: string[];
  result: {
    ok: boolean;
    errorCode: string;
  };
}
