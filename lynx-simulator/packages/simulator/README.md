# @lynx-js/lynx-simulator

Official Lynx Simulator application built with Lynxtron.

## Features

- Home window for opening a Lynx page from an HTTP(S) URL, file URL, or local
  bundle path.
- Size picker with default size, built-in device presets, and temporary custom
  sizes.
- CLI entry `lynx-simulator`.
- App menu entries for theme switching and DevTool settings.
- Structured error display for open failures.

## Install

Install the published npm package globally:

```bash
npm install -g @lynx-js/lynx-simulator
```

## Usage

Open the home window:

```bash
lynx-simulator
```

Open a Lynx page directly:

```bash
lynx-simulator open <target>
```

Load page environment data for template data, global props, or JSB mocks:

```bash
lynx-simulator open <target> --page-env ./page-env.json
```

`--page-env` accepts an HTTP(S) URL, file URL, or local JSON file path.

Use help for the full CLI reference:

```bash
lynx-simulator --help
lynx-simulator help open
```

## Update notifications

When an interactive command finds a newer published version, it prints an
update hint to stderr. Set `LYNX_SIMULATOR_UPDATE_CHECK_DISABLED=1` to disable
these checks.

## Local Development

From the `lynx-simulator` workspace root:

```bash
pnpm install
pnpm build:core
```

Run the desktop app in development mode:

```bash
pnpm --filter @lynx-js/lynx-simulator run dev
```

Start the built desktop app:

```bash
pnpm --filter @lynx-js/lynx-simulator run start
```

Open a page from the npm script:

```bash
pnpm --filter @lynx-js/lynx-simulator run start -- open <target>
```

Build:

```bash
pnpm --filter @lynx-js/lynx-simulator run build
```

## Testing

- `pnpm --filter @lynx-js/lynx-simulator run test`: run unit tests.
- `pnpm --filter @lynx-js/lynx-simulator run typecheck`: type-check the
  simulator. It resolves core through core's generated declarations, so build
  core first. `pnpm typecheck` at the workspace root does both.

## Distributions

The package builds the public distribution. Values that differ between
distributions are kept in two modules:

- `src/shared/distribution.ts`: package name, Lynxtron host package, update
  command, documentation links, and an optional CLI telemetry endpoint. The
  public distribution has no telemetry endpoint, so the CLI neither records nor
  uploads telemetry unless `LYNX_SIMULATOR_METRICS_UPLOAD_URL` is set.
- `src/main/desktop/extensions.ts`: native host extensions and real JSB
  handlers. The public app has none; page environment mocks still apply.

Another distribution can build the same sources with `rspack.configs.ts`,
replacing these modules through `alias` and mapping packages through
`externals`. Keep both modules free of distribution-specific values.

Lynx templates are specific to the Lynx engine of the Lynxtron host. A
distribution that runs on a different host builds the Home page from
`src/app` with its own Lynx toolchain and passes the output through
`lynxBundleDirectory`.

See the workspace README for the commands that build every package.
