// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { RendererContext } from '@lynx-js/devtool-plugin-core/renderer';
import { LynxRecorderBridgeType } from '../../bridge';

class GlobalContext {
  context: RendererContext<LynxRecorderBridgeType>;

  get debugDriver() {
    return this.context.debugDriver;
  }

  get useConnection() {
    return this.context.useConnection;
  }

  get logger() {
    return this.context.logger;
  }

  get asyncBridge() {
    return this.context.asyncBridge;
  }
}
const globalContext = new GlobalContext();
export default globalContext;
