#!/usr/bin/env bash
set -e

# devtool frontend
rm -rf dist/static
mkdir -p dist/static/devtool/lynx
tar -xf resources/devtool.frontend.lynx_*.tar.gz -C dist/static/devtool/lynx

# 404 page
mkdir -p dist/static/404
cp -r resources/404.html dist/static/404

# open shell
cp -r resources/openChrome.applescript dist/static

mkdir -p dist/static/trace
tar -xf resources/lynx-trace.tar.gz -C dist/static/trace