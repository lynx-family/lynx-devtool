// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import BaseHandler from '@/main/base/BaseHandler';
import ldt from '../App';

class SwitchPageModeHandler extends BaseHandler {
  getName(): string {
    return 'switch-page-mode';
  }
  handle(params?: any): Promise<any> {
    ldt.switchPage(params.mode);
    return Promise.resolve();
  }
}

export default SwitchPageModeHandler;
