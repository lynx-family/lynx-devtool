# Page Environment Guide

Page environment files provide data and JSB responses to a Lynx page. Pass a
JSON file or a local JavaScript factory module with `open --page-env`.

## Generate

Use a starter file for manually configured data and JSB mocks, or convert a
Recorder artifact to bootstrap from recorded data.

Create a starter file with empty `templateData`, `globalProps`, and `jsb.bridge`:

```sh
lynx-simulator generate page-env --output page-env.json
```

Convert a local or remote Lynx Recorder artifact:

```sh
lynx-simulator generate page-env \
  --recorder <path-or-url> \
  --output page-env.json
```

Open a page with the generated environment:

```sh
lynx-simulator open <target> --page-env page-env.json
```

The generator produces JSON. For dynamic data or custom bridge behavior, create
a JavaScript module as shown below.

## JSON format

- Use `templateData` and `globalProps` to provide the corresponding Lynx data.
- `jsb.bridge` contains mocks for calls made through `NativeModules.bridge.call`.
  - Each mock requires `name` and `result`; `params` is optional.
  - Set `delayMs` to a non-negative integer to delay the mock result by that
    number of milliseconds. If omitted, the result is returned immediately.
  - A mock with `params` matches when the actual object contains all fields in the
    mock. Extra actual object fields are allowed. Arrays must match by length and
    order, and primitive values must be equal.
  - A same-name mock without `params` is used as the fallback when no parameterized
    mock matches.
- Page environments generated from Recorder artifacts may retain other JSB
  module arrays, but the simulator currently consumes only `jsb.bridge`.

See [page-env.schema.json](./page-env.schema.json) for the complete structure and
[examples/basic.json](./examples/basic.json) for an example.

## JavaScript modules

For dynamic data or JSB replies, save this as `page-env.mjs`:

```js
export default async () => ({
  templateData: async () => ({ title: '测试页面' }),
  globalProps: async () => ({ theme: 'light' }),
  jsb: async (name, params, { next }) => {
    if (name === 'example.echo') return { params };
    return next();
  },
});
```

The complete file is also available at [examples/basic.mjs](./examples/basic.mjs).
Open a page using it:

```sh
lynx-simulator open <target> --page-env ./page-env.mjs
```

The factory, data functions, and JSB function can all be async. `templateData`
and `globalProps` can also be plain objects, and `jsb` can keep the JSON-style
`bridge` rules. A JSB function receives the method name and parameters and returns
the reply; call `next()` for methods the example does not handle.

For advanced usage, see the annotated [examples/advanced.mjs](./examples/advanced.mjs).

Use a local `.mjs` file, or an ESM `.js` file in a package with `"type": "module"`.
File URLs are also supported; HTTP(S) sources remain JSON.
