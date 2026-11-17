# Core Assets

## `devtool-settings.js`

The built-in DevTool settings page that `Runtime.openDevToolSettingsWindow()`
opens. It is a prebuilt Lynx bundle of the DevTool switch page from the Lynx
repository:
[`devtool/lynx_devtool/resources/devtool-switch`](https://github.com/lynx-family/lynx/tree/develop/devtool/lynx_devtool/resources/devtool-switch).

It was built with `@lynx-js/rspeedy` 0.18.5, `@lynx-js/react` 0.129.2 and
`@lynx-js/react-rsbuild-plugin` 0.22.2, without the QR code plugin. To rebuild
it:

1. Copy `devtool/lynx_devtool/resources/devtool-switch` out of the Lynx
   repository.
2. Set the Lynx dependencies above, install `@lynx-js/types` and `typescript`
   from npm, and remove `pluginQRCode` from `lynx.config.ts`.
3. Run `pnpm install` and `pnpm build`.
4. Copy `dist/devtoolSwitch.lynx.bundle` to this file.

Lynx bundles are encoded for a specific Lynx engine. Rebuild this page when
upgrading `@lynx-js/lynxtron` changes the engine, and check it with
`lynx-simulator devtool-settings`.
