# Skill: apply-lynx-customizations

## Goal
Apply Lynx overlay and repeatable patch set to an upstream checkout and validate the patched source still builds.

## Inputs
- `upstream_dir` (string, required)
- `depot_tools_dir` (string, required)
- `repo_root` (string, required)

## Steps
1. Run overlay script:
   - `<repo_root>/tools/chromium-upgrade/apply-upstream-overlay.sh <upstream_dir>`
2. Run repeatable patch explicitly (idempotence check):
   - `node <repo_root>/tools/chromium-upgrade/patch-upstream-lynx-features.js <upstream_dir>`
3. Rebuild upstream:
   - `cd <upstream_dir>`
   - `DEPOT_TOOLS_UPDATE=0 PATH=<depot_tools_dir>:$PATH npm run build -- --target=Default`
4. Assert patched build output exists:
   - `out/Default/gen/front_end/inspector.html`
   - `out/Default/gen/front_end/devtools_app.html`

## Success Output
Return JSON:
- `stage`: `"apply-lynx-customizations"`
- `status`: `"passed"`
- `overlay_applied`: true
- `patch_applied`: true
- `build_passed`: true

## Failure Output
Return JSON:
- `stage`: `"apply-lynx-customizations"`
- `status`: `"failed"`
- `command`
- `exit_code`
- `short_reason`
- `log_path`
