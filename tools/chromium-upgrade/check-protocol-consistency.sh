#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_FILE="${1:-$SCRIPT_DIR/reports/local-protocol-consistency.md}"

PDL_FILE="$REPO_ROOT/packages/devtools-frontend-lynx/v8/include/js_protocol.pdl"
JSON_FILE="$REPO_ROOT/packages/devtools-frontend-lynx/third_party/blink/public/devtools_protocol/browser_protocol.json"
GENERATED_FILE="$REPO_ROOT/packages/devtools-frontend-lynx/front_end/generated/InspectorBackendCommands.js"

mkdir -p "$(dirname "$OUTPUT_FILE")"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PDL_COMMANDS_FILE="$TMP_DIR/pdl.txt"
JSON_COMMANDS_FILE="$TMP_DIR/json.txt"
GENERATED_COMMANDS_FILE="$TMP_DIR/generated.txt"

awk '
  /^domain Lynx$/ { in_domain=1; next }
  /^(domain|experimental domain|deprecated domain) / {
    if (in_domain) {
      exit
    }
  }
  in_domain && $1 == "command" {
    print $2
  }
' "$PDL_FILE" | sort -u > "$PDL_COMMANDS_FILE"

node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const domain = data.domains.find(d => d.domain === 'Lynx');
const commands = (domain?.commands || []).map(command => command.name).sort();
for (const command of commands) {
  console.log(command);
}
" "$JSON_FILE" | sort -u > "$JSON_COMMANDS_FILE"

rg -o "Lynx\\.[A-Za-z0-9_]+" "$GENERATED_FILE" | sed 's/^Lynx\.//' | sort -u > "$GENERATED_COMMANDS_FILE"

{
  echo "# Local Protocol Consistency Report"
  echo
  echo "- Generated at: $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "- PDL file: \`$PDL_FILE\`"
  echo "- Browser protocol file: \`$JSON_FILE\`"
  echo "- Generated commands file: \`$GENERATED_FILE\`"
  echo
  echo "## Lynx Commands In Source"
  echo
  echo "### js_protocol.pdl"
  echo
  echo '```text'
  cat "$PDL_COMMANDS_FILE"
  echo '```'
  echo
  echo "### browser_protocol.json"
  echo
  echo '```text'
  cat "$JSON_COMMANDS_FILE"
  echo '```'
  echo
  echo "### generated InspectorBackendCommands.js"
  echo
  echo '```text'
  cat "$GENERATED_COMMANDS_FILE"
  echo '```'
  echo
  echo "## Commands Present In Generated But Missing From PDL"
  echo
  echo '```text'
  comm -13 "$PDL_COMMANDS_FILE" "$GENERATED_COMMANDS_FILE" || true
  echo '```'
  echo
  echo "## Commands Present In Generated But Missing From browser_protocol.json"
  echo
  echo '```text'
  comm -13 "$JSON_COMMANDS_FILE" "$GENERATED_COMMANDS_FILE" || true
  echo '```'
  echo
  echo "## Commands Present In PDL But Missing From Generated"
  echo
  echo '```text'
  comm -23 "$PDL_COMMANDS_FILE" "$GENERATED_COMMANDS_FILE" || true
  echo '```'
  echo
  echo "## Commands Present In browser_protocol.json But Missing From Generated"
  echo
  echo '```text'
  comm -23 "$JSON_COMMANDS_FILE" "$GENERATED_COMMANDS_FILE" || true
  echo '```'
} > "$OUTPUT_FILE"

echo "Wrote $OUTPUT_FILE"
