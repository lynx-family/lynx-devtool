import { writeOperationLog } from '../shared/logs';

export interface CliResult {
  ok: boolean;
  stdout?: 'text';
  recordOperation?: boolean;
  [key: string]: unknown;
}

export function finish(result: CliResult, argv: string[], afterWrite?: () => void): never {
  const { stdout, recordOperation, ...publicResult } = result;
  if (recordOperation !== false) {
    writeOperationLog({
      command: argv[0] ?? 'home',
      argv,
      result: publicResult,
    });
  }
  writeCliResult(publicResult, stdout);
  afterWrite?.();
  process.exit(publicResult.ok === false ? 1 : 0);
}

function writeJson(value: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeCliResult(result: Record<string, unknown>, stdout: unknown): void {
  if (stdout === 'text' && result.ok !== false && typeof result.output === 'string') {
    process.stdout.write(result.output.endsWith('\n') ? result.output : `${result.output}\n`);
    return;
  }

  writeJson(result);
}
