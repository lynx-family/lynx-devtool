#!/usr/bin/env node

import { toSimulatorErrorInfo, type ParsedCommandContext } from '@lynx-js/lynx-simulator-core';

import { dispatchSimulatorCommand } from './dispatch';
import {
  flushCliMetrics,
  recordCliInvocation,
  startCliMetric,
  type StartedCliMetric,
} from './metrics/api';
import { finish } from './output';
import { getPageEnvGuidePath } from './package';
import { runUpdateManager } from './update/manager';
import { createSimulatorCommandParser } from '../shared/commands';
import packageJson from '../../package.json';

const argv = process.argv.slice(2);
const pageEnvGuidePath = getPageEnvGuidePath();
const parser = createSimulatorCommandParser({ version: packageJson.version });
parser.extendCommand('generate', {
  reference: `See ${pageEnvGuidePath} for page-env generation, format, and examples.`,
});
const metric = startCliMetric(argv);
// Preserve parsed command context for failures that happen after parsing, such
// as dispatch or launch errors, so metrics can still attribute the command.
let parsedForMetrics: ParsedCommandContext | undefined;
let recognizedForMetrics: string | undefined;

main(metric).catch(async (error) => {
  const errorInfo = toSimulatorErrorInfo(error);
  const result = {
    ok: false,
    code: errorInfo.code,
    message: errorInfo.message,
  };
  await recordCliInvocation(metric, {
    parsedCommand: parsedForMetrics?.command,
    parsedOptions: parsedForMetrics?.options,
    recognizedCommand: parsedForMetrics ? undefined : recognizedForMetrics,
    result,
    packageVersion: packageJson.version,
  });
  await flushCliMetrics(packageJson.version);
  finish(result, argv);
});

async function main(metric: StartedCliMetric) {
  const parseResult = argv.length > 0 ? parser.tryParse(argv) : undefined;
  if (parseResult && !parseResult.ok) {
    recognizedForMetrics = parseResult.recognizedCommand;
    throw parseResult.error;
  }

  const parsed = parseResult?.parsed;
  parsedForMetrics = parsed;
  const result = await dispatchSimulatorCommand(parsed, argv, parser, process.cwd());
  await recordCliInvocation(metric, {
    parsedCommand: parsed?.command,
    parsedOptions: parsed?.options,
    result,
    packageVersion: packageJson.version,
  });
  await flushCliMetrics(packageJson.version);
  finish(result, argv, () => {
    runUpdateManager({
      command: parsed?.command,
      currentVersion: packageJson.version,
    });
  });
}
