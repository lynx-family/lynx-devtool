// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { EnvLogCategoryObject, EnvLogClient, EnvLogLevelType } from '../types/envLog';
import chalk from 'chalk';
import { EnvLogManager } from './envLogManager';

export type LogLevel = 'error' | 'warn' | 'info' | 'silent' | 'debug' | 'trace';

/**
 * Enumeration value, used for comparing log levels.
 */
const LogLevels: Record<LogLevel, number> = {
  error: 0,
  silent: 1,
  trace: 2,
  warn: 3,
  info: 4,
  debug: 5
};

interface LoggerOptions {
  level?: LogLevel;
}

function dateFormat(fmt = 'yyyy-MM-dd hh:mm:ss', date = new Date()) {
  const o: Record<string, number> = {
    'M+': date.getMonth() + 1, // month
    'd+': date.getDate(), // day
    'h+': date.getHours(), // hour
    'm+': date.getMinutes(), // minute
    's+': date.getSeconds(), // second
    'q+': Math.floor((date.getMonth() + 3) / 3), // quarter
    S: date.getMilliseconds() // millisecond
  };
  if (/(y+)/.test(fmt)) {
    // eslint-disable-next-line no-param-reassign
    fmt = fmt.replace(RegExp.$1, `${date.getFullYear()}`.substr(4 - RegExp.$1.length));
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const k in o) {
    if (new RegExp(`(${k})`).test(fmt)) {
      // eslint-disable-next-line no-param-reassign
      fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1 ? o[k] : `00${o[k]}`.substr(`${o[k]}`.length)) as string);
    }
  }
  return fmt;
}

/**
 * The Logger class implemented in Rspeedy.
 *
 * In the current code, the Logger instance is divided into two types:
 * - After executing new Rspeedy(), a logger instance will be stored in the this.config of the internal Logger instance (it can be from the user's input or the internal Logger instance itself);
 * - Before the Compiler constructor, use the logger instance built in this file.
 */
export default class Logger {
  /**
   * The current log level, default is 'info'.
   */
  level: LogLevel;
  timesMap: Map<string, any>;

  cliEnvLogClient: EnvLogClient;

  constructor(opts: LoggerOptions = { level: 'info' }) {
    this.level = opts.level || 'info';
    this.timesMap = new Map();
    this.cliEnvLogClient = EnvLogManager.initLogClient({ filename: 'env_log_cli.log' });
  }

  setLevel(level: LogLevel) {
    const types = ['error', 'warn', 'info', 'silent', 'debug', 'trace'];
    if (!types.includes(level)) {
      this.error(`logLevel value should be one of ${types}.`);
    }
    this.level = level;
  }

  /**
   * Print info level log.
   * This level represents user prompt information, but will be hidden in silent mode.
   */
  info(msg: string | Record<string, any>, categories?: EnvLogCategoryObject) {
    this.output('info', chalk.bold.blue('INFO'), msg, categories);
  }

  /**
   * Print warn level log.
   * This level represents user warning information, but will be hidden in silent mode.
   */
  warn(msg: string | Record<string, any>, categories?: EnvLogCategoryObject) {
    this.output('warn', chalk.bold.yellow('WARN'), msg, categories);
  }

  /**
   * Print error level log.
   * This level represents information that needs to be displayed in any case, such as error information.
   */
  error(msg: string | Record<string, any>, categories?: EnvLogCategoryObject) {
    this.output('error', chalk.bold.red('ERROR'), msg, categories);
  }

  /**
   * Set for compatibility with room.initializeServer in devtool.
   * Currently not used in the project.
   */
  trace(msg: string | Record<string, any>, categories?: EnvLogCategoryObject) {
    this.output('trace', chalk.bold.cyan('TRACE'), msg, categories);
  }

  /**
   * Print Debug level information.
   * This level represents debug information, such as configuration files.
   */
  debug(msg: string | Record<string, any>, categories?: EnvLogCategoryObject) {
    this.output('debug', chalk.bold.bgYellowBright('DEBUG'), msg, categories);
  }

  // ---------

  time(label: string) {
    this.timesMap.set(label, process.hrtime.bigint());
  }

  timeEnd(label: string) {
    const pervTime = this.timesMap.get(label);
    if (!pervTime) {
      throw Error(`No such label ${label}`);
    }
    const nowTime = process.hrtime.bigint();
    const duration = (nowTime - pervTime) / BigInt('1000000');
    this.timesMap.delete(label);
    this.info(`${label}: ${duration}ms`);
  }

  private output(level: LogLevel, style: string, msg: string | Record<string, any>, categories?: EnvLogCategoryObject) {
    this.cliEnvLogClient.log(this.parseEnvLogLevel(level), msg, categories ?? { module: 'cli', tag: 'default' });

    if (LogLevels[this.level] < LogLevels[level]) {
      return;
    }
    if (categories) {
      console.log(chalk.green(`[${dateFormat()}]`), msg, categories);
    } else {
      console.log(chalk.green(`[${dateFormat()}]`), msg);
    }
  }

  private parseEnvLogLevel(level: LogLevel): EnvLogLevelType {
    switch (level) {
      case 'error':
        return EnvLogLevelType.Error;
      case 'warn':
        return EnvLogLevelType.Warn;
      case 'debug':
        return EnvLogLevelType.Debug;
      default:
        return EnvLogLevelType.Info;
    }
  }
}

export function createLogger(options: LoggerOptions) {
  return new Logger(options);
}

/**
 * Logger file exported logger instance.
 */
const defaultLogger = new Logger({ level: 'info' });

/**
 * Print track event information only at the debug level.
 * @param level - The user-set level
 */
const isLogTrackEvent = (level: LogLevel) => {
  return level === 'debug';
};

export { defaultLogger, isLogTrackEvent };
