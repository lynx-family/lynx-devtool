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
  local pattern="$2"
  
  case "$env_type" in
    mingw)
      echo "Using MINGW approach to find latest file..."
      if ls "$dir"/$pattern >/dev/null 2>&1; then
        ls -1 "$dir"/$pattern | sort -t. -k3 -n | tail -n 1
      fi
      ;;
      
    windows)
      echo "Using native Windows approach to find latest file..."
      if command -v powershell.exe >/dev/null 2>&1; then
        echo "Attempting PowerShell method..."
        win_dir=$(echo "$dir" | sed 's|/|\\|g')
        powershell.exe -Command "Get-ChildItem -Path \"$dir\" -Filter \"$pattern\" | Sort-Object -Property Name | Select-Object -Last 1 -ExpandProperty FullName" | tr -d '\r'
      else
        echo "Falling back to cmd.exe method..."
        win_dir=$(echo "$dir" | sed 's|/|\\|g')
        # Save current directory
        old_pwd=$(pwd)
        cd "$dir" || return
        local filename=$(cmd.exe /c "dir /b /o:n $pattern" | tail -n 1) || echo "No matching files found"
        cd "$old_pwd" || return
        if [[ -n "$filename" ]]; then
          echo "${dir}/${filename}"
        else
          echo "No matching files found"
        fi
      fi
      ;;
      
    unix)
      echo "Using Unix approach to find latest file..."
      find "$dir" -type f -name "$pattern" | sort -V | tail -n 1 || echo "No matching files found"
      ;;
  esac
}

# Delete files matching pattern
delete_matching_files() {
  local dir="$1"
  local pattern="$2"
  
  case "$env_type" in
    mingw)
      echo "Using MINGW approach to delete files..."
      rm -f "$dir"/$pattern 2>/dev/null || echo "No files to delete"
      ;;
      
    windows)
      echo "Using native Windows approach to delete files..."
      # Try PowerShell first
      if command -v powershell.exe >/dev/null 2>&1; then
        echo "Attempting PowerShell deletion..."
        win_dir=$(echo "$dir" | sed 's|/|\\|g')
        powershell.exe -Command "Remove-Item -Path \"$dir\\$pattern\" -Force -ErrorAction SilentlyContinue" || echo "No files to delete"
      else
        # Fall back to cmd.exe
        echo "Falling back to cmd.exe deletion..."
        win_dir=$(echo "$dir" | sed 's|/|\\|g')
        win_pattern=$(echo "$pattern" | sed 's|\.|\\\.|g')
        cmd.exe /c "del /q \"${win_dir}\\${win_pattern}\" 2>nul" || echo "No files to delete"
      fi
      ;;
      
    unix)
      echo "Using Unix approach to delete files..."
      find "$dir" -type f -name "$pattern" -exec rm -v {} \; 2>/dev/null || echo "No files to delete"
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