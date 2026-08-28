// Copyright 2026 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const {assert} = chai;

import * as Root from '../../../../../front_end/core/root/root.js';
import * as SDK from '../../../../../front_end/core/sdk/sdk.js';
import type * as UI from '../../../../../front_end/ui/legacy/legacy.js';
import * as Resources from '../../../../../front_end/panels/application/application.js';
import {describeWithEnvironment} from '../../helpers/EnvironmentHelpers.js';

describeWithEnvironment('LynxApplication', () => {
  const globalPropsCSS = 'panels/application/globalPropsView.css';
  const sidebarCSS = 'panels/application/resourcesSidebar.css';

  before(() => {
    Root.Runtime.cachedResources.set(globalPropsCSS, '/* GlobalPropsView test */');
    Root.Runtime.cachedResources.set(sidebarCSS, '/* LynxApplication test */');
  });

  after(() => {
    Root.Runtime.cachedResources.delete(globalPropsCSS);
    Root.Runtime.cachedResources.delete(sidebarCSS);
  });

  it('shows only GlobalProps without instantiating the legacy ResourcesPanel', () => {
    const globalObject = globalThis as unknown as Record<string, unknown>;
    const previousGlobalUI = globalObject['UI'];
    globalObject['UI'] = {panels: {}};
    const legacyPanelSpy = sinon.spy(Resources.ResourcesPanel.ResourcesPanel, 'instance');
    const panel = Resources.LynxApplication.LynxApplication.instance({forceNew: true});
    const state = panel as unknown as {
      globalPropsTreeElement: UI.TreeOutline.TreeElement,
      globalPropsView: Resources.GlobalPropsView.GlobalPropsView,
      sidebarTree: UI.TreeOutline.TreeOutlineInShadow,
    };

    try {
      const applicationTreeElement = state.sidebarTree.firstChild();
      assert.exists(applicationTreeElement);
      assert.strictEqual(applicationTreeElement?.title, 'Application');
      assert.strictEqual(applicationTreeElement?.childCount(), 1);
      assert.strictEqual(applicationTreeElement?.firstChild(), state.globalPropsTreeElement);
      assert.strictEqual(state.globalPropsTreeElement.title, 'GlobalProps');
      assert.isTrue(state.globalPropsTreeElement.selected);
      assert.strictEqual(panel.splitWidget().mainWidget(), state.globalPropsView);
      assert.isTrue(legacyPanelSpy.notCalled);
    } finally {
      SDK.TargetManager.TargetManager.instance().unobserveTargets(state.globalPropsView);
      legacyPanelSpy.restore();
      if (previousGlobalUI === undefined) {
        delete globalObject['UI'];
      } else {
        globalObject['UI'] = previousGlobalUI;
      }
    }
  });
});
