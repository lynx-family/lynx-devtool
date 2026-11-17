# @lynx-js/lynx-simulator-core

Core SDK for building Lynxtron-based Lynx simulator applications.

## Responsibilities

- Create and manage Lynx windows through `createSimulatorRuntime`.
- Open Lynx targets from local paths, file URLs, and remote URLs.
- Register native extensions before windows are opened.
- Register JSB handlers for the built-in `NativeModules.bridge.call` path.
- Optionally load page environments and compose per-page JSB mocks.
- Parse simulator commands with `createCommandParser`.
- Provide built-in device presets and formatted device output.
- Convert thrown values to a stable `SimulatorErrorInfo` shape.
- Open the built-in DevTool settings window.

## Public Entry

Import all public APIs from the package root:

```ts
import {
  createCommandParser,
  createSimulatorRuntime,
  formatDevices,
  toSimulatorErrorInfo,
} from '@lynx-js/lynx-simulator-core';
```

## Page environments

Hosts can opt into the official page-env format without depending on the
simulator application or the JSB implementation package:

```ts
import { createPageEnvironmentManager } from '@lynx-js/lynx-simulator-core';

const environments = createPageEnvironmentManager({
  runtime,
  realHandlers, // Optional fallback JSB handlers, created once by the host.
  onDispatch, // Optional observation callback; hosts retain control of logging.
});
const page = await environments.open({
  target: bundleUrl,
  pageEnvironment: './page-env.json',
  window: { windowless: true },
});
```

`pageEnvironment` accepts an object, a local path, a file URL, or an HTTP(S)
URL. Its optional fields are `templateData`, `globalProps`, and `jsb.bridge`.
Each bridge mock requires `name` and `result`, with optional `params` and
`delayMs`. Objects use partial parameter matching; arrays match by length and
order. Parameterized rules take priority over same-name fallback rules.
Matched results are cloned and may be delayed; unmatched calls use the supplied
real handlers. This covers `NativeModules.bridge.call`, rather than arbitrary
native modules.

The manager loads the environment before opening the page, injects initial data
and global props, isolates mocks by page context, and releases environment data
when the page closes or opening fails. Explicit `lynxOptions` fields override the
corresponding environment fields. Each manager binds one runtime, its fallback
handlers, and its observer at creation. Its only operations are `open(options)`
and `dispose()`. Disposal releases environment data and subscriptions; it leaves
runtime windows and JSB service lifetimes with the host and rejects subsequent
opens, including initialization still awaiting a source.

### JavaScript modules

Use a local `.mjs` file (or an ESM `.js` file) in place of JSON, with a default
exported factory. The factory and the `templateData` / `globalProps` functions
may be synchronous or asynchronous. Initial data and global props resolve
before the window opens; both functions run concurrently and must return objects.

```js
// page-env.mjs
export default async ({ target }) => {
  let count = 0; // A separate closure for each open.
  return {
    templateData: async () => ({ title: '测试页面', target }),
    globalProps: ({ windowOptions }) => ({
      theme: 'light',
      windowless: windowOptions?.windowless ?? false,
    }),
    jsb: async (name, params, { window, context, next }) => {
      if (name === 'example.echo') {
        return { params, windowId: window.id, count: ++count, caller: context?.caller };
      }
      return next();
    },
  };
};
```

Open this through `environments.open({ target, pageEnvironment:
'./page-env.mjs' })`, or `lynx-simulator open <target> --page-env ./page-env.mjs`.
The factory may also return plain object values and the existing `jsb.bridge`
array. Inline factories and definitions are accepted by the Core API.

| Context field   | Availability and meaning                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `source`        | Resolved source URL; absent for inline definitions.                                                      |
| `cwd`           | Absolute working directory used to resolve the source and target.                                        |
| `target`        | Original page target passed to `open`.                                                                   |
| `windowOptions` | Requested window options, before runtime defaults.                                                       |
| `context`       | Host data from `open.context`; JSB calls also include the manager's environment id.                      |
| `window`        | JSB calls only: current window id, target, size, status and other runtime metadata.                      |
| `next()`        | JSB calls only: delegate the original name/params to the host's `onJSBInvoke`, then registered handlers. |

Use `manager.open` to wire a functional `jsb` to the runtime's native
`-lynx-invoke` event (`NativeModules.bridge.call`), including unknown JSB names.
The function receives `(name, params, context)` and its resolved value becomes
the bridge reply; `undefined` is also a final reply. Call `next()` explicitly to
delegate. Throws and rejected promises follow the runtime's existing JSB error
handling. This does not intercept other native modules.

Each open calls the factory again; put per-page state inside that factory.
Modules and their relative imports follow Node's normal ESM cache and resolution.
JavaScript sources must be local files; HTTP(S) sources remain JSON.

## Local Development

From the `lynx-simulator` workspace root:

```bash
pnpm install
```

Build:

```bash
pnpm --filter @lynx-js/lynx-simulator-core run build
```

## Testing

- `pnpm --filter @lynx-js/lynx-simulator-core run test`: build the package
  and run tests.
- `pnpm --filter @lynx-js/lynx-simulator-core run typecheck`: run
  TypeScript checks.

See the workspace README for the commands that build every package.

## Usage Notes

This package is intended to be used from the main process of a Lynxtron
simulator application. The application provides the actual Lynxtron runtime.

If the application uses core-owned assets such as the built-in DevTool settings
page, keep `@lynx-js/lynx-simulator-core` resolvable as a runtime package
when bundling the application. For example, configure the bundler to externalize
the core package, or otherwise make sure the core package assets are copied with
the same package-relative paths.
