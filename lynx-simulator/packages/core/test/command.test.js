import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCommandParser,
  parseSize,
  SimulatorErrorCodes,
  toSimulatorErrorInfo,
} from '../dist/index.js';

test('parses size strings', () => {
  assert.deepEqual(parseSize('390x844'), { width: 390, height: 844 });
  assert.deepEqual(parseSize('0x0'), { width: 0, height: 0 });
});

test('parses built-in command aliases and help aliases', () => {
  const parser = createCommandParser({
    name: 'lynx-simulator',
    version: '0.0.1',
  });

  assert.deepEqual(parser.parse(['--help']), {
    command: 'help',
    args: {},
    options: {},
    rawArgv: ['--help'],
  });
  assert.deepEqual(parser.parse(['-h', 'open']), {
    command: 'help',
    args: {},
    options: {},
    rawArgv: ['-h', 'open'],
  });
  assert.deepEqual(parser.parse(['open', '--help', 'extra']), {
    command: 'help',
    args: { command: 'open' },
    options: {},
    rawArgv: ['open', '--help', 'extra'],
  });
  assert.deepEqual(parser.parse(['version', '--help']), {
    command: 'help',
    args: { command: 'version' },
    options: {},
    rawArgv: ['version', '--help'],
  });
  assert.deepEqual(parser.parse(['--version', 'extra']), {
    command: 'version',
    args: {},
    options: {},
    rawArgv: ['--version', 'extra'],
  });
  assert.deepEqual(parser.parse(['-v']), {
    command: 'version',
    args: {},
    options: {},
    rawArgv: ['-v'],
  });
  assert.throws(() => createCommandParser({ builtins: { help: false } }).parse(['--help']));
  assert.throws(() => createCommandParser({ builtins: { version: false } }).parse(['--version']));
  assert.throws(() => parser.parse(['version', 'extra']), /Unexpected argument/);
});

test('tryParse returns parser-owned command attribution on validation failures', () => {
  const parser = createCommandParser({
    name: 'lynx-simulator',
    version: '0.0.1',
  });

  assert.deepEqual(parser.tryParse(['--version']), {
    ok: true,
    parsed: {
      command: 'version',
      args: {},
      options: {},
      rawArgv: ['--version'],
    },
  });

  const missingArgument = parser.tryParse(['open']);
  assert.equal(missingArgument.ok, false);
  assert.equal(missingArgument.recognizedCommand, 'open');
  assert.equal(
    toSimulatorErrorInfo(missingArgument.error).code,
    SimulatorErrorCodes.CommandArgumentMissing
  );

  const unknownCommand = parser.tryParse(['unknown']);
  assert.equal(unknownCommand.ok, false);
  assert.equal(unknownCommand.recognizedCommand, undefined);

  const unknownAlias = parser.tryParse(['--devices']);
  assert.equal(unknownAlias.ok, false);
  assert.equal(unknownAlias.recognizedCommand, undefined);

  const missingCommand = parser.tryParse([]);
  assert.equal(missingCommand.ok, false);
  assert.equal(missingCommand.recognizedCommand, undefined);
});

test('parses built-in command options', () => {
  const parser = createCommandParser();

  assert.deepEqual(parser.parse(['open', './main.lynx.bundle', '--size', '390x844']), {
    command: 'open',
    args: { target: './main.lynx.bundle' },
    options: { size: '390x844' },
    rawArgv: ['open', './main.lynx.bundle', '--size', '390x844'],
  });
  assert.deepEqual(
    parser.parse(['open', './main.lynx.bundle', '--width', '0', '--height', '0']).options,
    { width: 0, height: 0 }
  );
  assert.equal(
    parser.parse(['open', './main.lynx.bundle', '--window', 'win_1']).options.window,
    'win_1'
  );
  assert.equal(
    parser.parse(['open', './main.lynx.bundle', '--device', 'iphone-15']).options.device,
    'iphone-15'
  );
  assert.deepEqual(
    parser.parse(['open', './main.lynx.bundle', '--windowless', '--dpr', '3']).options,
    { windowless: true, dpr: 3 }
  );
  assert.deepEqual(
    parser.parse(['open', './main.lynx.bundle', '--connect-devtool', 'ws://localhost:9222'])
      .options,
    { 'connect-devtool': 'ws://localhost:9222' }
  );
  assert.deepEqual(parser.parse(['devices']), {
    command: 'devices',
    args: {},
    options: {},
    rawArgv: ['devices'],
  });
  assert.deepEqual(parser.parse(['devtool-settings', '--devtool', 'true', '--logbox', 'false']), {
    command: 'devtool-settings',
    args: {},
    options: {
      devtool: true,
      logbox: false,
    },
    rawArgv: ['devtool-settings', '--devtool', 'true', '--logbox', 'false'],
  });
  assert.deepEqual(parser.parse(['devtool-settings', '--status']).options, {
    status: true,
  });
  assert.deepEqual(parser.parse(['connect-devtool', 'ws://localhost:9222']), {
    command: 'connect-devtool',
    args: {
      url: 'ws://localhost:9222',
    },
    options: {},
    rawArgv: ['connect-devtool', 'ws://localhost:9222'],
  });
  assert.deepEqual(parser.parse(['status', '--window', 'win_1']), {
    command: 'status',
    args: {},
    options: {
      window: 'win_1',
    },
    rawArgv: ['status', '--window', 'win_1'],
  });
  assert.deepEqual(parser.parse(['focus', '--window', 'win_1']), {
    command: 'focus',
    args: {},
    options: {
      window: 'win_1',
    },
    rawArgv: ['focus', '--window', 'win_1'],
  });
  assert.deepEqual(parser.parse(['close', '--window', 'win_1']), {
    command: 'close',
    args: {},
    options: {
      window: 'win_1',
    },
    rawArgv: ['close', '--window', 'win_1'],
  });
  assert.deepEqual(parser.parse(['status']).options, {});
});

test('reports built-in option relation errors', () => {
  const parser = createCommandParser();

  assert.deepEqual(
    toSimulatorErrorInfo(
      catchError(() => parser.parse(['open', './main.lynx.bundle', '--width', '390']))
    ),
    {
      module: 'command',
      code: SimulatorErrorCodes.CommandOptionRequired,
      message: '--width requires --height.',
      details: {
        optionName: 'width',
        requiredOptionName: 'height',
      },
    }
  );
  assert.deepEqual(
    toSimulatorErrorInfo(
      catchError(() => parser.parse(['open', './main.lynx.bundle', '--height', '844']))
    ),
    {
      module: 'command',
      code: SimulatorErrorCodes.CommandOptionRequired,
      message: '--height requires --width.',
      details: {
        optionName: 'height',
        requiredOptionName: 'width',
      },
    }
  );
  assert.deepEqual(
    toSimulatorErrorInfo(
      catchError(() =>
        parser.parse([
          'open',
          './main.lynx.bundle',
          '--size',
          '390x844',
          '--width',
          '390',
          '--height',
          '844',
        ])
      )
    ),
    {
      module: 'command',
      code: SimulatorErrorCodes.CommandOptionConflict,
      message: '--size cannot be used with --width.',
      details: {
        optionName: 'size',
        conflictingOptionName: 'width',
      },
    }
  );
  assert.deepEqual(
    toSimulatorErrorInfo(
      catchError(() =>
        parser.parse([
          'open',
          './main.lynx.bundle',
          '--width',
          '390',
          '--height',
          '844',
          '--device',
          'iphone-15',
        ])
      )
    ),
    {
      module: 'command',
      code: SimulatorErrorCodes.CommandOptionConflict,
      message: '--width cannot be used with --device.',
      details: {
        optionName: 'width',
        conflictingOptionName: 'device',
      },
    }
  );
  assert.deepEqual(
    toSimulatorErrorInfo(
      catchError(() =>
        parser.parse(['open', './main.lynx.bundle', '--device', 'iphone-15', '--size', '390x844'])
      )
    ),
    {
      module: 'command',
      code: SimulatorErrorCodes.CommandOptionConflict,
      message: '--device cannot be used with --size.',
      details: {
        optionName: 'device',
        conflictingOptionName: 'size',
      },
    }
  );
  assert.deepEqual(
    toSimulatorErrorInfo(
      catchError(() =>
        parser.parse(['open', './main.lynx.bundle', '--window', 'win_1', '--size', '390x844'])
      )
    ),
    {
      module: 'command',
      code: SimulatorErrorCodes.CommandOptionConflict,
      message: '--window cannot be used with --size.',
      details: {
        optionName: 'window',
        conflictingOptionName: 'size',
      },
    }
  );
  assert.deepEqual(
    toSimulatorErrorInfo(
      catchError(() =>
        parser.parse(['open', './main.lynx.bundle', '--window', 'win_1', '--windowless'])
      )
    ),
    {
      module: 'command',
      code: SimulatorErrorCodes.CommandOptionConflict,
      message: '--window cannot be used with --windowless.',
      details: {
        optionName: 'window',
        conflictingOptionName: 'windowless',
      },
    }
  );
  assert.deepEqual(parser.parse(['open', './main.lynx.bundle', '--dpr', '3']).options, {
    dpr: 3,
  });
  assert.throws(
    () => parser.parse(['devtool-settings', '--status', '--devtool', 'true']),
    /--status cannot be used with --devtool/
  );
  assert.deepEqual(toSimulatorErrorInfo(catchError(() => parser.parse(['focus']))), {
    module: 'command',
    code: SimulatorErrorCodes.CommandOptionRequired,
    message: '--window is required.',
    details: {
      optionName: 'window',
    },
  });
  assert.deepEqual(toSimulatorErrorInfo(catchError(() => parser.parse(['close']))), {
    module: 'command',
    code: SimulatorErrorCodes.CommandOptionRequired,
    message: '--window is required.',
    details: {
      optionName: 'window',
    },
  });
});

test('formats built-in help output', () => {
  const parser = createCommandParser({
    name: 'lynx-simulator',
    version: '0.0.1',
  });

  assert.match(parser.getHelp(), /help open/);
  assert.match(parser.getHelp(), /help, --help, -h: Show help/);
  assert.match(parser.getHelp(), /version, --version, -v: Show version/);
  assert.doesNotMatch(parser.getHelp(), /lynx-simulator <command> --help/);
  assert.match(parser.getHelp(), /devtool-settings/);
  assert.doesNotMatch(parser.getHelp(), /quit/);
  assert.match(parser.getHelp('open'), /Usage: lynx-simulator open <target> \[options\]/);
  assert.match(parser.getHelp('open'), /Arguments:/);
  assert.match(parser.getHelp('open'), /Options:/);
  assert.match(parser.getHelp('open'), /--device/);
  assert.match(parser.getHelp('open'), /--windowless: <boolean>/);
  assert.match(parser.getHelp('open'), /--dpr: <number>; optional; conflicts with --window/);
  assert.match(
    parser.getHelp('open'),
    /--connect-devtool: <string>; optional; Connect to a remote Lynx DevTool before opening\./
  );
  assert.match(parser.getHelp('open'), /Help:/);
  assert.match(parser.getHelp('open'), /lynx-simulator open --help/);
  assert.match(
    parser.getHelp('devtool-settings'),
    /--devtool: <boolean>; optional; conflicts with --status; Enable or disable the Lynx DevTool\./
  );
  assert.match(
    parser.getHelp('devtool-settings'),
    /--status: <boolean>; optional; conflicts with --devtool, --logbox; Return the current DevTool and LogBox states\./
  );
  assert.match(
    parser.getHelp('connect-devtool'),
    /url: <string>; required; Remote Lynx DevTool URL\./
  );
  assert.match(parser.getHelp('focus'), /--window: <string>; required; Target window\./);
  assert.match(parser.getHelp('help'), /Usage: lynx-simulator help \[command\]/);
  assert.doesNotMatch(parser.getHelp('help'), /Usage: lynx-simulator help \[command\] \[options\]/);
  assert.match(parser.getHelp('help'), /Aliases:/);
  assert.match(parser.getHelp('help'), /lynx-simulator --help/);
  assert.match(parser.getHelp('version'), /Usage: lynx-simulator version/);
  assert.doesNotMatch(parser.getHelp('version'), /Usage: lynx-simulator version \[options\]/);
  assert.match(parser.getHelp('version'), /Aliases:/);
  assert.match(parser.getHelp('version'), /lynx-simulator --version/);
  assert.match(parser.getHelp('devices'), /Usage: lynx-simulator devices/);
  assert.doesNotMatch(parser.getHelp('devices'), /Usage: lynx-simulator devices \[options\]/);
  assert.doesNotMatch(createCommandParser({ builtins: { open: false } }).getHelp(), /help open/);
  assert.doesNotMatch(
    createCommandParser({ builtins: { 'devtool-settings': false } }).getHelp(),
    /devtool-settings/
  );
});

test('registers and extends custom commands', () => {
  const parser = createCommandParser({ name: 'demo', version: '1.2.3', builtins: false });

  parser.registerCommand({
    name: 'serve',
    aliases: ['s'],
    description: 'Serve a target.',
    arguments: [{ name: 'target', required: true }],
    options: [
      { name: 'port', aliases: ['p'], type: 'number' },
      { name: 'watch', type: 'boolean' },
    ],
  });
  parser.extendCommand('serve', {
    reference: '/path/to/serve-guide.md',
    options: [
      {
        name: 'host',
        type: 'string',
        required: true,
        description: 'Target host.',
      },
      {
        name: 'label',
        aliases: ['l'],
        description: 'Custom label.',
      },
    ],
  });

  assert.deepEqual(
    parser.parse(['serve', './main.js', '-p', '8080', '--watch', '--host=0.0.0.0', '-l', 'demo']),
    {
      command: 'serve',
      args: { target: './main.js' },
      options: { port: 8080, watch: true, host: '0.0.0.0', label: 'demo' },
      rawArgv: ['serve', './main.js', '-p', '8080', '--watch', '--host=0.0.0.0', '-l', 'demo'],
    }
  );
  assert.equal(parser.getVersion(), '1.2.3');
  assert.match(parser.getHelp('serve'), /--port, -p: <number>/);
  assert.match(parser.getHelp('serve'), /--host: <string>; required; Target host\./);
  assert.match(parser.getHelp('serve'), /--label, -l: <string>; optional; Custom label\./);
  assert.match(parser.getHelp('serve'), /Reference:\n  \/path\/to\/serve-guide\.md/);
  assert.match(parser.getHelp('serve'), /Aliases:[\s\S]*Reference:/);
  assert.throws(() => parser.parse(['serve', './main.js']), /--host is required/);
  assert.throws(() => parser.parse(['serve', './main.js', '--unknown']));
});

test('reports command parsing errors as simulator error info', () => {
  const parser = createCommandParser();

  assert.deepEqual(toSimulatorErrorInfo(catchError(() => parser.parse(['unknown']))), {
    module: 'command',
    code: SimulatorErrorCodes.CommandUnknown,
    message: 'Unknown command: unknown',
    details: { command: 'unknown' },
  });
  assert.deepEqual(toSimulatorErrorInfo(catchError(() => parser.parse([]))), {
    module: 'command',
    code: SimulatorErrorCodes.CommandMissing,
    message: 'Missing command.',
  });
  assert.deepEqual(toSimulatorErrorInfo(catchError(() => parser.parse(['open']))), {
    module: 'command',
    code: SimulatorErrorCodes.CommandArgumentMissing,
    message: 'Missing required argument: target',
    details: { argument: 'target' },
  });
  assert.equal(
    toSimulatorErrorInfo(catchError(() => parser.parse(['open', './main.js', '--width']))).code,
    SimulatorErrorCodes.CommandValueMissing
  );
  assert.equal(
    toSimulatorErrorInfo(catchError(() => parser.parse(['open', './main.js', '--width', 'abc'])))
      .code,
    SimulatorErrorCodes.CommandInvalidNumber
  );
  assert.deepEqual(
    toSimulatorErrorInfo(catchError(() => parser.parse(['open', './main.js', '--unknown']))),
    {
      module: 'command',
      code: SimulatorErrorCodes.CommandOptionUnknown,
      message: 'Unknown option: --unknown',
      details: {
        option: 'unknown',
      },
    }
  );
  assert.deepEqual(toSimulatorErrorInfo(catchError(() => parser.parse(['devices', 'extra']))), {
    module: 'command',
    code: SimulatorErrorCodes.CommandArgumentUnexpected,
    message: 'Unexpected argument: extra',
    details: {
      argument: 'extra',
    },
  });
});

function catchError(action) {
  try {
    action();
  } catch (error) {
    return error;
  }
  assert.fail('Expected action to throw.');
}
