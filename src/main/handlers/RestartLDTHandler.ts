// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import ldt from '@/main/App';
import BaseHandler from '@/main/base/BaseHandler';
import ldtServer from '@/main/utils/server';

class RestartLDTHandler extends BaseHandler {
  getName(): string {
    return 'restart-ldt-platform';
  }
  async handle(_: any): Promise<any> {
    const ldtUrl = await ldtServer.start({ forceNew: true });
    ldt.start({ ldtUrl, forceRefresh: true, schema: undefined });
  }
}

export default RestartLDTHandler;
