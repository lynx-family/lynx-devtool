// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { StatisticsCustomEventData } from '@lynx-js/lynx-devtool-utils';
import { queryService } from './query';

export interface IStatistics {
  init(data: { bid: string; release: string }): void;
  contextSet(key: string, value: string): void;
  contextMerge(data: any): void;
  start(): void;
  sendEvent(data: {
    name: string;
    categories: Record<string, any>;
    metrics: Record<string, any>;
  }): void;
}

export const STATISTICS_EVENT_NAME = {
  SIMULATOR: 'simulator',
  PLUGIN: 'plugin'
};

class StatisticsManager {
  private static instance: IStatistics;

  static setInstance(statistics: IStatistics) {
    StatisticsManager.instance = statistics;
  }

  public static getInstance(): IStatistics {
    if (!StatisticsManager.instance) {
      console.info('Statistics instance not initialized');
    }
    return StatisticsManager.instance;
  }
}

// Keep the original public interface.
export function mergeContext(data: any) {
  StatisticsManager.getInstance()?.contextMerge(data);
}

export async function initStatistics() {
  const instance = StatisticsManager.getInstance();
  instance?.init({
    bid: 'lynx_devtool',
    release: queryService.getQuery('ldt_version') ?? ''
  });
  
  instance?.contextSet('type', queryService.getQuery('type') ?? '');
  instance?.contextSet('page_mode', queryService.getQuery('pageMode') ?? '');
  instance?.contextSet('view_mode', queryService.getQuery('viewMode') ?? '');

  instance?.start();
}

export function sendStatisticsEvent(data: StatisticsCustomEventData) {
  const { name, categories, metrics } = data;
  if (process.env.NODE_ENV === 'development') {
    console.log('[Statistics]: ', name, categories, metrics);
  }
  
  StatisticsManager.getInstance()?.sendEvent({
    name,
    categories: categories ?? {},
    metrics: metrics ?? {}
  });
}

export const setStatisticsInstance = StatisticsManager.setInstance;
