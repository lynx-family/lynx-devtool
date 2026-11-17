# Lynx Simulator

Lynx Simulator runs Lynx pages in a desktop window built with Lynxtron.

## Packages

- [`@lynx-js/lynx-simulator-core`](packages/core): SDK for building simulator
  applications: window runtime, commands, devices, errors and page
  environments.
- [`@lynx-js/lynx-simulator`](packages/simulator): the simulator desktop app and
  its `lynx-simulator` CLI.

## Development

This directory is a standalone pnpm workspace with its own Node.js version and
lockfile.

```bash
nvm use
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm start
```

Each package script only builds or checks its own package. The workspace
scripts above run cross-package steps in order, for example building core
before the simulator resolves its declarations.

See each package's README for its commands and APIs.
