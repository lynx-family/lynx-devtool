# Skill: prepare-upstream

## Goal
Prepare and validate an upstream devtools-frontend checkout for a target Chromium branch/commit, and ensure it can build as a clean baseline.

## Inputs
- `target_branch` (string, required)
- `target_commit` (string, optional)
- `upstream_dir` (string, required)
- `depot_tools_dir` (string, required)
- `sync_deps` (boolean, default true)

## Steps
1. Validate directories exist: `upstream_dir`, `depot_tools_dir`.
2. In `upstream_dir`, check git branch/commit matches input.
3. If `sync_deps=true`, run:
   - `DEPOT_TOOLS_UPDATE=0 PATH=<depot_tools_dir>:$PATH gclient sync -D --jobs=16`
4. Build upstream frontend:
   - `DEPOT_TOOLS_UPDATE=0 PATH=<depot_tools_dir>:$PATH npm run build -- --target=Default`
5. Assert output exists:
   - `out/Default/gen/front_end/inspector.html`
   - `out/Default/gen/front_end/devtools_app.html`

## Success Output
Return JSON:
- `stage`: `"prepare-upstream"`
- `status`: `"passed"`
- `resolved_branch`
- `resolved_commit`
- `frontend_gen_dir`
- `checks`: array of passed assertions

## Failure Output
Return JSON:
- `stage`: `"prepare-upstream"`
- `status`: `"failed"`
- `command`
- `exit_code`
- `short_reason`
- `log_path`
