#!/bin/bash

# Convert paths to use forward slashes for Windows compatibility
a_path="packages/devtools-frontend-lynx/output"
b_path="packages/lynx-devtool-cli/resources"

# Check if we're running on Windows
is_windows=false
if [[ "$(uname -s)" == *"MINGW"* ]] || [[ "$(uname -s)" == *"MSYS"* ]] || [[ "$(uname -s)" == *"CYGWIN"* ]]; then
  is_windows=true
  echo "Detected Windows environment"
fi

# For Windows, try different approaches to find the latest file
if [[ "$is_windows" == "true" ]]; then
  # First attempt: Use dir command with Windows-style paths
  echo "Looking for files in ${a_path} (Windows mode)..."
  
  # Normalize paths for Windows
  win_a_path="${a_path//\//\\}"
  
  # Check if the directory exists first
  if [[ ! -d "$a_path" ]]; then
    echo "ERROR: Directory $a_path does not exist!"
    exit 1
  fi
  
  # List files in the directory to debug
  echo "Files in output directory:"
  ls -la "$a_path"
  
  # Use a direct approach for Windows
  latest_file=$(find "$a_path" -type f -name "devtool.frontend.lynx_1.0.*.tar.gz" | sort | tail -n 1)
  
  # If still not found, try by listing directory content and grep
  if [[ -z "$latest_file" ]]; then
    echo "Trying alternative method to find the file..."
    cd "$a_path" || exit 1
    latest_filename=$(ls -t devtool.frontend.lynx_1.0.*.tar.gz 2>/dev/null | head -n 1)
    cd - >/dev/null || exit 1
    
    if [[ -n "$latest_filename" ]]; then
      latest_file="${a_path}/${latest_filename}"
    fi
  fi
else
  # Original approach for Unix systems
  latest_file=$(find "$a_path" -type f -name "devtool.frontend.lynx_1.0.*.tar.gz" | sort -V | tail -n 1)
fi

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
if [[ "$is_windows" == "true" ]]; then
  # For Windows, use a more direct approach
  rm -vf "$b_path"/devtool.frontend.lynx_1.0.*.tar.gz 2>/dev/null || echo "No old files to delete"
else
  # Original approach for Unix systems
  find "$b_path" -type f -name "devtool.frontend.lynx_1.0.*.tar.gz" -exec rm -v {} \; 2>/dev/null || echo "No old files to delete"
fi

echo "cp the latest dist..."
cp -v "$latest_file" "$b_path/"

echo "Sync devtools output successfully!"
