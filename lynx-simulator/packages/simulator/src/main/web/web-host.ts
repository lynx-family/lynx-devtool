// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '@lynx-js/web-core';
import '@lynx-js/web-core/index.css';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';
import { setupSymmetricHost } from '@lynx-js/lynxtron/web-host';

const bundleUrl = './main.web.bundle';
const nodejsAdapterUrl = './nodejs-adapter-web.js';

document.body.innerHTML = `
<lynx-view 
  id="root-view" 
  style="height:100vh; width:100vw;" 
  url="${bundleUrl}">
</lynx-view>`;

const lynxView = document.getElementById('root-view') as any;

setupSymmetricHost(lynxView, {
  bridge: {
    call: (method: string, params: any) => {
      if (method === 'showDialog') {
        alert(params.message);
        return {}; // Return value to trigger callback in Worker
      }
    },
  },
  nodejs: {
    scriptURL: nodejsAdapterUrl,
  },
});
