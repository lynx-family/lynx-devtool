// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useEffect, useRef } from 'react';
import { sendStatisticsEvent, STATISTICS_EVENT_NAME } from '../utils/statisticsUtils';

export const useUsageTracker = (getTrackingKey: () => string | undefined, usageType: string) => {
  const lastTrackingKey = useRef<string | undefined>(getTrackingKey());
  const accumulatedTime = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Report function
  const reportUsage = () => {
    if (accumulatedTime.current > 0 && lastTrackingKey.current && !document.hidden) {
      sendStatisticsEvent({
        name: usageType,
        categories: {
          action: 'duration',
          scene: lastTrackingKey.current
        },
        metrics: {
          duration: accumulatedTime.current
        }
      });
      accumulatedTime.current = 0;
    }
  };

  useEffect(() => {
    const currentKey = getTrackingKey();
    if (!currentKey) {
      reportUsage();
      lastTrackingKey.current = undefined;
      accumulatedTime.current = 0;
      return;
    }

    if (currentKey !== lastTrackingKey.current) {
      reportUsage(); // Immediately report previous usage duration
      lastTrackingKey.current = currentKey;
      accumulatedTime.current = 0;
    }
  }, [getTrackingKey]);

  // Handle timed statistics
  useEffect(() => {
    if (!getTrackingKey()) {
      return;
    }

    const updateUsage = () => {
      if (document.hidden) {
        return; // Don't accumulate time when page is not visible
      }
      accumulatedTime.current += 10; // Accumulate every 10 seconds
      if (accumulatedTime.current >= 60) {
        reportUsage();
        accumulatedTime.current = 0;
      }
    };

    intervalRef.current = setInterval(updateUsage, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      reportUsage(); // Ensure unreported time is recorded when component unmounts
    };
  }, [getTrackingKey]);

  // visibility change listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && getTrackingKey()) {
        accumulatedTime.current = 0;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [getTrackingKey]);
};

export const usePluginUsageTracker = (currentPluginId?: string) => {
  useUsageTracker(() => currentPluginId, STATISTICS_EVENT_NAME.PLUGIN);
};

export const useSimulatorUsageTracker = () => {
  useUsageTracker(() => 'simulator', STATISTICS_EVENT_NAME.SIMULATOR);
};
