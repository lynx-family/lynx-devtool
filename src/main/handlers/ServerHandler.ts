// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import BaseHandler from '@/main/base/BaseHandler';
import ldtServer from '@/main/utils/server';

class ServerHandler extends BaseHandler {
  getName(): string {
    return 'ldt-server';
  }
  handle(params: any): Promise<any> {
    const { action } = params;
    if (action === 'host') {
      return Promise.resolve(ldtServer.getHost());
    }
    return Promise.reject(new Error(`Invalid action: ${action}`));
  }
}

export default ServerHandler;
