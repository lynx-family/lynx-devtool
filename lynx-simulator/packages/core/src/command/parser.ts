import type {
  BuiltinCommandName,
  BuiltinCommandOptions,
  CommandArgumentDefinition,
  CommandDefinitionPatch,
  CommandDefinition,
  CommandOptionDefinition,
  CommandParseResult,
  CommandParser,
  CommandValueType,
  CreateCommandParserOptions,
  ParsedCommandContext,
} from './types';
import { SimulatorErrorCodes, type SimulatorErrorCode } from '../errors';
import { createSimulatorError } from '../errors/error';

export function createCommandParser(options: CreateCommandParserOptions = {}): CommandParser {
  return new CommandParserImpl(options);
}

class CommandParserImpl implements CommandParser {
  #name: string;
  #version: string;
  #commands = new Map<string, CommandDefinition>();

  constructor(options: CreateCommandParserOptions = {}) {
    this.#name = options.name ?? 'lynx-simulator';
    this.#version = options.version ?? '0.0.0';

    if (isBuiltinEnabled(options.builtins, 'open')) {
      this.registerCommand({
        name: 'open',
        description: 'Open a Lynx page.',
        arguments: [
          {
            name: 'target',
            type: 'string',
            required: true,
            description: 'Lynx bundle HTTP(S) URL, file URL, or local path.',
          },
        ],
        options: [
          {
            name: 'device',
            type: 'string',
            conflictsWith: ['size', 'width', 'height', 'window'],
            description: 'Use a registered device name.',
          },
          {
            name: 'size',
            type: 'string',
            conflictsWith: ['device', 'width', 'height', 'window'],
            description: 'Viewport size in WIDTHxHEIGHT format, for example 390x844.',
          },
          {
            name: 'width',
            type: 'number',
            requires: 'height',
            conflictsWith: ['device', 'size', 'window'],
            description: 'Viewport width. Must be used with --height.',
          },
          {
            name: 'height',
            type: 'number',
            requires: 'width',
            conflictsWith: ['device', 'size', 'window'],
            description: 'Viewport height. Must be used with --width.',
          },
          {
            name: 'window',
            type: 'string',
            conflictsWith: ['device', 'size', 'width', 'height', 'windowless', 'dpr'],
            description: 'Reuse an existing window.',
          },
          {
            name: 'windowless',
            type: 'boolean',
            conflictsWith: ['window'],
            description: 'Open with windowless rendering.',
          },
          {
            name: 'dpr',
            type: 'number',
            conflictsWith: ['window'],
            description: 'Device pixel ratio. Only affects windowless rendering.',
          },
          {
            name: 'connect-devtool',
            type: 'string',
            description: 'Connect to a remote Lynx DevTool before opening.',
          },
        ],
      });
    }
    if (isBuiltinEnabled(options.builtins, 'devices')) {
      this.registerCommand({
        name: 'devices',
        description: 'List available devices.',
      });
    }
    if (isBuiltinEnabled(options.builtins, 'devtool-settings')) {
      this.registerCommand({
        name: 'devtool-settings',
        description:
          'Open the DevTool settings window or manage DevTool and LogBox switches from the CLI.',
        options: [
          {
            name: 'devtool',
            type: 'boolean',
            conflictsWith: ['status'],
            description: 'Enable or disable the Lynx DevTool.',
          },
          {
            name: 'logbox',
            type: 'boolean',
            conflictsWith: ['status'],
            description: 'Enable or disable the LogBox.',
          },
          {
            name: 'status',
            type: 'boolean',
            conflictsWith: ['devtool', 'logbox'],
            description: 'Return the current DevTool and LogBox states.',
          },
        ],
      });
    }
    if (isBuiltinEnabled(options.builtins, 'connect-devtool')) {
      this.registerCommand({
        name: 'connect-devtool',
        description: 'Connect to a remote Lynx DevTool.',
        arguments: [
          {
            name: 'url',
            type: 'string',
            required: true,
            description: 'Remote Lynx DevTool URL.',
          },
        ],
      });
    }
    if (isBuiltinEnabled(options.builtins, 'status')) {
      this.registerCommand({
        name: 'status',
        description: 'Show simulator window status.',
        options: [
          {
            name: 'window',
            type: 'string',
            description: 'Target window. If omitted, all windows are returned.',
          },
        ],
      });
    }
    if (isBuiltinEnabled(options.builtins, 'focus')) {
      this.registerCommand({
        name: 'focus',
        description: 'Focus a simulator window.',
        options: [
          {
            name: 'window',
            type: 'string',
            required: true,
            description: 'Target window.',
          },
        ],
      });
    }
    if (isBuiltinEnabled(options.builtins, 'close')) {
      this.registerCommand({
        name: 'close',
        description: 'Close a simulator window.',
        options: [
          {
            name: 'window',
            type: 'string',
            required: true,
            description: 'Target window.',
          },
        ],
      });
    }
    if (isBuiltinEnabled(options.builtins, 'help')) {
      this.registerCommand({
        name: 'help',
        aliases: ['--help', '-h'],
        description: 'Show help.',
        arguments: [{ name: 'command' }],
      });
    }
    if (isBuiltinEnabled(options.builtins, 'version')) {
      this.registerCommand({
        name: 'version',
        aliases: ['--version', '-v'],
        description: 'Show version.',
      });
    }
  }

  registerCommand(command: CommandDefinition): void {
    if (!command?.name) {
      throw commandError(SimulatorErrorCodes.CommandInvalidDefinition, 'command.name is required.');
    }
    this.#commands.set(command.name, command);
  }

  extendCommand(name: string, patch: CommandDefinitionPatch): void {
    const command = this.#commands.get(name);
    if (!command) {
      throw commandError(SimulatorErrorCodes.CommandUnknown, `Unknown command: ${name}`, {
        command: name,
      });
    }

    this.#commands.set(name, {
      ...command,
      description: patch.description ?? command.description,
      reference: patch.reference ?? command.reference,
      options: mergeOptions(command.options ?? [], patch.options ?? []),
    });
  }

  parse(argv: string[]): ParsedCommandContext {
    const result = this.tryParse(argv);
    if (result.ok) {
      return result.parsed;
    }
    throw result.error;
  }

  tryParse(argv: string[]): CommandParseResult {
    const rawArgv = Array.from(argv ?? []);
    const [first, ...rest] = rawArgv;
    if (!first) {
      return {
        ok: false,
        error: commandError(SimulatorErrorCodes.CommandMissing, 'Missing command.'),
      };
    }

    // 1. Handle top-level command aliases, such as -h and --version.
    const aliasCommandName = getCommandNameByAlias(this.#commands, first);
    if (aliasCommandName) {
      return {
        ok: true,
        parsed: { command: aliasCommandName, args: {}, options: {}, rawArgv },
      };
    }

    // 2. If a normal command includes a help alias, parse it as help for that command, such as `open -h` -> `help open`.
    if (hasHelpAlias(this.#commands, rest)) {
      return {
        ok: true,
        parsed: {
          command: 'help',
          args: { command: first },
          options: {},
          rawArgv,
        },
      };
    }

    // 3. Parse a normal command with its arguments and options.
    const command = this.#commands.get(first);
    if (!command) {
      return {
        ok: false,
        error: commandError(SimulatorErrorCodes.CommandUnknown, `Unknown command: ${first}`, {
          command: first,
        }),
      };
    }

    try {
      const { positional, options: rawOptions } = parseTokens(rest);
      const args = parseArguments(command.arguments ?? [], positional);
      const options = parseOptions(command.options ?? [], rawOptions);

      return {
        ok: true,
        parsed: {
          command: first,
          args,
          options,
          rawArgv,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error,
        recognizedCommand: first,
      };
    }
  }

  getHelp(commandName?: string): string {
    // `getHelp()` is a formatter API and stays available even when the built-in
    // `help` command is disabled. When `help` is disabled, hide usage text for
    // `help open` and `<command> --help` because those entry points are unavailable.
    const helpCommand = this.#commands.get('help');

    if (commandName) {
      const command = this.#commands.get(commandName);
      if (!command) {
        throw commandError(SimulatorErrorCodes.CommandUnknown, `Unknown command: ${commandName}`, {
          command: commandName,
        });
      }
      return formatCommandHelp(this.#name, command, helpCommand);
    }

    const detailsCommand = Array.from(this.#commands.values()).find(
      (command) => command.name !== 'help' && command.name !== 'version'
    );
    const lines = [
      `Usage: ${this.#name} <command> [options]`,
      '',
      'Commands:',
      ...Array.from(this.#commands.values()).map(formatCommandListItem),
    ];
    if (helpCommand && detailsCommand) {
      lines.push('', `Run "${this.#name} help ${detailsCommand.name}" for command details.`);
    }
    return lines.join('\n');
  }

  getVersion(): string {
    return this.#version;
  }
}

function isBuiltinEnabled(
  builtins: BuiltinCommandOptions = true,
  name: BuiltinCommandName
): boolean {
  return builtins === true || (builtins !== false && builtins[name] !== false);
}

type RawOptionValue = string | boolean;

function getCommandNameByAlias(
  commands: Map<string, CommandDefinition>,
  alias: string
): string | undefined {
  for (const command of commands.values()) {
    if (command.aliases?.includes(alias)) {
      return command.name;
    }
  }
  return undefined;
}

function hasHelpAlias(commands: Map<string, CommandDefinition>, args: string[]): boolean {
  const helpCommand = commands.get('help');
  return Boolean(helpCommand && args.some((arg) => helpCommand.aliases?.includes(arg)));
}

function parseTokens(tokens: string[]): {
  positional: string[];
  options: Record<string, RawOptionValue>;
} {
  const positional: string[] = [];
  const options: Record<string, RawOptionValue> = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    // A standalone token starting with '-' is treated as an option token.
    if (!token.startsWith('-')) {
      positional.push(token);
      continue;
    }

    const optionPrefixLength = token.startsWith('--') ? 2 : 1;
    const equalIndex = token.indexOf('=');
    if (equalIndex > optionPrefixLength) {
      options[token.slice(optionPrefixLength, equalIndex)] = token.slice(equalIndex + 1);
      continue;
    }

    const name = token.slice(optionPrefixLength);
    const next = tokens[index + 1];
    // For option values, use the stricter option-token check so values like -123
    // can still be consumed by the previous option.
    if (!next || isOptionToken(next)) {
      options[name] = true;
      continue;
    }

    options[name] = next;
    index += 1;
  }

  return { positional, options };
}

function isOptionToken(token: string): boolean {
  return token.startsWith('--') || /^-[A-Za-z]/.test(token);
}

function parseArguments(
  definitions: CommandArgumentDefinition[],
  values: string[]
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const value = values[index];
    if (definition.required && (value === undefined || value === '')) {
      throw commandError(
        SimulatorErrorCodes.CommandArgumentMissing,
        `Missing required argument: ${definition.name}`,
        { argument: definition.name }
      );
    }
    if (value !== undefined) {
      args[definition.name] = parseValue(value, definition.type ?? 'string', definition.name);
    }
  }
  if (values.length > definitions.length) {
    throw commandError(
      SimulatorErrorCodes.CommandArgumentUnexpected,
      `Unexpected argument: ${values[definitions.length]}`,
      { argument: values[definitions.length] }
    );
  }
  return args;
}

function parseOptions(
  definitions: CommandOptionDefinition[],
  rawOptions: Record<string, RawOptionValue>
): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  const { definitionMap, aliasMap } = createOptionLookup(definitions);
  for (const [name, value] of Object.entries(rawOptions)) {
    const normalizedOptionName = aliasMap.get(name) ?? name;
    const definition = definitionMap.get(normalizedOptionName);
    if (!definition) {
      throw commandError(SimulatorErrorCodes.CommandOptionUnknown, `Unknown option: --${name}`, {
        option: name,
      });
    }
    options[normalizedOptionName] = parseValue(
      value,
      definition.type ?? 'string',
      `--${normalizedOptionName}`
    );
  }

  validateOptionRelations(definitionMap, options);

  return options;
}

function createOptionLookup(definitions: CommandOptionDefinition[]): {
  definitionMap: Map<string, CommandOptionDefinition>;
  aliasMap: Map<string, string>;
} {
  const definitionMap = new Map(definitions.map((definition) => [definition.name, definition]));
  const aliasMap = new Map<string, string>();
  for (const definition of definitions) {
    for (const alias of definition.aliases ?? []) {
      aliasMap.set(alias, definition.name);
    }
  }
  return { definitionMap, aliasMap };
}

function validateOptionRelations(
  definitionMap: Map<string, CommandOptionDefinition>,
  options: Record<string, unknown>
): void {
  const providedOptionNames = new Set(Object.keys(options));

  validateRequiredOptions(definitionMap, providedOptionNames);
  validateProvidedOptionRelations(definitionMap, providedOptionNames);
}

function validateRequiredOptions(
  definitionMap: Map<string, CommandOptionDefinition>,
  providedOptionNames: Set<string>
): void {
  for (const definition of definitionMap.values()) {
    if (definition.required && !providedOptionNames.has(definition.name)) {
      throw commandError(
        SimulatorErrorCodes.CommandOptionRequired,
        `--${definition.name} is required.`,
        {
          optionName: definition.name,
        }
      );
    }
  }
}

function validateProvidedOptionRelations(
  definitionMap: Map<string, CommandOptionDefinition>,
  providedOptionNames: Set<string>
): void {
  for (const optionName of providedOptionNames) {
    const definition = definitionMap.get(optionName);
    if (!definition) {
      continue;
    }

    for (const requiredOption of toList(definition.requires)) {
      if (!providedOptionNames.has(requiredOption)) {
        throw commandError(
          SimulatorErrorCodes.CommandOptionRequired,
          `--${optionName} requires --${requiredOption}.`,
          {
            optionName,
            requiredOptionName: requiredOption,
          }
        );
      }
    }

    for (const conflictingOption of toList(definition.conflictsWith)) {
      if (providedOptionNames.has(conflictingOption)) {
        throw commandError(
          SimulatorErrorCodes.CommandOptionConflict,
          `--${optionName} cannot be used with --${conflictingOption}.`,
          {
            optionName,
            conflictingOptionName: conflictingOption,
          }
        );
      }
    }
  }
}

function toList(value?: string | string[]): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function mergeOptions(
  currentOptions: CommandOptionDefinition[],
  patchOptions: CommandOptionDefinition[]
): CommandOptionDefinition[] {
  const optionMap = new Map(currentOptions.map((option) => [option.name, option]));
  for (const option of patchOptions) {
    optionMap.set(option.name, {
      ...optionMap.get(option.name),
      ...option,
    });
  }
  return Array.from(optionMap.values());
}

export function parseSize(value: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/i.exec(String(value));
  if (!match) {
    throw commandError(
      SimulatorErrorCodes.CommandInvalidSize,
      `Invalid size "${value}". Expected WIDTHxHEIGHT, for example 390x844.`,
      { value }
    );
  }
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function parseValue(
  value: RawOptionValue,
  type: CommandValueType,
  name: string
): string | number | boolean {
  if (type === 'string') {
    if (typeof value === 'boolean') {
      throw commandError(SimulatorErrorCodes.CommandValueMissing, `${name} requires a value.`, {
        name,
      });
    }
    return value;
  }
  if (type === 'number') {
    if (typeof value === 'boolean') {
      throw commandError(SimulatorErrorCodes.CommandValueMissing, `${name} requires a number.`, {
        name,
      });
    }
    return toFiniteNumber(value, name);
  }
  return toBoolean(value, name);
}

function toFiniteNumber(value: unknown, name: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw commandError(SimulatorErrorCodes.CommandInvalidNumber, `${name} must be a number.`, {
      name,
      value,
    });
  }
  return number;
}

function toBoolean(value: RawOptionValue, name: string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  throw commandError(SimulatorErrorCodes.CommandInvalidBoolean, `${name} must be a boolean.`, {
    name,
    value,
  });
}

function commandError(
  code: SimulatorErrorCode,
  message: string,
  details?: Record<string, unknown>
) {
  return createSimulatorError({
    module: 'command',
    code,
    message,
    details,
  });
}

function formatCommandHelp(
  appName: string,
  command: CommandDefinition,
  helpCommand?: CommandDefinition
): string {
  const argumentDefinitions = command.arguments ?? [];
  const optionDefinitions = command.options ?? [];
  const args = argumentDefinitions
    .map((argument) => (argument.required ? `<${argument.name}>` : `[${argument.name}]`))
    .join(' ');

  const options = optionDefinitions.length > 0 ? ' [options]' : '';
  const lines = [`Usage: ${appName} ${command.name}${args ? ` ${args}` : ''}${options}`];
  if (command.description) {
    lines.push('', command.description);
  }
  if (argumentDefinitions.length > 0) {
    lines.push('', 'Arguments:', ...argumentDefinitions.map(formatArgumentHelp));
  }
  if (optionDefinitions.length > 0) {
    lines.push('', 'Options:', ...optionDefinitions.map(formatOptionHelp));
  }
  const aliasExamples = getCommandAliasExamples(appName, command);
  if (aliasExamples.length > 0) {
    lines.push('', 'Aliases:', ...aliasExamples.map((example) => `  ${example}`));
  }

  const helpExamples = getCommandHelpExamples(appName, command, helpCommand);
  if (helpExamples.length > 0) {
    lines.push('', 'Help:', ...helpExamples.map((example) => `  ${example}`));
  }
  if (command.reference) {
    lines.push('', 'Reference:', `  ${command.reference}`);
  }

  return lines.join('\n');
}

function formatCommandListItem(command: CommandDefinition): string {
  const names = getCommandListNames(command).join(', ');
  return command.description ? `${names}: ${command.description}` : names;
}

function getCommandListNames(command: CommandDefinition): string[] {
  return [command.name, ...(command.aliases ?? [])];
}

function getCommandAliasExamples(appName: string, command: CommandDefinition): string[] {
  return (command.aliases ?? []).map((alias) => `${appName} ${alias}`);
}

function getCommandHelpExamples(
  appName: string,
  command: CommandDefinition,
  helpCommand?: CommandDefinition
): string[] {
  if (!helpCommand || command.name === helpCommand.name) {
    return [];
  }

  return [
    `${appName} ${helpCommand.name} ${command.name}`,
    ...(helpCommand.aliases ?? []).map((alias) => {
      return `${appName} ${command.name} ${alias}`;
    }),
  ];
}

function formatArgumentHelp(argument: CommandArgumentDefinition): string {
  return formatDefinitionHelp(`  ${argument.name}`, [
    formatValueType(argument.type),
    argument.required ? 'required' : 'optional',
    argument.description,
  ]);
}

function formatOptionHelp(option: CommandOptionDefinition): string {
  const names = [`--${option.name}`, ...(option.aliases ?? []).map((alias) => `-${alias}`)].join(
    ', '
  );
  return formatDefinitionHelp(`  ${names}`, [
    formatValueType(option.type),
    option.required ? 'required' : 'optional',
    formatRelation('requires', option.requires),
    formatRelation('conflicts with', option.conflictsWith),
    option.description,
  ]);
}

function formatDefinitionHelp(name: string, details: Array<string | undefined>): string {
  const filteredDetails = details.filter(Boolean);
  return filteredDetails.length > 0 ? `${name}: ${filteredDetails.join('; ')}` : name;
}

function formatValueType(type: CommandValueType = 'string'): string {
  return `<${type}>`;
}

function formatRelation(label: string, value?: string | string[]): string | undefined {
  const names = toList(value).map((name) => `--${name}`);
  return names.length > 0 ? `${label} ${names.join(', ')}` : undefined;
}
