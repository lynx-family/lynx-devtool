#!/bin/bash

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit

current_dir="$(pwd)"

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

resolve() {
  echo "${current_dir}/$1"
}

depot_tools_path="$(resolve "buildtools/depot_tools")"

# 添加 fetch_ninja 函数
fetch_ninja() {
    local third_party_path="$(resolve "third_party")"
    local ninja_path="${third_party_path}/ninja"
    
    if [ ! -d "$ninja_path" ]; then
        echo "Downloading ninja..."
        mkdir -p "$ninja_path"
        
        case "${OS_TYPE}" in
            "darwin")
                case "${ARCH}" in
                    "arm64")
                        NINJA_PACKAGE="fuchsia/third_party/ninja/mac-arm64"
                        ;;
                    "x86_64")
                        NINJA_PACKAGE="fuchsia/third_party/ninja/mac-amd64"
                        ;;
                esac
                ;;
            "linux")
                case "${ARCH}" in
                    "x86_64")
                        NINJA_PACKAGE="fuchsia/third_party/ninja/linux-amd64"
                        ;;
                    "arm64")
                        NINJA_PACKAGE="fuchsia/third_party/ninja/linux-arm64"
                        ;;
                esac
                ;;
            "windows_nt")
                NINJA_PACKAGE="fuchsia/third_party/ninja/windows-amd64"
                ;;
            *)
                echo "Unsupported operating system: ${OS_TYPE}"
                exit 1
                ;;
        esac
        
        echo "Using ninja package: ${NINJA_PACKAGE}"
        cipd ensure -root "$ninja_path" -ensure-file - <<EOF
${NINJA_PACKAGE} latest
EOF
        echo "ninja downloaded successfully to: $ninja_path"
    else
        echo "ninja already exists at: $ninja_path"
    fi
}

# depot_tools 安装
if [ ! -d "$depot_tools_path" ]; then
  echo "Downloading depot_tools..."
  git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git "$depot_tools_path" --depth=1
  echo "depot_tools downloaded successfully to: $depot_tools_path"
else
  echo "depot_tools already exists at: $depot_tools_path"
fi

export PATH="$depot_tools_path:$PATH"

# 添加 ninja 安装
fetch_ninja
