---
name: prepare-upstream
description: "Prepare Chromium devtools-frontend upstream baseline for Lynx DevTool upgrade. Use when user provides target Chromium branch/commit and needs checkout validation, dependency sync, clean build, and entry artifact checks."
---

# prepare-upstream

## Goal
Prepare and validate an upstream `devtools-frontend` checkout for a target Chromium branch or commit, and confirm it builds as a clean baseline.

## Use When
- User provides a target Chromium version and asks to start upgrade work.
- Need to verify upstream checkout health before applying Lynx customizations.
- Need deterministic baseline checks for branch, commit, build, and generated entry files.

## Inputs
- `target_branch` (string, required)
- `target_commit` (string, optional)
- `upstream_dir` (string, required)
- `depot_tools_dir` (string, required)
- `sync_deps` (boolean, default `true`)

## Workflow
1. Validate `upstream_dir` and `depot_tools_dir` exist.
2. Validate git ref in `upstream_dir` matches `target_branch` and optional `target_commit`.
3. If `sync_deps=true`, run:
   - `DEPOT_TOOLS_UPDATE=0 PATH=<depot_tools_dir>:$PATH gclient sync -D --jobs=16`
4. Build upstream frontend:
   - `DEPOT_TOOLS_UPDATE=0 PATH=<depot_tools_dir>:$PATH npm run build -- --target=Default`
5. Assert required artifacts exist:
   - `out/Default/gen/front_end/inspector.html`
   - `out/Default/gen/front_end/devtools_app.html`

## Success Criteria
- Branch and commit checks pass.
- Build exits successfully.
- Required entry artifacts exist.

## Output Contract
Return JSON:
- `stage`: `"prepare-upstream"`
- `status`: `"passed"`
- `resolved_branch`
- `resolved_commit`
- `frontend_gen_dir`
- `checks`: array of passed assertions

## Failure Contract
Return JSON:
- `stage`: `"prepare-upstream"`
- `status`: `"failed"`
- `command`
- `exit_code`
- `short_reason`
- `log_path`
