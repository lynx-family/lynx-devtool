---
name: chromium-upgrade-orchestrator
description: "Entry workflow skill for Lynx DevTool Chromium upgrade. Use when user provides target Chromium version and wants end-to-end execution: prepare upstream, apply Lynx customization, package outputs, run validation gates, and produce summary artifacts."
---

# chromium-upgrade-orchestrator

## Goal
Orchestrate full Chromium DevTools upgrade workflow for Lynx DevTool: prepare, patch, package, validate, and summarize.

## Use When
- User asks to upgrade to a target Chromium branch or commit.
- Need one entry skill with deterministic stage ordering and fail-fast behavior.
- Need output summary and manifest for auditability.

## Inputs
- `target_branch` (string, required)
- `target_commit` (string, optional)
- `upstream_dir` (string, required)
- `depot_tools_dir` (string, required)
- `repo_root` (string, required)
- `run_unit_tests` (boolean, default `true`)
- `run_e2e_tests` (boolean, default `false`)
- `run_device_smoke` (boolean, default `false`)

## Execution Order
1. Invoke `prepare-upstream`.
2. Invoke `apply-lynx-customizations`.
3. Invoke `build-and-package`.
4. Invoke `auto-validate`.
5. Write summary markdown and manifest JSON.

## Decision Points
- If `target_commit` is provided, branch check plus commit check are both required.
- If any child stage fails, stop immediately and return failure payload.
- If `run_e2e_tests=false`, skip Gate D e2e checks.
- If `run_device_smoke=false`, skip Gate E checklist.

## Completion Criteria
- All required stages pass.
- Summary and manifest are generated under upgrade reports.

## Output Contract
On success, return JSON:
- `status`: `"passed"`
- `executed_stages`
- `target_branch`
- `target_commit_resolved`
- `summary_markdown_path`: `<repo_root>/tools/chromium-upgrade/reports/upgrade-summary-<timestamp>.md`
- `manifest_json_path`: `<repo_root>/tools/chromium-upgrade/reports/upgrade-manifest-<timestamp>.json`

On failure, return JSON:
- `status`: `"failed"`
- `failed_stage`
- `child_failure_payload`
- `summary_markdown_path` (if generated)
