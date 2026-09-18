// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { definePlugin } from '@lynx-js/devtool-plugin-core/renderer';
import { RendererContext } from '@lynx-js/devtool-plugin-core/renderer';
import React from 'react';
import { AsyncBridgeType } from '../bridge';
import CodexAgent from './CodexAgent';

export default definePlugin<AsyncBridgeType>((context: RendererContext<AsyncBridgeType>) => {
  const Index: React.FC = () => <CodexAgent context={context} />;
  return Index;
});
