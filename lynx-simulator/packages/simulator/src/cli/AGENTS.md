# Simulator CLI Agent Guide

This directory contains the TypeScript implementation behind the published
`lynx-simulator` npm command.

## Flow

```text
bin/lynx-simulator.js
  -> dist/cli/main.js
  -> main.ts
  -> dispatch.ts
```

`bin/lynx-simulator.js` should stay thin.

Put command behavior in `src/cli` or desktop main process handlers, not in the
bin file.

## Dispatch Rules

- Local commands, global `status`, and `quit --all` run in the CLI process
  without starting Lynxtron.
- Commands with `--instance` route to an existing app through IPC.
- Other app commands without `--instance` launch a new Lynxtron app using
  `dist/desktop`.
- Command syntax comes from `src/shared/commands.ts`; command behavior is
  decided by CLI dispatch or desktop handlers.

## Validation

Run the CLI smoke suite from the `lynx-simulator` workspace root after
`pnpm build:core`. It builds the CLI before exercising the published bin
entry:

```bash
pnpm --filter @lynx-js/lynx-simulator run test:cli
```

For focused CLI validation, build the CLI and invoke the same bin entry:

```bash
pnpm --filter @lynx-js/lynx-simulator run build:cli
node packages/simulator/bin/lynx-simulator.js --help
node packages/simulator/bin/lynx-simulator.js devices
node packages/simulator/bin/lynx-simulator.js help <command>
```

Use the bin path for CLI validation because it exercises the same entry used by
global npm installs.
