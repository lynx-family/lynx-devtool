import type { CommandParser, ParsedCommandContext } from '@lynx-js/lynx-simulator-core';

import { getAllInstanceStatuses, quitAllInstances, sendInstanceCommand } from './instance';
import { launchNewInstanceAndWaitForResult } from './launch';
import { getDevicesResult } from './local/devices';
import { getHelpResult, getVersionResult } from './local/help';
import { clearLogsCommand } from './local/logs';
import { handleGenerateCommand } from './local/pageEnv';
import type { CliResult } from './output';

export async function dispatchSimulatorCommand(
  parsed: ParsedCommandContext | undefined,
  rawArgv: string[],
  parser: CommandParser,
  cwd: string
): Promise<CliResult> {
  if (!parsed) {
    // No command opens a new simulator app with the home window.
    return launchNewInstanceAndWaitForResult(rawArgv);
  }

  const instanceId =
    typeof parsed.options.instance === 'string' ? parsed.options.instance : undefined;
  if (instanceId) {
    // Commands with --instance are routed to an existing simulator app.
    return sendInstanceCommand(instanceId, {
      command: parsed.command,
      instanceId,
      rawArgv: parsed.rawArgv,
    });
  }

  return dispatchCommandWithoutInstance(parsed, rawArgv, parser, cwd);
}

async function dispatchCommandWithoutInstance(
  parsed: ParsedCommandContext,
  rawArgv: string[],
  parser: CommandParser,
  cwd: string
): Promise<CliResult> {
  switch (parsed.command) {
    case 'help':
      return getHelpResult(parser, parsed);
    case 'version':
      return getVersionResult(parser);
    case 'devices':
      return getDevicesResult();
    case 'generate':
      return handleGenerateCommand(parsed, cwd);
    case 'clear-logs':
      return clearLogsCommand();
    case 'status':
      return getAllInstanceStatuses();
    case 'quit':
      if (parsed.options.all === true) {
        // Global quit is coordinated by the CLI across all registered instances.
        return quitAllInstances();
      }
      return {
        ok: false,
        code: 'QUIT_TARGET_REQUIRED',
        message: '--instance or --all is required.',
      };
    default:
      // App commands without --instance start a new simulator app process.
      return launchNewInstanceAndWaitForResult(rawArgv);
  }
}
