// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A self-contained 1x1 PNG; replace this with readFile(...) for your own image.
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

export default () => ({
  fetchResource: async ({ url, nativeWindowId }, { window, next }) => {
    if (url !== 'https://example.com/cover.png') return next();
    console.log('Mock image', { nativeWindowId, simulatorWindowId: window.id, url });
    return image;
  },
});
