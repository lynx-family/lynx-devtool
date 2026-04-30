---
name: apply-lynx-customizations
description: "Apply Lynx overlay and repeatable patch set onto upstream Chromium devtools-frontend. Use when baseline upstream build is ready and migration patches must be replayed and validated by rebuild."
---

# apply-lynx-customizations

## Goal
Apply Lynx overlay and repeatable patch scripts to an upstream checkout, then verify patched source still builds.

## Use When
- Upstream baseline is prepared and you need to migrate Lynx custom surfaces.
- You want idempotent replay via scripts instead of manual edits.
- You need build-backed validation for overlay and patch integrity.

## Inputs
- `upstream_dir` (string, required)
- `depot_tools_dir` (string, required)
- `repo_root` (string, required)

## Workflow
1. Run overlay:
   - `<repo_root>/tools/chromium-upgrade/apply-upstream-overlay.sh <upstream_dir>`
2. Replay repeatable patch explicitly:
   - `node <repo_root>/tools/chromium-upgrade/patch-upstream-lynx-features.js <upstream_dir>`
3. Rebuild upstream:
   - `cd <upstream_dir>`
   - `DEPOT_TOOLS_UPDATE=0 PATH=<depot_tools_dir>:$PATH npm run build -- --target=Default`
4. Assert patched build output exists:
   - `out/Default/gen/front_end/inspector.html`
   - `out/Default/gen/front_end/devtools_app.html`

## Success Criteria
- Overlay command succeeds.
- Patch command succeeds without anchor errors.
- Rebuild succeeds with required entries present.

## Output Contract
Return JSON:
- `stage`: `"apply-lynx-customizations"`
- `status`: `"passed"`
- `overlay_applied`: `true`
- `patch_applied`: `true`
- `build_passed`: `true`

## Failure Contract
Return JSON:
- `stage`: `"apply-lynx-customizations"`
- `status`: `"failed"`
- `command`
- `exit_code`
- `short_reason`
- `log_path`
