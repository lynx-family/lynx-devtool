---
name: auto-validate
description: "Run layered validation gates for Chromium upgrade in Lynx DevTool. Use when you need fail-fast checks across artifact sanity, protocol consistency, migration reports, automated tests, and optional device smoke."
---

# auto-validate

## Goal
Run layered validation gates for upgrade quality and stop on first blocking failure.

## Use When
- Need machine-checkable acceptance for Chromium upgrade execution.
- Want tests and consistency checks to discover issues instead of hardcoded historical warnings.
- Need structured pass/fail evidence for release decisions.

## Inputs
- `repo_root` (string, required)
- `upstream_dir` (string, required)
- `run_unit_tests` (boolean, default `true`)
- `run_e2e_tests` (boolean, default `false`)
- `run_device_smoke` (boolean, default `false`)

## Validation Gates
1. Gate A: Artifact sanity
- Assert required frontend entries exist in upstream output and packaged output.

2. Gate B: Protocol consistency
- Run:
  - `<repo_root>/tools/chromium-upgrade/check-protocol-consistency.sh`
- Parse report:
  - `<repo_root>/tools/chromium-upgrade/reports/local-protocol-consistency.md`
- Fail if required protocol commands are missing between source-of-truth and generated files.

3. Gate C: Migration and custom-surface reporting
- Run:
  - `<repo_root>/tools/chromium-upgrade/generate-migration-report.sh <upstream_dir>`
  - `<repo_root>/tools/chromium-upgrade/generate-custom-surface-report.sh`
- Fail on script execution errors.

4. Gate D: Automated tests
- If `run_unit_tests=true`, run available unit or local test targets.
- If `run_e2e_tests=true`, run available interactions or e2e targets.

5. Gate E: Optional device smoke checklist
- If `run_device_smoke=true`, output checklist for manual verification and collect results.

## Success Criteria
- All enabled gates pass.
- Reports are produced and reachable.

## Output Contract
Return JSON:
- `stage`: `"auto-validate"`
- `status`: `"passed"`
- `gates`: `[{"name":"...","status":"passed","evidence_path":"..."}]`
- `reports`: array of report paths

## Failure Contract
Return JSON:
- `stage`: `"auto-validate"`
- `status`: `"failed"`
- `failed_gate`
- `command`
- `exit_code`
- `short_reason`
- `log_path`
- `report_path` (if any)
