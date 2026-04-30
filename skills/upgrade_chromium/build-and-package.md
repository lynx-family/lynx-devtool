# Skill: build-and-package

## Goal
Package upgraded upstream frontend into CLI-consumable tarball and sync it into CLI resources.

## Inputs
- `repo_root` (string, required)
- `upstream_dir` (string, required)
- `build_cli_packages` (boolean, default true)

## Steps
1. Package frontend tarball:
   - `cd <repo_root>`
   - `node scripts/build-lynx-devtools.js --frontend-dir <upstream_dir> --skip-build`
2. Sync packaged output:
   - `node scripts/sync-devtools-output.js`
3. If `build_cli_packages=true`, run:
   - `pnpm --filter @lynx-js/devtool-plugin-core run build`
   - `pnpm --filter @lynx-js/lynx-devtool-utils run build`
   - `pnpm --filter @lynx-js/lynx-devtool-cli run build`
4. Assert tarball exists in:
   - `packages/devtools-frontend-lynx/output/`
5. Assert unpacked runtime entries exist in CLI dist (if built):
   - `dist/static/devtool/lynx/inspector.html`
   - `dist/static/devtool/lynx/devtools_app.html`

## Success Output
Return JSON:
- `stage`: `"build-and-package"`
- `status`: `"passed"`
- `tarball_path`
- `synced`: true
- `cli_build_passed` (boolean)

## Failure Output
Return JSON:
- `stage`: `"build-and-package"`
- `status`: `"failed"`
- `command`
- `exit_code`
- `short_reason`
- `log_path`
