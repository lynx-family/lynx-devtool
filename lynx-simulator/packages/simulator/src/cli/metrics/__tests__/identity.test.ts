import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { getCliMetricIdentity } from '../identity';

let metricsDirectory: string;
let readGitConfig: ReturnType<typeof vi.fn<(key: string) => string | undefined>>;

beforeEach(() => {
  metricsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-simulator-metrics-'));
  readGitConfig = vi.fn();
});

afterEach(() => {
  fs.rmSync(metricsDirectory, { recursive: true, force: true });
});

test('uses normalized git email as the preferred UV identity', () => {
  mockGitConfig(0, 'User@Example.COM\n');

  expect(getCliMetricIdentity(metricsDirectory, { readGitConfig })).toEqual({
    uvId: 'user@example.com',
    source: 'git-email',
  });
  expect(readGitConfig).toHaveBeenCalledWith('user.email');
});

test('falls back to a stable local install id when git email is unavailable', () => {
  mockGitConfig(1, '');

  const firstIdentity = getCliMetricIdentity(metricsDirectory, { readGitConfig });
  const secondIdentity = getCliMetricIdentity(metricsDirectory, { readGitConfig });

  expect(firstIdentity.source).toBe('install-id');
  expect(firstIdentity.uvId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
  expect(secondIdentity).toEqual(firstIdentity);
  expect(fs.readFileSync(path.join(metricsDirectory, 'install-id'), 'utf8').trim()).toBe(
    firstIdentity.uvId
  );
});

test('does not use git name or OS username as fallback UV sources', () => {
  mockGitConfig(1, '');

  getCliMetricIdentity(metricsDirectory, { readGitConfig });

  expect(readGitConfig).toHaveBeenCalledTimes(1);
  expect(readGitConfig).toHaveBeenCalledWith('user.email');
});

function mockGitConfig(status: number, stdout: string): void {
  readGitConfig.mockReturnValue(status === 0 ? stdout.trim() : undefined);
}
