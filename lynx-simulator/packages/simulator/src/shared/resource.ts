// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

export async function readResourceBuffer(source: string, cwd: string): Promise<Buffer> {
  const url = parseURL(source);
  if (url?.protocol === 'http:' || url?.protocol === 'https:') {
    return fetchURLBuffer(source);
  }

  const filePath = url?.protocol === 'file:' ? fileURLToPath(url) : path.resolve(cwd, source);
  return fs.readFileSync(filePath);
}

function parseURL(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

async function fetchURLBuffer(url: string): Promise<Buffer> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to download ${url}: ${message}`);
  }
}
