<div align="center">

<p>
  <a href="https://lynxjs.org/guide/debugging/lynx-devtool.htm">
    <img width="500" alt="Devtool logo" src=".github/splash.png" />
  </a>
</p>

![GitHub Release](https://img.shields.io/github/v/release/lynx-family/lynx-devtool)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/lynx-family/lynx-devtool/total)
[![Build and Release](https://github.com/lynx-family/lynx-devtool/actions/workflows/release.yaml/badge.svg)](https://github.com/lynx-family/lynx-devtool/actions/workflows/release.yaml)
[![Build devtools packages](https://github.com/lynx-family/lynx-devtool/actions/workflows/ci.yaml/badge.svg)](https://github.com/lynx-family/lynx-devtool/actions/workflows/ci.yaml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0.txt)

An Electron-based developer tool for Lynx, providing mobile debugging features.

</div>

## Overview

<div align="center">
    <img src="https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/doc/debugging-panel-console.png" />
</div>

## Project Structure

``` plantext
.
├── packages/ # Sub-packages
│ ├── lynx-devtool-cli/ # CLI toolkit
│ ├── lynx-devtool-utils/ # Common utilities
│ ├── lynx-devtool-web/ # Web frontend
│ └── devtools-frontend-lynx/ # Chrome DevTools frontend
├── src/ # Main Electron project
│ ├── main/ # Main process code
│ └── utils/ # Utility functions
└── preload.js # Electron preload script
```

## Prerequisites

- Node.js >= 18 (Recommended v18.20.2)
- pnpm = 7.33.6
- Git
- Python3

### Node.js Version Management

This project uses corepack to manage package manager versions. Please follow these steps to set up:

```bash
# Enable corepack
corepack enable

# Install and use specified Node.js version with nvm
nvm install 18.20.2
nvm use 18.20.2

# Verify versions
node -v  # Should display v18.20.2
pnpm -v  # Should display 7.33.6
```

## Getting Started

1. Clone repository and switch to development branch:

```bash
git clone git@github.com:lynx-family/lynx-devtool.git --depth=1
cd lynx-devtool
```

2. Install project dependencies:

```bash
pnpm install
```

3. Sync DevTools dependencies and build it:

```bash
pnpm run build:devtools-frontend-lynx
```

4. Sync Lynx Trace dependencies and build it:

```bash
pnpm run build:lynx-trace
```

5. Start development environment:

```bash
pnpm run dev
```

## Using Makefile

```bash
make setup
make build
make install
make dev
```

or just call `make all`

## Tech Stack

- Electron
- TypeScript
- React
- Chrome DevTools Protocol

## Contributing

1. Fork this repository
2. Create feature branch
3. Commit changes
4. Create Pull Request
