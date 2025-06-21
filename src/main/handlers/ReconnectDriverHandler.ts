// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import BaseHandler from '@/main/base/BaseHandler';
import ldtServer from '@/main/utils/server';
import axios from 'axios';

class ReconnectDriverHandler extends BaseHandler {
  getName(): string {
    return 'reconnect-debug-driver';
  }
  handle(_: any): Promise<any> {
    const host = ldtServer.getHost();
    if (host) {
      axios.get(`http://${host}/reconnect`);
    }
    return Promise.resolve();
  }
}

export default ReconnectDriverHandler;
