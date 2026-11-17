import { clearSimulatorLogs } from '../../shared/logs';
import type { CliResult } from '../output';

export function clearLogsCommand(): CliResult {
  return {
    ...clearSimulatorLogs(),
    recordOperation: false,
  };
}
