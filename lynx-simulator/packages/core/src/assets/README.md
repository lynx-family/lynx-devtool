# Core Assets

## `devtool-settings.js`

The built-in DevTool settings page that `Runtime.openDevToolSettingsWindow()`
opens. It is a prebuilt Lynx bundle of the DevTool switch page in the Lynx
repository:
[`devtool/lynx_devtool/resources/devtool-switch`](https://github.com/lynx-family/lynx/tree/develop/devtool/lynx_devtool/resources/devtool-switch).

The current file was built unchanged from Lynx commit
[`4fc0d50`](https://github.com/lynx-family/lynx/commit/4fc0d50024c2565a53233b24e90783f5a05107d7)
with the dependencies locked in that repository. To rebuild it, in a checkout
of the Lynx repository:

1. Run `pnpm install` in the repository root.
2. Run `pnpm build` in `devtool/lynx_devtool/resources/devtool-switch`.
3. Copy `dist/devtoolSwitch.lynx.bundle` to this file.

Lynx bundles are encoded for a specific Lynx engine. After upgrading
`@lynx-js/lynxtron`, check the page with `lynx-simulator devtool-settings`.
