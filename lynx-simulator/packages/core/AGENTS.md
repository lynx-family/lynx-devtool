# Lynx Simulator Core Agent Guide

This package is the reusable SDK consumed by the official simulator app and by
custom simulator apps.

## Structure

- `src/runtime`: Lynxtron runtime wrapper and window model.
- `src/command`: command parser, built-in command definitions, help/version text.
- `src/device`: built-in device presets and formatting helpers.
- `src/page-environment`: opt-in page-env loading, mock composition, and lifecycle helpers.
- `src/errors`: structured error helpers.
- `src/assets`: core-owned Lynx assets, currently the DevTool settings page.

## Development Rules

- Keep core free of official simulator UI, menu, logging, and product policy.
- Do not import simulator app files from core.
- Expose reusable APIs for runtime, command parsing, devices, errors, and other
  capabilities that can be shared by simulator apps.
- Export only APIs and types that consumers should use. Keep internal helpers
  private to their module.
- When changing public APIs, update `src/index.ts` and run the core build and
  typecheck commands.
- Errors exposed by core APIs should use the stable `SimulatorErrorInfo` shape.
- Keep command parsing semantic-free: core parses and validates command shape;
  apps decide what commands do.
- Keep core-owned assets such as DevTool settings loadable after bundling; use
  externals or copy assets when needed.

## Validation

Run from the `lynx-simulator` workspace root:

```bash
pnpm --filter @lynx-js/lynx-simulator-core run build
pnpm --filter @lynx-js/lynx-simulator-core run typecheck
pnpm --filter @lynx-js/lynx-simulator-core run test
```

## Testing Rules

- Put core tests in `packages/core/test/*.test.js`.
- Keep tests grouped by module, such as command, device, errors, and runtime.
- Prefer fake or stubbed Lynxtron dependencies when testing runtime behavior.
- Add or update tests when changing public APIs, parser rules, device presets,
  error conversion, or runtime validation.
