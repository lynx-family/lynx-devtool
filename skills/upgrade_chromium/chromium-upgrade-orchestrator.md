# Skill: chromium-upgrade-orchestrator

## Goal
Orchestrate full Chromium DevTools upgrade workflow for Lynx DevTool: prepare, patch, package, validate, and summarize.

## Inputs
- `target_branch` (string, required)
- `target_commit` (string, optional)
- `upstream_dir` (string, required)
- `depot_tools_dir` (string, required)
- `repo_root` (string, required)
- `run_unit_tests` (boolean, default true)
- `run_e2e_tests` (boolean, default false)
- `run_device_smoke` (boolean, default false)

## Execution Order
1. Invoke `prepare-upstream`
2. Invoke `apply-lynx-customizations`
3. Invoke `build-and-package`
4. Invoke `auto-validate`
5. Produce final summary markdown + machine-readable manifest

## Fail-Fast Policy
- Stop immediately if any child skill returns `status=failed`.
- Return child failure payload unchanged plus orchestrator context.

## Final Outputs
- `status`: `passed|failed`
- `summary_markdown_path`: `<repo_root>/tools/chromium-upgrade/reports/upgrade-summary-<timestamp>.md`
- `manifest_json_path`: `<repo_root>/tools/chromium-upgrade/reports/upgrade-manifest-<timestamp>.json`
- `executed_stages`
- `target_branch`
- `target_commit_resolved`
