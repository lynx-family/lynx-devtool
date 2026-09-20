// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable rulesdir/no_underscored_properties */

import * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';
import * as TextUtils from '../../models/text_utils/text_utils.js';

import type {ConsoleViewMessage} from './ConsoleViewMessage.js';

export type LevelsMask = {
  [x: string]: boolean,
};

export class ConsoleFilter {
  name: string;
  parsedFilters: TextUtils.TextUtils.ParsedFilter[];
  executionContext: SDK.RuntimeModel.ExecutionContext|null;
  levelsMask: LevelsMask;
  tagsMask: Protocol.Log.LogEntryTag[];

  constructor(
      name: string, parsedFilters: TextUtils.TextUtils.ParsedFilter[],
      executionContext: SDK.RuntimeModel.ExecutionContext|null, levelsMask?: LevelsMask,
      tagsMask?: Protocol.Log.LogEntryTag[]) {
    this.name = name;
    this.parsedFilters = parsedFilters;
    this.executionContext = executionContext;
    this.levelsMask = levelsMask || ConsoleFilter.defaultLevelsFilterValue();
    this.tagsMask = tagsMask || ConsoleFilter.defaultTagsFilterValue();
  }

  static allLevelsFilterValue(): LevelsMask {
    const result: LevelsMask = {};
    const logLevels: Protocol.EnumerableEnum<typeof Protocol.Log.LogEntryLevel> = {
      Verbose: Protocol.Log.LogEntryLevel.Verbose,
      Info: Protocol.Log.LogEntryLevel.Info,
      Warning: Protocol.Log.LogEntryLevel.Warning,
      Error: Protocol.Log.LogEntryLevel.Error,
    };
    for (const name of Object.values(logLevels)) {
      result[name] = true;
    }
    return result;
  }

  static defaultLevelsFilterValue(): LevelsMask {
    const result = ConsoleFilter.allLevelsFilterValue();
    result[Protocol.Log.LogEntryLevel.Verbose] = false;
    return result;
  }

  static singleLevelMask(level: string): LevelsMask {
    const result: LevelsMask = {};
    result[level] = true;
    return result;
  }

  static defaultTagsFilterValue(): Protocol.Log.LogEntryTag[] {
    // OtherApps is included in the default so that console.log() calls from
    // app JS code are visible out-of-the-box.
    //
    // Background: in Lynx's shared-context model multiple LynxViews share a
    // single JS inspector connection.  The C++ layer tags each
    // Runtime.consoleAPICalled message with:
    //   consoleId  = the viewId extracted from the script's URL
    //               (file://view<N>/...)
    //   viewId     = the instance_id of the debugger that delivered the event
    // When consoleId !== viewId (common in multi-view and shared-context
    // scenarios) the message is tagged OtherApps.  Excluding OtherApps from
    // the default therefore silently drops most real app console.log output.
    // Users who want to narrow output to a single app can select one of the
    // "Current App" filter options in the console toolbar.
    return [
      Protocol.Log.LogEntryTag.AppJS,
      Protocol.Log.LogEntryTag.LynxCore,
      Protocol.Log.LogEntryTag.AppLepus,
      Protocol.Log.LogEntryTag.OtherApps,
    ];
  }

  clone(): ConsoleFilter {
    const parsedFilters = this.parsedFilters.map(TextUtils.TextUtils.FilterParser.cloneFilter);
    const levelsMask = Object.assign({}, this.levelsMask);
    const tagsMask = [...this.tagsMask];
    return new ConsoleFilter(this.name, parsedFilters, this.executionContext, levelsMask, tagsMask);
  }

  shouldBeVisible(viewMessage: ConsoleViewMessage): boolean {
    const message = viewMessage.consoleMessage();
    if (this.executionContext &&
        (this.executionContext.runtimeModel !== message.runtimeModel() ||
         this.executionContext.id !== message.getExecutionContextId())) {
      return false;
    }

    if (message.type === SDK.ConsoleModel.FrontendMessageType.Command ||
        message.type === SDK.ConsoleModel.FrontendMessageType.Result || message.isGroupMessage()) {
      return true;
    }
    if (message.level && !this.levelsMask[message.level as string]) {
      return false;
    }
    if (!this.tagsMask.includes(message.tag)) {
      return false;
    }

    for (const filter of this.parsedFilters) {
      if (!filter.key) {
        if (filter.regex && viewMessage.matchesFilterRegex(filter.regex) === filter.negative) {
          return false;
        }
        if (filter.text && viewMessage.matchesFilterText(filter.text) === filter.negative) {
          return false;
        }
      } else {
        switch (filter.key) {
          case FilterType.Context: {
            if (!passesFilter(filter, message.context, false /* exactMatch */)) {
              return false;
            }
            break;
          }
          case FilterType.Source: {
            const sourceNameForMessage = message.source ?
                SDK.ConsoleModel.MessageSourceDisplayName.get((message.source as SDK.ConsoleModel.MessageSource)) :
                message.source;
            if (!passesFilter(filter, sourceNameForMessage, true /* exactMatch */)) {
              return false;
            }
            break;
          }
          case FilterType.Url: {
            if (!passesFilter(filter, message.url, false /* exactMatch */)) {
              return false;
            }
            break;
          }
        }
      }
    }
    return true;

    function passesFilter(
        filter: TextUtils.TextUtils.ParsedFilter, value: string|null|undefined, exactMatch: boolean): boolean {
      if (!filter.text) {
        return Boolean(value) === filter.negative;
      }
      if (!value) {
        return !filter.text === !filter.negative;
      }
      const filterText = (filter.text as string).toLowerCase();
      const lowerCaseValue = value.toLowerCase();
      if (exactMatch && (lowerCaseValue === filterText) === filter.negative) {
        return false;
      }
      if (!exactMatch && lowerCaseValue.includes(filterText) === filter.negative) {
        return false;
      }
      return true;
    }
  }
}

// TODO(crbug.com/1167717): Make this a const enum again
// eslint-disable-next-line rulesdir/const_enum
export enum FilterType {
  Context = 'context',
  Source = 'source',
  Url = 'url',
}
