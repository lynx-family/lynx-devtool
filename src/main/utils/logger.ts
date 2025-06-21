// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-shadow */
import readline from 'node:readline';

import { debug } from 'debug';
import colors from 'picocolors';

export const apiLogger = debug('ldt:e2e:api');
export const domContextLogger = debug('ldt:e2e:dom-context');
export const benchmarkLogger = debug('ldt:e2e:benchmark');
export const agentLogger = {
  plannning: debug('ldt:e2e:planning'),
  request: debug('ldt:e2e:openai'),
  exec: debug('ldt:e2e:exec')
};

/**
 * Based on: https://github.com/vitejs/vite/blob/main/packages/vite/src/node/logger.ts
 * MIT License
 * Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors
 */
export const LogLevels: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3
};

interface LogOptions {
  clear?: boolean;
  timestamp?: boolean;
}

interface LogErrorOptions extends LogOptions {
  error?: Error | null;
}

type LogType = 'error' | 'info' | 'warn';
export type LogLevel = LogType | 'silent';

export interface Logger {
  info: (msg: string, options?: LogOptions) => void;
  warn: (msg: string, options?: LogOptions) => void;
  warnOnce: (msg: string, options?: LogOptions) => void;
  error: (msg: string, options?: LogErrorOptions) => void;
  clearScreen: (type: LogType) => void;
  hasErrorLogged: (error: Error) => boolean;
  hasWarned: boolean;
}

interface LoggerOptions {
  prefix?: string;
  allowClearScreen?: boolean;
  customLogger?: Logger;
}

let lastType: LogType | undefined, lastMsg: string | undefined;
let sameCount = 0;

function clearScreen() {
  const repeatCount = process.stdout.rows - 2;
  const blank = repeatCount > 0 ? '\n'.repeat(repeatCount) : '';
  console.log(blank);
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
}

export function createLogger(level: LogLevel = 'info', options: LoggerOptions = {}): Logger {
  if (options.customLogger) {
    return options.customLogger;
  }

  const loggedErrors = new WeakSet<Error>();
  const { prefix = '[LDT]', allowClearScreen = true } = options;
  const thresh = LogLevels[level];
  const canClearScreen = allowClearScreen && process.stdout.isTTY && !process.env.CI;
  const clear = canClearScreen
    ? clearScreen
    : () => {
        // do nothing
      };

  function output(type: LogType, msg: string, options: LogErrorOptions = {}) {
    if (thresh >= LogLevels[type]) {
      const method = type === 'info' ? 'log' : type;
      const format = () => {
        if (options.timestamp) {
          const tag =
            type === 'info'
              ? colors.cyan(colors.bold(prefix))
              : type === 'warn'
                ? colors.yellow(colors.bold(prefix))
                : colors.red(colors.bold(prefix));
          return `${colors.dim(new Date().toLocaleTimeString())} ${tag} ${msg}`;
        } else {
          return msg;
        }
      };
      if (options.error) {
        // prevent options.error is not a Error object
        // refs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Key_not_weakly_held
        try {
          loggedErrors.add(options.error);
        } catch (e) {}
      }
      if (canClearScreen) {
        if (type === lastType && msg === lastMsg) {
          sameCount++;
          clear();
          console[method](format(), colors.yellow(`(x${sameCount + 1})`));
        } else {
          sameCount = 0;
          lastMsg = msg;
          lastType = type;
          if (options.clear) {
            clear();
          }
          console[method](format());
        }
      } else {
        console[method](format());
      }
    }
  }

  const warnedMessages = new Set<string>();

  const logger: Logger = {
    hasWarned: false,
    info(msg, opts) {
      output('info', msg, opts);
    },
    warn(msg, opts) {
      logger.hasWarned = true;
      output('warn', msg, opts);
    },
    warnOnce(msg, opts) {
      if (warnedMessages.has(msg)) {
        return;
      }
      logger.hasWarned = true;
      output('warn', msg, opts);
      warnedMessages.add(msg);
    },
    error(msg, opts) {
      logger.hasWarned = true;
      output('error', msg, opts);
    },
    clearScreen(type) {
      if (thresh >= LogLevels[type]) {
        clear();
      }
    },
    hasErrorLogged(error) {
      return loggedErrors.has(error);
    }
  };

  return logger;
}
