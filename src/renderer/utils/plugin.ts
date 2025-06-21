// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ProcessedPluginGroupMeta, ProcessedPluginMeta } from '@/types/plugin-manager';

export const sortToolsByPriority = (tools) => {
  return tools.sort((a, b) => {
    if (a.priority === undefined && b.priority === undefined) {
      return 0;
    }
    if (a.priority === undefined) {
      return 1;
    }
    if (b.priority === undefined) {
      return -1;
    }
    return a.priority - b.priority;
  });
};

/** combine plugins with group into a group, and aggregate them through the plugin group container */
export const organizePluginsByGroup = (plugins: ProcessedPluginMeta[]) => {
  // filter out plugins that should not be displayed
  const validPlugins = plugins.filter(({ valid }) => valid);
  const groupContainerPlugin = validPlugins.find(({ id }) => id === 'plugin-group-container')!;
  const pluginsWithGroup = validPlugins.filter(({ groupId, valid }) => groupId !== undefined && valid);
  const groupedPlugins = pluginsWithGroup.reduce((acc: Record<string, ProcessedPluginGroupMeta>, plugin) => {
    const { groupId, groupName } = plugin;
    if (!groupId) {
      return acc;
    }
    if (!acc[groupId]) {
      acc[groupId] = {
        ...groupContainerPlugin,
        groupPlugins: [],
        // replace the id and name of the shell plugin with the group plugin
        id: `group_${groupId}`,
        name: groupName ?? ''
      };
    }
    acc[groupId].groupPlugins.push(plugin);
    return acc;
  }, {});
  const pluginsWithoutGroup = validPlugins.filter(
    ({ groupId, id }) => groupId === undefined && id !== 'plugin-group-container'
  );
  return [...Object.values(groupedPlugins), ...pluginsWithoutGroup];
};
