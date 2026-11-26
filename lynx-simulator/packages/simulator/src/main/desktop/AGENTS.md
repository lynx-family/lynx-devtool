# Simulator Desktop Main Agent Guide

This directory contains the Lynxtron desktop app main process.

## Structure

- `main.ts`: desktop app bootstrap.
- `extensions.ts`: distribution extension points for native extensions and
  real JSB handlers. Other distributions replace this module at build time;
  keep its exports stable.
- `application`: app menu, theme, error UI, and packaged asset paths.
- `instance`: IPC server and existing-instance command handling.
- `jsb`: app-specific JSB handlers.
- `support`: app-specific helper logic shared inside the desktop main process.

## Development Rules

- Create simulator windows through `createSimulatorRuntime` from core. Use raw
  Lynxtron APIs only for app bootstrap and lifecycle wiring.

## Instance Flow

Each launched app process owns one simulator instance id and one IPC endpoint.
The CLI uses `--instance` to route commands to a specific running app.

Startup:

```text
main.ts
  -> create instance record
  -> start IPC server
  -> keep server alive while the app is running
```

Instance command:

```text
CLI --instance command
  -> route to the matching IPC endpoint
  -> instance request handler
  -> parse rawArgv with shared command parser
  -> execute command against the running runtime/windows
```

Instance commands should not launch another app. They operate on the already
running runtime and windows. Keep instance record, IPC endpoint, and cleanup
logic consistent when changing this area.

## Validation

Run from the monorepo root:

```bash
pnpm --filter @lynx-js/lynx-simulator run build:desktop
pnpm --filter @lynx-js/lynx-simulator run start
```

When testing CLI-managed instances, use:

```bash
node packages/simulator/bin/lynx-simulator.js open <target>
node packages/simulator/bin/lynx-simulator.js status --instance <id>
node packages/simulator/bin/lynx-simulator.js quit --instance <id>
```
