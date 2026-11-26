import { SimulatorErrorCodes } from '../errors';
import { createSimulatorError } from '../errors/error';
import { getErrorMessage } from '../errors/utils';
import type { OpenCardCallback, SimulatorDevTool } from './types';

type MaybePromise<T> = T | Promise<T>;

export interface SimulatorDevToolAdapter {
  setDevToolEnabled(enabled: boolean): MaybePromise<void>;
  isDevToolEnabled(): MaybePromise<boolean>;
  setLogBoxEnabled(enabled: boolean): MaybePromise<void>;
  isLogBoxEnabled(): MaybePromise<boolean>;
  setOpenCardCallback(callback: OpenCardCallback | null): MaybePromise<void>;
  connectDevTool(url: string): MaybePromise<void>;
}

export interface SimulatorDevToolInternal extends SimulatorDevTool {
  dispose(): Promise<void>;
}

export function createSimulatorDevTool(adapter: SimulatorDevToolAdapter): SimulatorDevToolInternal {
  return new SimulatorDevToolImpl(adapter);
}

class SimulatorDevToolImpl implements SimulatorDevToolInternal {
  #adapter: SimulatorDevToolAdapter;
  #hasOpenCardCallback = false;

  constructor(adapter: SimulatorDevToolAdapter) {
    this.#adapter = adapter;
  }

  async setDevToolEnabled(enabled: boolean): Promise<void> {
    validateBoolean(enabled, 'setDevToolEnabled');
    await this.#call('setDevToolEnabled', () => this.#adapter.setDevToolEnabled(enabled));
  }

  async isDevToolEnabled(): Promise<boolean> {
    return this.#call('isDevToolEnabled', () => this.#adapter.isDevToolEnabled());
  }

  async setLogBoxEnabled(enabled: boolean): Promise<void> {
    validateBoolean(enabled, 'setLogBoxEnabled');
    await this.#call('setLogBoxEnabled', () => this.#adapter.setLogBoxEnabled(enabled));
  }

  async isLogBoxEnabled(): Promise<boolean> {
    return this.#call('isLogBoxEnabled', () => this.#adapter.isLogBoxEnabled());
  }

  async setOpenCardCallback(callback: OpenCardCallback | null): Promise<void> {
    if (callback !== null && typeof callback !== 'function') {
      throw invalidDevToolOptions(
        'setOpenCardCallback',
        'runtime.devTool.setOpenCardCallback requires a function or null.'
      );
    }

    await this.#call('setOpenCardCallback', () => this.#adapter.setOpenCardCallback(callback));
    this.#hasOpenCardCallback = callback !== null;
  }

  async connectDevTool(url: string): Promise<void> {
    if (typeof url !== 'string' || url.trim().length === 0) {
      throw invalidDevToolOptions(
        'connectDevTool',
        'runtime.devTool.connectDevTool requires a non-empty URL.'
      );
    }
    await this.#call('connectDevTool', () => this.#adapter.connectDevTool(url));
  }

  async dispose(): Promise<void> {
    if (!this.#hasOpenCardCallback) {
      return;
    }
    await this.setOpenCardCallback(null);
  }

  async #call<T>(operation: string, action: () => MaybePromise<T>): Promise<T> {
    try {
      // Await so rejected adapter promises and synchronous errors are both
      // handled by this catch.
      return await action();
    } catch (error) {
      const causeMessage = getErrorMessage(error);
      throw createSimulatorError({
        module: 'runtime',
        code: SimulatorErrorCodes.RuntimeDevToolOperationFailed,
        message: `runtime.devTool.${operation} failed.`,
        details: causeMessage ? { operation, causeMessage } : { operation },
        cause: error,
      });
    }
  }
}

function validateBoolean(value: unknown, operation: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw invalidDevToolOptions(
      operation,
      `runtime.devTool.${operation} requires a boolean value.`
    );
  }
}

function invalidDevToolOptions(operation: string, message: string) {
  return createSimulatorError({
    module: 'runtime',
    code: SimulatorErrorCodes.RuntimeInvalidDevToolArgument,
    message,
    details: { operation },
  });
}
