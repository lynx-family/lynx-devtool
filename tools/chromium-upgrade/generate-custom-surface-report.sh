#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PATTERNS_FILE="${1:-$SCRIPT_DIR/custom-surface-patterns.tsv}"
OUTPUT_FILE="${2:-$SCRIPT_DIR/reports/local-custom-surface.md}"

SCAN_PATHS=(
  "$REPO_ROOT/packages/devtools-frontend-lynx"
  "$REPO_ROOT/plugins/devtool"
  "$REPO_ROOT/src"
  "$REPO_ROOT/packages/lynx-devtool-cli"
)

mkdir -p "$(dirname "$OUTPUT_FILE")"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

{
  echo "# Local Custom Surface Report"
  echo
  echo "- Generated at: $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "- Repository root: \`$REPO_ROOT\`"
  echo "- Pattern file: \`$PATTERNS_FILE\`"
  echo
  echo "This report is a grep-based index of Lynx-specific protocol, transport,"
  echo "bridge, panel, and packaging markers in the current repository."
  echo

  while IFS=$'\t' read -r pattern description; do
    if [[ -z "${pattern}" || "${pattern}" == \#* ]]; then
      continue
    fi

    echo "## \`$pattern\`"
    echo
    echo "$description"
    echo

    if rg -n --glob '!**/node_modules/**' "$pattern" "${SCAN_PATHS[@]}" > "$TMP_FILE"; then
      echo '```text'
      cat "$TMP_FILE"
      echo '```'
    else
      echo "_No matches found_"
    fi
    echo
  done < "$PATTERNS_FILE"
} > "$OUTPUT_FILE"

echo "Wrote $OUTPUT_FILE"
