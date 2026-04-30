---
name: build-and-package
description: "Build and package upgraded devtools frontend into Lynx CLI-consumable tarball. Use when patched upstream output must be packed, synced, and optionally verified via related package builds."
---

# build-and-package

## Goal
Package upgraded upstream frontend into CLI-consumable tarball, sync it into resources, and optionally rebuild dependent packages.

## Use When
- Upstream build is done and patched frontend needs distribution packaging.
- You need to update CLI static resources with a new tarball.
- You want repeatable packaging and artifact existence checks.

## Inputs
- `repo_root` (string, required)
- `upstream_dir` (string, required)
- `build_cli_packages` (boolean, default `true`)

## Workflow
1. Package frontend tarball:
   - `cd <repo_root>`
   - `node scripts/build-lynx-devtools.js --frontend-dir <upstream_dir> --skip-build`
2. Sync package output:
   - `node scripts/sync-devtools-output.js`
3. If `build_cli_packages=true`, run:
   - `pnpm --filter @lynx-js/devtool-plugin-core run build`
   - `pnpm --filter @lynx-js/lynx-devtool-utils run build`
   - `pnpm --filter @lynx-js/lynx-devtool-cli run build`
4. Assert packaging outputs:
   - tarball exists under `packages/devtools-frontend-lynx/output/`
   - if built, CLI dist contains:
     - `dist/static/devtool/lynx/inspector.html`
     - `dist/static/devtool/lynx/devtools_app.html`

## Success Criteria
- Tarball is generated and synced.
- Optional dependent package builds pass.
- Required entry files are present in expected locations.

## Output Contract
Return JSON:
- `stage`: `"build-and-package"`
- `status`: `"passed"`
- `tarball_path`
- `synced`: `true`
- `cli_build_passed` (boolean)

## Failure Contract
Return JSON:
- `stage`: `"build-and-package"`
- `status`: `"failed"`
- `command`
- `exit_code`
- `short_reason`
- `log_path`
