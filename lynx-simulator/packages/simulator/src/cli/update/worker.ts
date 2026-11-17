import packageJson from '../../../package.json';

import { refreshUpdateCheck } from './check';

// This process intentionally has no CLI output, metrics, or command parsing.
const registry = packageJson.publishConfig?.registry ?? 'https://registry.npmjs.org/';

try {
  await refreshUpdateCheck({
    packageName: packageJson.name,
    registry,
  });
} catch {
  // The detached worker is best effort and must remain silent on state I/O failures.
}
