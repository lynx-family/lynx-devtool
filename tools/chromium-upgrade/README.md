# Chromium Upgrade Tools

This directory contains repeatable helpers for the `packages/devtools-frontend-lynx`
upgrade work.

> For background context, architecture overview, and current progress, see:
> **[docs/chromium-upgrade-overview.zh-CN.md](../../docs/chromium-upgrade-overview.zh-CN.md)**


## Files

- `migration-map.tsv`
  - Curated list of high-risk Lynx customizations and where they should land in
    a newer upstream DevTools checkout.
- `custom-surface-patterns.tsv`
  - Grep patterns describing Lynx-specific protocol, bridge, transport, and
    product integration markers in the current repository.
- `generate-migration-report.sh`
  - Reads `migration-map.tsv` and an upstream checkout path, then writes a
    Markdown report showing file presence, path moves, and migration notes.
- `generate-custom-surface-report.sh`
  - Reads `custom-surface-patterns.tsv` and writes a Markdown report of all
    matching local customization points.
- `check-protocol-consistency.sh`
  - Compares Lynx protocol commands across `js_protocol.pdl`,
    `browser_protocol.json`, and generated frontend protocol artifacts.
- `patch-devtools-compatibility.js`
  - Adds the custom `reattachMainTarget()` embedder-to-frontend dispatch to a
    newer upstream `devtools_compatibility.js`.
- `patch-upstream-lynx-features.js`
  - Applies repeatable Lynx-specific patches onto a newer upstream checkout,
    including custom protocol registration, debugger/runtime lifecycle hooks,
    TracingManager proto stream conversion, Preact Devtools registration,
    MainImpl loading progress telemetry, and Screencast/Overlay bridge behavior.
- `apply-upstream-overlay.sh`
  - Copies the checked-in overlay files onto an upstream checkout and then runs
    the repeatable patch scripts for compatibility and Lynx feature migration.
    It also copies `static/trace/*`, top-level static runtime files, and
    `panels/preact_devtools/*` into the upstream frontend tree and the existing
    generated frontend output when present.
- `upstream-overlays/chromium-7724/*`
  - Checked-in Lynx overlay sources that should be applied onto the
    `chromium/7724` upstream checkout.

## Usage

Generate a report against the current upstream bootstrap checkout:

```bash
tools/chromium-upgrade/generate-migration-report.sh
```

Generate a report against a different upstream checkout:

```bash
tools/chromium-upgrade/generate-migration-report.sh /abs/path/to/devtools-frontend-upstream
```

Generate a local customization index:

```bash
tools/chromium-upgrade/generate-custom-surface-report.sh
```

Check whether Lynx protocol commands are consistent across source and generated files:

```bash
tools/chromium-upgrade/check-protocol-consistency.sh
```

Apply the current Lynx overlay onto the bootstrap upstream checkout:

```bash
tools/chromium-upgrade/apply-upstream-overlay.sh
```

Apply only the repeatable Lynx patch set onto a prepared upstream checkout:

```bash
node tools/chromium-upgrade/patch-upstream-lynx-features.js /abs/path/to/devtools-frontend-upstream
```

Package a built upstream checkout into the existing CLI-consumable tarball
layout:

```bash
node scripts/build-lynx-devtools.js --frontend-dir /abs/path/to/devtools-frontend-upstream --skip-build
node scripts/sync-devtools-output.js
pnpm --filter @lynx-js/lynx-devtool-cli run build
```

The generated report is written under `tools/chromium-upgrade/reports/`.

## Current bootstrap checkout

The first execution of the upgrade plan cloned:

- `/Users/bytedance/workspace/codes/devtools-frontend-upstream-7724`

This tracks:

- Branch: `chromium/7724`
- Commit: `a429d5a8b2e78b92dc99ef220ca67c402cbe1a67`

## Generated reports

- `reports/devtools-frontend-upstream-7724.md`
  - Migration map against the `chromium/7724` upstream bootstrap checkout.
- `reports/local-custom-surface.md`
  - Grep-based index of current Lynx-specific customization points.
- `reports/local-protocol-consistency.md`
  - Diff report showing which Lynx protocol commands are missing from source
    versus generated artifacts.
