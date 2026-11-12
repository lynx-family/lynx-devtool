import type { CommandParser, ParsedCommandContext } from '@lynx-js/lynx-simulator-core';
import type { CliResult } from '../output';

export function getHelpResult(parser: CommandParser, parsed: ParsedCommandContext): CliResult {
  const command = typeof parsed.args.command === 'string' ? parsed.args.command : undefined;
  return {
    ok: true,
    output: parser.getHelp(command),
    stdout: 'text',
  };
}

export function getVersionResult(parser: CommandParser): CliResult {
  return {
    ok: true,
    output: parser.getVersion(),
    stdout: 'text',
  };
}
