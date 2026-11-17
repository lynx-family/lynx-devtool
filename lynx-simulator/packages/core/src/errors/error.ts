import { SimulatorErrorCodes } from './types';
import { getErrorMessage } from './utils';
import type {
  CreateSimulatorErrorOptions,
  SimulatorErrorCode,
  SimulatorErrorFallback,
  SimulatorErrorInfo,
  SimulatorErrorModule,
} from './types';

const DEFAULT_ERROR_FALLBACK: SimulatorErrorFallback = {
  code: SimulatorErrorCodes.UnknownError,
};

export class SimulatorError extends Error {
  readonly module?: SimulatorErrorModule;
  readonly code: SimulatorErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(options: CreateSimulatorErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'SimulatorError';
    this.module = options.module;
    this.code = options.code;
    this.details = options.details;
  }

  toJSON(): SimulatorErrorInfo {
    const info: SimulatorErrorInfo = {
      code: this.code,
      message: this.message,
    };
    if (this.module) {
      info.module = this.module;
    }
    if (this.details) {
      info.details = this.details;
    }
    return info;
  }
}

export function createSimulatorError(options: CreateSimulatorErrorOptions): SimulatorError {
  return new SimulatorError(options);
}

export function isSimulatorError(error: unknown): error is SimulatorError {
  return error instanceof SimulatorError;
}

export function toSimulatorErrorInfo(error: unknown): SimulatorErrorInfo {
  return toSimulatorErrorInfoWithFallback(error, DEFAULT_ERROR_FALLBACK);
}

export function toSimulatorErrorInfoWithFallback(
  error: unknown,
  fallback: SimulatorErrorFallback = DEFAULT_ERROR_FALLBACK
): SimulatorErrorInfo {
  if (isSimulatorError(error)) {
    return error.toJSON();
  }

  const message = fallback.message ?? (error instanceof Error ? error.message : String(error));
  const info: SimulatorErrorInfo = {
    code: fallback.code ?? SimulatorErrorCodes.UnknownError,
    message,
  };
  if (fallback.module) {
    info.module = fallback.module;
  }
  const details = createErrorDetails(error, fallback);
  if (details) {
    info.details = details;
  }
  return info;
}

function createErrorDetails(
  error: unknown,
  fallback: SimulatorErrorFallback
): Record<string, unknown> | undefined {
  const details = fallback.details ? { ...fallback.details } : {};
  const causeMessage = getErrorMessage(error);
  if (fallback.message && causeMessage && details.causeMessage === undefined) {
    details.causeMessage = causeMessage;
  }
  return Object.keys(details).length > 0 ? details : undefined;
}
