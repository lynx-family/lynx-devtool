# Lynx DevTool

An Electron-based developer tool for Lynx, providing mobile debugging features.

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
git clone git@github.com:lynx-dev/lynx-devtool.git
cd devtool
```

2. Sync DevTools dependencies and build it:

```bash
pnpm run build:devtools-frontend-lynx
```

3. Install project dependencies:

```bash
pnpm install
```

4. Start development environment:

```bash
pnpm run dev
```

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
