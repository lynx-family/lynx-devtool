export type CommandValueType = 'string' | 'number' | 'boolean';
export type BuiltinCommandName =
  | 'open'
  | 'devices'
  | 'devtool-settings'
  | 'connect-devtool'
  | 'status'
  | 'focus'
  | 'close'
  | 'help'
  | 'version';
export type BuiltinCommandOptions = boolean | Partial<Record<BuiltinCommandName, boolean>>;

export interface CreateCommandParserOptions {
  name?: string;
  version?: string;
  /**
   * Controls built-in commands.
   *
   * - `undefined` or `true`: enable all built-in commands.
   * - `false`: disable all built-in commands.
   * - object: override individual built-ins. Commands not listed in the object
   *   stay enabled by default, so `{ version: false }` disables only `version`.
   */
  builtins?: BuiltinCommandOptions;
}

export interface CommandArgumentDefinition {
  name: string;
  type?: CommandValueType;
  required?: boolean;
  description?: string;
}

export interface CommandOptionDefinition {
  name: string;
  aliases?: string[];
  type?: CommandValueType;
  required?: boolean;
  requires?: string | string[];
  conflictsWith?: string | string[];
  description?: string;
}

export interface CommandDefinitionPatch {
  description?: string;
  reference?: string;
  options?: CommandOptionDefinition[];
}

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  description?: string;
  /** Supplemental reference text shown at the end of detailed command help. */
  reference?: string;
  arguments?: CommandArgumentDefinition[];
  options?: CommandOptionDefinition[];
}

export interface ParsedCommandContext {
  command: string;
  args: Record<string, unknown>;
  options: Record<string, unknown>;
  rawArgv: string[];
}

export type CommandParseResult =
  | {
      ok: true;
      parsed: ParsedCommandContext;
    }
  | {
      ok: false;
      error: unknown;
      /**
       * Registered command name identified before full argument/option
       * validation failed. Undefined means argv did not identify a known command.
       */
      recognizedCommand?: string;
    };

export interface CommandParser {
  parse(argv: string[]): ParsedCommandContext;
  /**
   * Parse argv without throwing. On failure, `recognizedCommand` keeps the
   * parser-owned command attribution when argv identified a registered command
   * before argument or option validation failed.
   */
  tryParse(argv: string[]): CommandParseResult;
  getHelp(commandName?: string): string;
  getVersion(): string;
  /**
   * Register a full command definition. If a command with the same name already
   * exists, this replaces the entire existing definition.
   */
  registerCommand(command: CommandDefinition): void;
  /**
   * Extend an existing command without replacing its full definition. The patch
   * can update the command description or reference and merge options by name:
   * new option names are appended, and existing option names are replaced by
   * the patch.
   */
  extendCommand(name: string, patch: CommandDefinitionPatch): void;
}
