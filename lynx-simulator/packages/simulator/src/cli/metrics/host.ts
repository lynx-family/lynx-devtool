import type { CliMetricHostInfo } from './types';

export function getCliMetricHostInfo(): CliMetricHostInfo {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    ci: isCi(),
  };
}

function isCi(): boolean {
  const value = process.env.CI?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}
