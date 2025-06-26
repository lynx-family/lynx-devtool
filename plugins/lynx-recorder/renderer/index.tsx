// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { definePlugin } from '@lynx-js/devtool-plugin-core/renderer';
import { LynxRecorderBridgeType } from '../bridge';
import globalContext from './utils/globalContext';
import LynxRecorder from './LynxRecorder';
import React from 'react';

export default definePlugin<LynxRecorderBridgeType>((context) => {
  globalContext.context = context;

  const Index: React.FC = () => {
    return <LynxRecorder />;
  };

  return Index;
});
