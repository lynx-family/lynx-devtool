// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { simulatorDistribution } from '../../shared/distribution';
import { METRICS_UPLOAD_URL_ENV } from './types';

// Returns the telemetry endpoint, or undefined when this distribution has no
// telemetry service and no override is set. The env var stays as the
// test/staging escape hatch.
export function getMetricsUploadUrl(): string | undefined {
  return process.env[METRICS_UPLOAD_URL_ENV]?.trim() || simulatorDistribution.metricsUploadUrl;
}
