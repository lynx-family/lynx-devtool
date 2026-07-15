// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Processed plugin metadata for rendering
export type ProcessedPluginMeta = {
  id: string;
  name: string;
  description: string;
  isInternal?: boolean;
  path?: string;
  version?: string;
  disable?: boolean;
  valid?: boolean;
  groupId?: string;
  groupName?: string;
  platformPlugin?: {
    entry: string;
    iframeSrc?: string;
    assets?: string[];
    location?: string;
    type?: string;
    isValid?: boolean;
  };
};

export type ProcessedPluginGroupMeta = {
  id: string;
  name: string;
  description: string;
  isInternal?: boolean;
  groupPlugins: ProcessedPluginMeta[];
};
