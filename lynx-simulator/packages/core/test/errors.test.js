import assert from 'node:assert/strict';
import test from 'node:test';

import { SimulatorErrorCodes, toSimulatorErrorInfo } from '../dist/index.js';

test('converts unknown errors to stable error info', () => {
  assert.deepEqual(toSimulatorErrorInfo(new Error('boom')), {
    code: SimulatorErrorCodes.UnknownError,
    message: 'boom',
  });
  assert.deepEqual(toSimulatorErrorInfo('plain failure'), {
    code: SimulatorErrorCodes.UnknownError,
    message: 'plain failure',
  });
  assert.deepEqual(toSimulatorErrorInfo({ reason: 'opaque' }), {
    code: SimulatorErrorCodes.UnknownError,
    message: '[object Object]',
  });
});
