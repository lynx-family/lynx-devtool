// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '@testing-library/jest-dom';
import { expect, test, vi } from 'vitest';
import { render, getQueriesForElement } from '@lynx-js/react/testing-library';

vi.mock('@assets/lynx-dark-logo.svg?inline', () => ({
  default: 'lynx-dark-logo.svg',
}));
vi.mock('@assets/lynx-light-logo.svg?inline', () => ({
  default: 'lynx-light-logo.svg',
}));

import { App } from '../App.jsx';

test('App', async () => {
  render(<App />);
  expect(elementTree.root).toMatchInlineSnapshot(`
    <page>
      <view
        class="Page Page--light"
      >
        <view
          class="Panel Panel--light"
        >
          <svg
            class="logo"
            src="lynx-dark-logo.svg"
          />
          <input
            class="Input Input--light"
            placeholder="Enter Lynx bundle URL or local path"
            text-color="#111827"
          />
          <wrapper>
            <view
              class="SizePicker SizePicker--light"
            >
              <view
                class="SizeTrigger SizeTrigger--light"
              >
                <text
                  class="SizeTriggerText SizeTriggerText--light"
                >
                  Default size - 390x844
                </text>
                <text
                  class="SizeTriggerIcon SizeTriggerIcon--light"
                >
                  v
                </text>
              </view>
              <wrapper />
            </view>
          </wrapper>
          <view
            class="ActionButton ActionButton--light OpenButton"
          >
            <text
              class="ActionButtonText"
            >
              Open
            </text>
          </view>
          <view
            class="ConnectionTrigger ConnectionTrigger--light"
          >
            <text
              class="ConnectionTriggerText ConnectionTriggerText--light"
            >
              Wi-Fi Connection
            </text>
            <text
              class="ConnectionTriggerIcon ConnectionTriggerIcon--light"
            >
              v
            </text>
          </view>
          <wrapper />
        </view>
      </view>
    </page>
  `);
  const { findByText } = getQueriesForElement(elementTree.root!);
  const element = await findByText('Open');
  expect(element).toBeInTheDocument();
  expect(element).toMatchInlineSnapshot(`
    <text
      class="ActionButtonText"
    >
      Open
    </text>
  `);
});
