// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface IGlobalPropsManager {
  readGlobalPropsImpl: (needParse: boolean) => Record<string, any> | string;
  updateGlobalPropsImpl: (globalProps: string | Record<string, any>) => void;
}
