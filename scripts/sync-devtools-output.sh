#!/bin/bash
a_path="packages/devtools-frontend-lynx/output"
b_path="packages/lynx-devtool-cli/resources"

# Function to detect environment
detect_environment() {
  if [[ "$(uname -s)" == "MINGW"* ]] || [[ "$(uname -s)" == "MSYS"* ]] || [[ "$(uname -s)" == "CYGWIN"* ]]; then
    echo "mingw"
    return
  fi
  
  if command -v cmd.exe >/dev/null 2>&1 && [[ -z "$(uname -s)" ]]; then
    echo "windows"
    return
  fi
  
  echo "unix"
}

env_type=$(detect_environment)
echo "Detected environment: $env_type"

# Find the latest file
find_latest_file() {
  local dir="$1"
  local pattern_base="$2"
  local pattern="$pattern_base"  # Ensure we use the correct variable

  echo "Finding latest file in $dir matching pattern: $pattern" >&2

  case "$env_type" in
    cygwin)
      echo "Using Cygwin approach to find latest file..." >&2
      # Convert the wildcard pattern into a regex for grep
      local regex
      regex=$(echo "$pattern" | sed 's/\./\\./g' | sed 's/\*/.*/g')
      if ls -1 "$dir" 2>/dev/null | grep -E "$regex" >/dev/null; then
        ls -1 "$dir" | grep -E "$regex"  | tail -n 1 | \
          xargs -I{} echo "$dir/{}"
      else
        echo "No matching files found in directory $dir" >&2
        # Debug: list all files in the directory
        echo "Files in directory:" >&2
        ls -la "$dir" >&2
        return 1
      fi
      ;;
      
    mingw)
      echo "Using MINGW approach to find latest file..." >&2
      if ls -1 "$dir"/"$pattern" >/dev/null 2>&1; then
        ls -1 "$dir"/"$pattern" | sort -t. -k3 -n | tail -n 1
      else
        echo "No matching files found" >&2
        return 1
      fi
      ;;

    windows)
      echo "Using native Windows approach to find latest file..." >&2
      if command -v powershell.exe >/dev/null 2>&1; then
        echo "Attempting PowerShell method..." >&2
        win_dir=$(echo "$dir" | sed 's|/|\\|g')
        powershell.exe -Command "Get-ChildItem -Path \"$win_dir\" | Where-Object { \$_.Name -like \"$pattern\" } | Sort-Object -Property Name | Select-Object -Last 1 -ExpandProperty FullName" | tr -d '\r'
      else
        echo "Falling back to cmd.exe method..." >&2
        win_dir=$(echo "$dir" | sed 's|/|\\|g')
        old_pwd=$(pwd)
        cd "$dir" || return
        local filename
        filename=$(cmd.exe /c "dir /b /o:n $pattern" | tail -n 1)
        cd "$old_pwd" || return
        if [[ -n "$filename" ]]; then
          echo "${dir}/${filename}"
        else
          echo "No matching files found" >&2
          return 1
        fi
      fi
      ;;

    unix)
      echo "Using Unix approach to find latest file..." >&2
      find "$dir" -type f -name "$pattern" | sort -V | tail -n 1 || {
        echo "No matching files found" >&2
        return 1
      }
      ;;
  esac
}

# Delete files matching pattern
delete_matching_files() {
  local dir="$1"
  local pattern="$2"
  
  case "$env_type" in
    mingw)
      echo "Using MINGW approach to delete files..." >&2
      rm -f "$dir"/$pattern 2>/dev/null || echo "No files to delete" >&2
      ;;
      
    windows)
      echo "Using native Windows approach to delete files..." >&2
      # Try PowerShell first
      if command -v powershell.exe >/dev/null 2>&1; then
        echo "Attempting PowerShell deletion..." >&2
        win_dir=$(echo "$dir" | sed 's|/|\\|g')
        powershell.exe -Command "Remove-Item -Path \"$dir\\$pattern\" -Force -ErrorAction SilentlyContinue" || echo "No files to delete" >&2
      else
        # Fall back to cmd.exe
        echo "Falling back to cmd.exe deletion..." >&2
        win_dir=$(echo "$dir" | sed 's|/|\\|g')
        win_pattern=$(echo "$pattern" | sed 's|\.|\\\.|g')
        cmd.exe /c "del /q \"${win_dir}\\${win_pattern}\" 2>nul" || echo "No files to delete" >&2
      fi
      ;;
      
    unix)
      echo "Using Unix approach to delete files..." >&2
      find "$dir" -type f -name "$pattern" -exec rm -v {} \; 2>/dev/null || echo "No files to delete" >&2
      ;;
  esac
}

# Check if the directory exists first
if [[ ! -d "$a_path" ]]; then
  echo "ERROR: Directory $a_path does not exist!"
  exit 1
fi

# List files in the directory to debug
echo "Files in output directory:"
case "$env_type" in
  windows) dir "$a_path" ;;
  *) ls -la "$a_path" ;;
esac

# Find the latest file
latest_file=$(find_latest_file "$a_path" "devtool.frontend.lynx_1.0.*.tar.gz")

if [[ -z "$latest_file" ]]; then
  echo "Error: devtool.frontend.lynx not found."
  echo "Current directory: $(pwd)"
  echo "Looking for files in: $a_path"
  exit 1
fi

echo "The latest devtool.frontend.lynx dist: $latest_file"

# Make sure the target directory exists
mkdir -p "$b_path"
echo "Deleting old dist..."

# Delete old files
delete_matching_files "$b_path" "devtool.frontend.lynx_1.0.*.tar.gz"

echo "cp the latest dist..."
cp -v "$latest_file" "$b_path/"
echo "Sync devtools output successfully!"
