import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulatorErrorCodes } from '../errors';
import { createSimulatorError } from '../errors/error';
import { getErrorMessage } from '../errors/utils';

export type LoadTarget = { kind: 'url'; url: string } | { kind: 'file'; path: string };

export function resolveLoadTarget(target: string, cwd = process.cwd()): LoadTarget {
  const url = parseTargetURL(target);

  if (url?.protocol === 'http:' || url?.protocol === 'https:') {
    return { kind: 'url', url: url.href };
  }

  // Lynx Recorder replay URLs (sslocal://arkview?url=...) are passed to the
  // Lynxtron host unchanged. The host replays them when it is built with Lynx
  // Recorder replay support.
  if (url?.protocol === 'sslocal:' && url.hostname === 'arkview') {
    return { kind: 'url', url: target };
  }

  if (url?.protocol === 'file:') {
    try {
      return { kind: 'file', path: fileURLToPath(url) };
    } catch (error) {
      throw createInvalidTargetError(`Invalid file URL target: ${target}`, target, error);
    }
  }

  if (url) {
    throw createInvalidTargetError(`Unsupported target protocol: ${url.protocol}`, target);
  }

  const filePath = path.resolve(cwd, target);
  return { kind: 'file', path: filePath };
}

function parseTargetURL(value: string): URL | undefined {
  if (isWindowsDrivePath(value)) {
    return undefined;
  }

  try {
    return new URL(value);
  } catch (error) {
    if (looksLikeURL(value)) {
      throw createInvalidTargetError(`Invalid URL target: ${value}`, value, error);
    }
    return undefined;
  }
}

function createInvalidTargetError(message: string, target: string, cause?: unknown) {
  const causeMessage = getErrorMessage(cause);
  return createSimulatorError({
    module: 'runtime',
    code: SimulatorErrorCodes.RuntimeInvalidTarget,
    message: causeMessage ? `${message}: ${causeMessage}` : message,
    details: causeMessage ? { target, causeMessage } : { target },
    cause,
  });
}

function looksLikeURL(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function isWindowsDrivePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value);
}
