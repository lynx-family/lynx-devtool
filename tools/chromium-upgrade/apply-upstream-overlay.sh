#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OVERLAY_ROOT="$SCRIPT_DIR/upstream-overlays/chromium-7724"
TARGET_DIR="${1:-/Users/bytedance/workspace/codes/devtools-frontend-upstream-7724}"
BACKUP_DIR="$TARGET_DIR/.lynx-upgrade-backup"

if [[ ! -d "$TARGET_DIR/front_end" ]]; then
  echo "Target checkout is invalid: $TARGET_DIR" >&2
  exit 1
fi

copy_overlay_file() {
  local relative_path="$1"
  local source_file="$OVERLAY_ROOT/$relative_path"
  local target_file="$TARGET_DIR/$relative_path"
  local backup_file="$BACKUP_DIR/$relative_path"

  mkdir -p "$(dirname "$target_file")"
  mkdir -p "$(dirname "$backup_file")"

  if [[ -f "$target_file" && ! -f "$backup_file" ]]; then
    cp "$target_file" "$backup_file"
  fi

  cp "$source_file" "$target_file"
  echo "Applied overlay: $relative_path"
}

copy_overlay_file "front_end/core/host/InspectorFrontendHostAPI.ts"
copy_overlay_file "front_end/core/host/InspectorFrontendHost.ts"
copy_overlay_file "front_end/core/protocol_client/InspectorBackend.ts"
copy_overlay_file "front_end/core/sdk/Connections.ts"

copy_trace_assets() {
  local target_frontend_dir="$1"
  local source_dir="$REPO_ROOT/packages/devtools-frontend-lynx/static/trace"
  local target_trace_dir="$target_frontend_dir/trace"

  if [[ ! -d "$source_dir" ]]; then
    echo "Trace asset source not found: $source_dir" >&2
    return
  fi

  mkdir -p "$target_trace_dir"
  cp -R "$source_dir/." "$target_trace_dir/"
  echo "Applied trace assets: $target_trace_dir"
}

copy_trace_assets "$TARGET_DIR/front_end"

if [[ -d "$TARGET_DIR/out/Default/gen/front_end" ]]; then
  copy_trace_assets "$TARGET_DIR/out/Default/gen/front_end"
fi

copy_top_level_static_assets() {
  local target_frontend_dir="$1"
  local source_dir="$REPO_ROOT/packages/devtools-frontend-lynx/static"
  local files=(
    "apexcharts.js"
    "base64js.min.js"
    "inflate.min.js"
    "compare-versions.js"
  )

  for file in "${files[@]}"; do
    if [[ -f "$source_dir/$file" ]]; then
      cp "$source_dir/$file" "$target_frontend_dir/$file"
      echo "Applied static asset: $target_frontend_dir/$file"
    fi
  done
}

copy_preact_devtools_panel() {
  local source_dir="$REPO_ROOT/packages/devtools-frontend-lynx/front_end/panels/preact_devtools"
  local target_dir="$TARGET_DIR/front_end/panels/preact_devtools"

  if [[ ! -d "$source_dir" ]]; then
    echo "Preact Devtools source not found: $source_dir" >&2
    return
  fi

  mkdir -p "$target_dir"
  cp -R "$source_dir/." "$target_dir/"
  echo "Applied Preact Devtools panel: $target_dir"
}

copy_top_level_static_assets "$TARGET_DIR/front_end"

if [[ -d "$TARGET_DIR/out/Default/gen/front_end" ]]; then
  copy_top_level_static_assets "$TARGET_DIR/out/Default/gen/front_end"
fi

copy_preact_devtools_panel

DEVTOOLS_COMPATIBILITY="$TARGET_DIR/front_end/devtools_compatibility.js"

if [[ -f "$DEVTOOLS_COMPATIBILITY" && ! -f "$BACKUP_DIR/front_end/devtools_compatibility.js" ]]; then
  mkdir -p "$BACKUP_DIR/front_end"
  cp "$DEVTOOLS_COMPATIBILITY" "$BACKUP_DIR/front_end/devtools_compatibility.js"
fi

node "$SCRIPT_DIR/patch-devtools-compatibility.js" "$DEVTOOLS_COMPATIBILITY"
node "$SCRIPT_DIR/patch-upstream-lynx-features.js" "$TARGET_DIR"

echo "Overlay applied to $TARGET_DIR"
