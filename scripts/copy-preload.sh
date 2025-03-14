#!/bin/sh

# Define the source and destination files
src="preload.js"
dest="dist/preload.js"

# Create the destination directory if it doesn't exist
mkdir -p "$(dirname "$dest")"

# Copy the file
cp "$src" "$dest"

echo "preload.js copied successfully."