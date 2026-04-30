#!/bin/bash

# 更健壮的操作系统检测
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            echo "darwin"
            ;;
        Linux*)
            echo "linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "windows_nt"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# 更健壮的架构检测
detect_arch() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64|amd64)
            echo "x86_64"
            ;;
        aarch64|arm64)
            echo "arm64"
            ;;
        *)
            echo "$arch"
            ;;
    esac
}

OS_TYPE=$(detect_os)
ARCH=$(detect_arch)

echo "Detected OS: ${OS_TYPE}"
echo "Detected architecture: ${ARCH}"

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit

current_dir="$(pwd)"

mkdir -p buildtools/${OS_TYPE}/gn

resolve() {
  echo "${current_dir}/$1"
}

source "$(dirname "${BASH_SOURCE[0]}")/fetch-depot-tools.sh"

static_path="$(resolve "static")"

if [ ! -f "buildtools/${OS_TYPE}/gn/gn" ]; then
  echo "Downloading gn tool..."
  rm -rf buildtools/${OS_TYPE}/gn
  mkdir -p buildtools/${OS_TYPE}/gn
  
  case "${OS_TYPE}" in
    "darwin")
      case "${ARCH}" in
        "arm64")
          GN_PACKAGE="gn/gn/mac-arm64"
          ;;
        "x86_64")
          GN_PACKAGE="gn/gn/mac-amd64"
          ;;
        *)
          echo "Unsupported Mac architecture: ${ARCH}"
          exit 1
          ;;
      esac
      ;;
    "linux")
      case "${ARCH}" in
        "x86_64")
          GN_PACKAGE="gn/gn/linux-amd64"
          ;;
        "aarch64")
          GN_PACKAGE="gn/gn/linux-arm64"
          ;;
        *)
          echo "Unsupported Linux architecture: ${ARCH}"
          exit 1
          ;;
      esac
      ;;
    "windows_nt")
      case "${ARCH}" in
        "x86_64")
          GN_PACKAGE="gn/gn/windows-amd64"
          ;;
        *)
          echo "Unsupported Windows architecture: ${ARCH}"
          exit 1
          ;;
      esac
      ;;
    *)
      echo "Unsupported operating system: ${OS_TYPE}"
      exit 1
      ;;
  esac
  
  echo "Detected system: ${OS_TYPE}, architecture: ${ARCH}"
  echo "Using package: ${GN_PACKAGE}"
  
  cipd ensure -root buildtools/${OS_TYPE}/gn -ensure-file - <<EOF
${GN_PACKAGE} latest
EOF
fi

buildDevtool() {
  mode=${1:-release}
  echo -e "\nPreparing build mode: $mode"

  if [ "${OS_TYPE}" = "windows_nt" ]; then
    chmod +x buildtools/${OS_TYPE}/gn/gn.exe
    eval "buildtools/${OS_TYPE}/gn/gn.exe gen out/Default --args='is_official_build=$([ "$mode" == "release" ] && echo true || echo false) is_debug=$([ "$mode" == "debug" ] && echo true || echo false)'"
  else
    chmod +x buildtools/${OS_TYPE}/gn/gn
    eval "buildtools/${OS_TYPE}/gn/gn gen out/Default --args='is_official_build=$([ "$mode" == "release" ] && echo true || echo false) is_debug=$([ "$mode" == "debug" ] && echo true || echo false)'"
  fi
  
  echo -e "\nBuilding..."
  autoninja -C out/Default
}

copyStaticFilesToDir() {
  dirPath="out/Default/gen/front_end"
  mkdir -p "$dirPath/plugin" "$dirPath/trace"
  
  if [ -d "$static_path" ]; then
    cp -r "$static_path/plugin" "$dirPath/"
    cp -r "$static_path/trace" "$dirPath/"
    cp "$static_path/apexcharts.js" "$dirPath/"
    cp "$static_path/base64js.min.js" "$dirPath/"
    cp "$static_path/inflate.min.js" "$dirPath/"
    cp "$static_path/compare-versions.js" "$dirPath/"
  fi

  pwd

  rm -rf output
  mkdir -p output
  timestamp=$(date +%s)
  
  mkdir -p output/front_end_"$timestamp"
  cp -r out/Default/gen/front_end/* output/front_end_"$timestamp"/
  mkdir -p output/front_end_"$timestamp"/Images
  find front_end/Images/src -maxdepth 1 -type f | while read -r image_path; do
    image_name="$(basename "$image_path")"
    if [ ! -f "output/front_end_${timestamp}/Images/${image_name}" ]; then
      cp "$image_path" "output/front_end_${timestamp}/Images/${image_name}"
    fi
  done
  node ../../scripts/transpile-devtools-css.js "$(pwd)/output/front_end_${timestamp}"
  
  cp out/Default/gen/front_end/inspector.html output/inspector.html
  
  if [ "${OS_TYPE}" = "darwin" ]; then
    sed -i '' -e "s|\.\/|./front_end_${timestamp}/|g" output/inspector.html
  else
    sed -i -e "s|\.\/|./front_end_${timestamp}/|g" output/inspector.html
  fi

  node ../../scripts/patch-devtools-runtime-compat.js \
    "$(pwd)/output/front_end_${timestamp}"

  cd output || exit
  
  if [ -d "front_end_${timestamp}" ] && [ -f "inspector.html" ]; then
    tar -czf "devtool.frontend.lynx_1.0.${timestamp}.tar.gz" inspector.html "front_end_${timestamp}"
  else
    echo "Error: Required files not found for packaging"
    exit 1
  fi
}

main() {
  buildDevtool "$1"
  
  copyStaticFilesToDir
}

main "$1"
