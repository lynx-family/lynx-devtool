---
name: SKILL
description: "Chromium upgrade workflow entry for Lynx DevTool. Use when you provide a target Chromium branch/commit and want staged execution: prepare upstream, apply Lynx customizations, build/package, and auto-validate."
---

# SKILL

## Goal
Provide a single entry skill for Lynx DevTool Chromium upgrade. This entry coordinates the full workflow and uses bundled docs in this folder as stage references.

## Bundled Stage Docs
- `chromium-upgrade-orchestrator.md` (entry workflow)
- `prepare-upstream.md`
- `apply-lynx-customizations.md`
- `build-and-package.md`
- `auto-validate.md`

## Workflow
1. Read `chromium-upgrade-orchestrator.md` first for stage order and output contract.
2. Execute stage docs in sequence:
   - `prepare-upstream.md`
   - `apply-lynx-customizations.md`
   - `build-and-package.md`
   - `auto-validate.md`
3. Stop immediately on failure and return the failing stage payload.
4. On success, return a concise summary with report and artifact paths.

## Required Inputs
- `target_branch`
- `upstream_dir`
- `depot_tools_dir`
- `repo_root`

## Optional Inputs
- `target_commit`
- `run_unit_tests` (default true)
- `run_e2e_tests` (default false)
- `run_device_smoke` (default false)

## Fail-Fast Rules
- Any failed stage blocks subsequent stages.
- Prefer script-based checks and test outputs over historical issue hints.
- Keep behavior deterministic and reproducible.

## Output
- `status`: `passed|failed`
- `executed_stages`
- `failed_stage` (on failure)
- `summary_markdown_path` (if generated)
- `manifest_json_path` (if generated)
