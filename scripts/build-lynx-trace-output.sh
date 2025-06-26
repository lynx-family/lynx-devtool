#!/usr/bin/env bash

git submodule init
git submodule update --remote

cd packages/lynx-trace

rm -rf output

# install deps
export PUPPETEER_SKIP_DOWNLOAD=1
echo "Installing build dependencies, please wait. The first installation may take 5~10 minutes..."
sed -i.bak "s/'--frozen-lockfile'/'--no-frozen-lockfile', '-f'/g" tools/install-build-deps
sed -i.bak "s/'--shamefully-hoist',//g" tools/install-build-deps
sed -i.bak "/AppImpl\.instance\.embeddedMode/{
  /|| true/!s/AppImpl\.instance\.embeddedMode/AppImpl.instance.embeddedMode || true/g
}" ui/src/frontend/ui_main.ts
sed -i.bak 's/this.showCookieConsent = true;/this.showCookieConsent = false;/g' ui/src/core/cookie_consent.ts
sed -i.bak '/\/\/gn\/standalone:check_build_deps/d' gn/BUILD.gn
find ui/src -name "*.bak" -delete
tools/install-build-deps --no-dev-tools --ui 2> /dev/null
echo "Install build dependencies successfully!"

cd ui
npm install --force
cd ..
# build 
ui/build --no-depscheck --minify-js all

# move dist to output
mv out/ui/ui/dist output

cd output

tar -czf lynx-trace.tar.gz --exclude=lynx-trace.tar.gz .

cd ../../../

a_path="packages/lynx-trace/output"
b_path="packages/lynx-devtool-cli/resources"

latest_file=$(find "$a_path" -type f -name "lynx-trace.tar.gz")

if [[ -z "$latest_file" ]]; then
  echo "Error: lynx-trace.tar.gz not found."
  exit 1
fi

echo "cp the lynx-trace dist..."
cp -v "$latest_file" "$b_path/"

echo "Build lynx-trace output successfully!"