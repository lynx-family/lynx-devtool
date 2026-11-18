export type SimulatorErrorModule = 'runtime' | 'command';

export const SimulatorErrorCodes = {
  UnknownError: 'UNKNOWN_ERROR',
  CommandInvalidDefinition: 'COMMAND_INVALID_DEFINITION',
  CommandMissing: 'COMMAND_MISSING',
  CommandUnknown: 'COMMAND_UNKNOWN',
  CommandArgumentMissing: 'COMMAND_ARGUMENT_MISSING',
  CommandArgumentUnexpected: 'COMMAND_ARGUMENT_UNEXPECTED',
  CommandOptionUnknown: 'COMMAND_OPTION_UNKNOWN',
  CommandOptionRequired: 'COMMAND_OPTION_REQUIRED',
  CommandOptionConflict: 'COMMAND_OPTION_CONFLICT',
  CommandValueMissing: 'COMMAND_VALUE_MISSING',
  CommandInvalidNumber: 'COMMAND_INVALID_NUMBER',
  CommandInvalidBoolean: 'COMMAND_INVALID_BOOLEAN',
  CommandInvalidSize: 'COMMAND_INVALID_SIZE',
  RuntimeInvalidTarget: 'RUNTIME_INVALID_TARGET',
  RuntimeInvalidPageEnvironment: 'RUNTIME_INVALID_PAGE_ENVIRONMENT',
  RuntimePageEnvironmentDisposed: 'RUNTIME_PAGE_ENVIRONMENT_DISPOSED',
  RuntimeInvalidExtension: 'RUNTIME_INVALID_EXTENSION',
  RuntimeInvalidDevice: 'RUNTIME_INVALID_DEVICE',
  RuntimeInvalidJSB: 'RUNTIME_INVALID_JSB',
  RuntimeInvalidSize: 'RUNTIME_INVALID_SIZE',
  RuntimeInvalidPosition: 'RUNTIME_INVALID_POSITION',
  RuntimeInvalidDeviceScaleFactor: 'RUNTIME_INVALID_DEVICE_SCALE_FACTOR',
  RuntimeInvalidDevToolArgument: 'RUNTIME_INVALID_DEVTOOL_ARGUMENT',
  RuntimeDevToolOperationFailed: 'RUNTIME_DEVTOOL_OPERATION_FAILED',
  RuntimeLoadFileNotFound: 'RUNTIME_LOAD_FILE_NOT_FOUND',
  RuntimeLoadRejected: 'RUNTIME_LOAD_REJECTED',
  RuntimeLoadFailed: 'RUNTIME_LOAD_FAILED',
  RuntimeWindowNotFound: 'RUNTIME_WINDOW_NOT_FOUND',
  RuntimeWindowOperationUnsupported: 'RUNTIME_WINDOW_OPERATION_UNSUPPORTED',
  RuntimeJSBUnhandled: 'RUNTIME_JSB_UNHANDLED',
  RuntimeJSBFailed: 'RUNTIME_JSB_FAILED',
} as const;

export type SimulatorErrorCode = (typeof SimulatorErrorCodes)[keyof typeof SimulatorErrorCodes];

export interface SimulatorErrorInfo {
  module?: SimulatorErrorModule;
  code: SimulatorErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface CreateSimulatorErrorOptions extends SimulatorErrorInfo {
  cause?: unknown;
}

export interface SimulatorErrorFallback {
  module?: SimulatorErrorModule;
  code?: SimulatorErrorCode;
  message?: string;
  details?: Record<string, unknown>;
}
