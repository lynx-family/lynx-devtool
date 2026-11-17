// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Runs the Rspeedy CLI that this package depends on. When this package is
// installed together with packages that ship another `rspeedy` binary, the
// shared `node_modules/.bin/rspeedy` may point at that one instead.

import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('@lynx-js/rspeedy/package.json');
const { bin } = require(packageJsonPath);
const binPath = typeof bin === 'string' ? bin : bin.rspeedy;

await import(pathToFileURL(path.join(path.dirname(packageJsonPath), binPath)).href);
