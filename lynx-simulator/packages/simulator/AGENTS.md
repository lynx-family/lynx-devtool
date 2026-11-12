# Lynx Simulator App Agent Guide

This package is the official Lynx Simulator application and npm CLI.

## Structure

- `bin`: npm CLI entry.
- `src/cli`: TypeScript CLI launcher.
- `src/main/desktop`: Lynxtron main process.
- `src/app`: built-in ReactLynx home UI.
- `src/shared`: helpers shared by CLI and main process.
- `resources`: app resources.

## Development Rules

- Keep `src/shared` independent from Lynxtron runtime and Lynx UI code. Put only
  CLI/main shared infrastructure there.
- Keep command syntax in `src/shared/commands.ts`; put command behavior in CLI
  dispatch or desktop handlers.
- Do not import core runtime or main-process code into `src/app`. Communicate
  through `services/bridge.ts` and `globalProps`.

## Validation

Run from the `lynx-simulator` workspace root after `pnpm build:core`:

```bash
pnpm --filter @lynx-js/lynx-simulator run build
pnpm --filter @lynx-js/lynx-simulator run typecheck
pnpm --filter @lynx-js/lynx-simulator run test
```

For CLI-specific validation, follow `src/cli/AGENTS.md`.
For desktop main-process validation, follow `src/main/desktop/AGENTS.md`.

## Testing Rules

- Put simulator unit tests near the code they cover under `src/**/__tests__`.
- Put page scenario fixtures under `test/fixtures/cases/<case-name>`.
- Use `recorder.json` with `generated-page-env.expected.json` for page-env
  generation tests.
- Use `template.js` with `page-env.json` for page-open or UI smoke tests.
- Do not rely on real Lynxtron windows in unit tests; use separate smoke or
  integration checks for real app startup.
