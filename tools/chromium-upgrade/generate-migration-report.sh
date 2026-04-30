#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MAP_FILE="$SCRIPT_DIR/migration-map.tsv"
DEFAULT_UPSTREAM="/Users/bytedance/workspace/codes/devtools-frontend-upstream-7724"
UPSTREAM_ROOT="${1:-$DEFAULT_UPSTREAM}"
UPSTREAM_NAME="$(basename "$UPSTREAM_ROOT")"
REPORT_DIR="$SCRIPT_DIR/reports"
REPORT_FILE="${2:-$REPORT_DIR/${UPSTREAM_NAME}.md}"

mkdir -p "$REPORT_DIR"

if [[ ! -d "$UPSTREAM_ROOT" ]]; then
  echo "Upstream checkout not found: $UPSTREAM_ROOT" >&2
  exit 1
fi

if [[ ! -f "$MAP_FILE" ]]; then
  echo "Migration map not found: $MAP_FILE" >&2
  exit 1
fi

extract_json_value() {
  local file="$1"
  local key="$2"
  rg -n "\"$key\"" "$file" | head -n 1 | sed 's/^[0-9]*://' | awk -F'"' '{print $4}'
}

extract_deps_value() {
  local file="$1"
  local key="$2"
  rg -n "'$key':" "$file" | head -n 1 | sed 's/^[0-9]*://' | awk -F"'" '{print $4}'
}

UPSTREAM_COMMIT="$(git -C "$UPSTREAM_ROOT" rev-parse HEAD)"
UPSTREAM_BRANCH="$(git -C "$UPSTREAM_ROOT" branch --show-current)"
UPSTREAM_TYPESCRIPT="$(extract_json_value "$UPSTREAM_ROOT/package.json" "typescript")"
UPSTREAM_ESLINT="$(extract_json_value "$UPSTREAM_ROOT/package.json" "eslint")"
UPSTREAM_ROLLUP="$(extract_json_value "$UPSTREAM_ROOT/package.json" "rollup")"
UPSTREAM_NODE_TYPES="$(extract_json_value "$UPSTREAM_ROOT/package.json" "@types/node")"
UPSTREAM_CHROME="$(extract_deps_value "$UPSTREAM_ROOT/DEPS" "chrome")"

{
  echo "# Migration Report: $UPSTREAM_NAME"
  echo
  echo "- Upstream path: \`$UPSTREAM_ROOT\`"
  echo "- Upstream branch: \`$UPSTREAM_BRANCH\`"
  echo "- Upstream commit: \`$UPSTREAM_COMMIT\`"
  echo "- Upstream Chrome for tests: \`$UPSTREAM_CHROME\`"
  echo "- Upstream TypeScript: \`$UPSTREAM_TYPESCRIPT\`"
  echo "- Upstream ESLint: \`$UPSTREAM_ESLINT\`"
  echo "- Upstream Rollup: \`$UPSTREAM_ROLLUP\`"
  echo "- Upstream @types/node: \`$UPSTREAM_NODE_TYPES\`"
  echo
  echo "## Migration Map"
  echo
  echo "| Priority | Category | Status | Local path | Upstream path | Upstream state | Notes |"
  echo "| --- | --- | --- | --- | --- | --- | --- |"

  tail -n +2 "$MAP_FILE" | while IFS=$'\t' read -r category map_status priority local_path upstream_path notes; do
    upstream_state="$map_status"
    if [[ "$upstream_path" == "n/a" ]]; then
      upstream_path=""
    fi
    if [[ -n "$upstream_path" ]]; then
      if [[ -e "$UPSTREAM_ROOT/$upstream_path" ]]; then
        upstream_state="exists"
      else
        upstream_state="missing"
      fi
    fi
    echo "| $priority | $category | $map_status | \`$local_path\` | \`${upstream_path:-n/a}\` | $upstream_state | $notes |"
  done
  echo
  echo "## Notes"
  echo
  echo "- Files marked \`derived\` should be regenerated, not manually ported."
  echo "- Files marked \`custom_only\` have no direct upstream equivalent in this checkout."
  echo "- Files marked \`moved\` changed location and should be ported onto the new path."
} > "$REPORT_FILE"

echo "Wrote migration report to: $REPORT_FILE"
