// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import ldt from '@/main/App';
import BaseHandler from '@/main/base/BaseHandler';
import ldtConfig from '@/main/utils/config';

class RestartLDTHandler extends BaseHandler {
  getName(): string {
    return 'simulator-view-mode';
  }
  handle(params?: any): Promise<any> {
    const { action, mode } = params;
    if (action === 'set') {
      ldt.switchViewMode(mode);
      return Promise.resolve();
    } else if (action === 'get') {
      return Promise.resolve(ldtConfig.getConfig('simulatorViewMode', 'lynx'));
    }
    return Promise.reject(new Error(`Invalid action: ${action}`));
  }
}

export default RestartLDTHandler;
