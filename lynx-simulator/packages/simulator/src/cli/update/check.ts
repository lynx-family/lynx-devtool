import { readUpdateRegistryState, writeUpdateRegistryState } from './state';

export const UPDATE_CHECK_TIMEOUT_MS = 5_000;

interface RefreshUpdateCheckOptions {
  stateDirectory?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  packageName: string;
  registry: string;
}

export async function refreshUpdateCheck(options: RefreshUpdateCheckOptions): Promise<void> {
  const stateDirectory = options.stateDirectory;
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? fetch;
  const previous = readUpdateRegistryState(stateDirectory);
  const checkedAtMs = now();
  let latestVersion = previous?.latestVersion;

  try {
    // npm-compatible registries expose the version selected by a dist-tag at
    // <package>/latest. Use the package's configured publish registry, not a
    // hard-coded public endpoint.
    const response = await fetchImpl(getLatestVersionUrl(options.registry, options.packageName), {
      signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS),
    });
    if (response.ok) {
      const payload: unknown = await response.json();
      if (hasLatestVersionPayloadShape(payload)) {
        latestVersion = payload.version;
      }
    }
  } catch {
    // The worker is intentionally silent. A failed attempt is still cached so
    // offline users do not start a new worker for every CLI invocation.
  }

  await writeUpdateRegistryState({ lastCheckedAtMs: checkedAtMs, latestVersion }, stateDirectory);
}

function getLatestVersionUrl(registry: string, packageName: string): URL {
  const base = registry.endsWith('/') ? registry : `${registry}/`;
  return new URL(`${encodeURIComponent(packageName)}/latest`, base);
}

function hasLatestVersionPayloadShape(value: unknown): value is { version: string } {
  // The registry response is untrusted JSON, so validate only the field used
  // by this updater before persisting it.
  return isObjectRecord(value) && typeof value.version === 'string';
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
