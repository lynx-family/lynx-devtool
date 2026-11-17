// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export default async ({ target }) => {
  // The factory runs for each opened page. Keep state here to isolate pages.
  let calls = 0;

  return {
    // target is the page URL or path passed to open. These functions can await
    // data from a file or API before returning their objects.
    templateData: async () => ({ title: '测试页面', target }),
    globalProps: async () => ({ theme: 'light' }),
    jsb: async (name, params, { window, next }) => {
      // window identifies the page making this bridge call.
      if (name === 'example.echo') {
        return { params, windowId: window.id, calls: ++calls };
      }
      if (name === 'example.pageInfo') {
        return { target, windowId: window.id };
      }

      // Delegate other methods to the simulator's normal handlers.
      return next();
    },
  };
};
