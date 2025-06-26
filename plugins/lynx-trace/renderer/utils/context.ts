// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { RendererContext } from "@lynx-js/devtool-plugin-core/renderer";
import { createContext } from "react";
import { AsyncBridgeType } from "../../bridge";

export const GlobalContext = createContext<RendererContext<AsyncBridgeType>>({} as any);