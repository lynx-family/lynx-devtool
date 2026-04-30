# Skill: auto-validate

## Goal
Run layered validation gates for upgrade quality, fail fast on any gate.

## Inputs
- `repo_root` (string, required)
- `upstream_dir` (string, required)
- `run_unit_tests` (boolean, default true)
- `run_e2e_tests` (boolean, default false)
- `run_device_smoke` (boolean, default false)

## Validation Gates
1. Gate A: Build artifact sanity
- Assert required frontend entries exist under upstream and packaged output.

2. Gate B: Protocol consistency
- Run:
  - `<repo_root>/tools/chromium-upgrade/check-protocol-consistency.sh`
- Parse generated report:
  - `<repo_root>/tools/chromium-upgrade/reports/local-protocol-consistency.md`
- Fail if any required command is missing across source-of-truth vs generated.

3. Gate C: Migration/custom surface reports
- Run:
  - `<repo_root>/tools/chromium-upgrade/generate-migration-report.sh <upstream_dir>`
  - `<repo_root>/tools/chromium-upgrade/generate-custom-surface-report.sh`
- Fail only on script execution failure (report content is for review signal).

4. Gate D: Automated tests
- If `run_unit_tests=true`, run available unit/local test target.
- If `run_e2e_tests=true`, run available interaction/e2e target.

5. Gate E: Optional device smoke checklist
- If `run_device_smoke=true`, output structured manual checklist and wait for results ingestion.

## Success Output
Return JSON:
- `stage`: `"auto-validate"`
- `status`: `"passed"`
- `gates`: [{`name`, `status`, `evidence_path`}]
- `reports`: array of report paths

## Failure Output
Return JSON:
- `stage`: `"auto-validate"`
- `status`: `"failed"`
- `failed_gate`
- `command`
- `exit_code`
- `short_reason`
- `log_path`
- `report_path` (if any)
