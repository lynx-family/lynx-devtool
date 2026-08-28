// Copyright 2026 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as i18n from '../../core/i18n/i18n.js';
import * as UI from '../../ui/legacy/legacy.js';

import {GlobalPropsView} from './GlobalPropsView.js';

const UIStrings = {
  /**
   *@description Text in the Lynx Application panel sidebar
   */
  application: 'Application',
  /**
   *@description Text for GlobalProps in the Lynx Application panel sidebar
   */
  globalProps: 'GlobalProps',
};

const str_ = i18n.i18n.registerUIStrings('panels/application/LynxApplication.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

let lynxApplicationInstance: LynxApplication;

export class LynxApplication extends UI.Panel.PanelWithSidebar {
  private readonly sidebarTree: UI.TreeOutline.TreeOutlineInShadow;
  private readonly globalPropsTreeElement: UI.TreeOutline.TreeElement;
  private readonly globalPropsView: GlobalPropsView;

  private constructor() {
    super('resources');

    this.sidebarTree = new UI.TreeOutline.TreeOutlineInShadow();
    this.sidebarTree.element.classList.add('resources-sidebar', 'filter-all');
    this.sidebarTree.registerRequiredCSS('panels/application/resourcesSidebar.css');
    this.panelSidebarElement().appendChild(this.sidebarTree.element);
    this.setDefaultFocusedElement(this.sidebarTree.element);

    const applicationTreeElement = new UI.TreeOutline.TreeElement(i18nString(UIStrings.application), true);
    applicationTreeElement.listItemElement.classList.add('storage-group-list-item');
    applicationTreeElement.setCollapsible(false);
    applicationTreeElement.selectable = false;
    this.sidebarTree.appendChild(applicationTreeElement);
    UI.ARIAUtils.setAccessibleName(
        applicationTreeElement.childrenListElement, i18nString(UIStrings.application));

    this.globalPropsTreeElement = new UI.TreeOutline.TreeElement(i18nString(UIStrings.globalProps), false);
    const icon = UI.Icon.Icon.create('mediumicon-table', 'resource-tree-item');
    this.globalPropsTreeElement.setLeadingIcons([icon]);
    applicationTreeElement.appendChild(this.globalPropsTreeElement);
    this.globalPropsTreeElement.select();

    this.globalPropsView = new GlobalPropsView();
    this.splitWidget().setMainWidget(this.globalPropsView);
  }

  static instance(opts: {forceNew: boolean|null} = {forceNew: null}): LynxApplication {
    const {forceNew} = opts;
    if (!lynxApplicationInstance || forceNew) {
      lynxApplicationInstance = new LynxApplication();
    }
    return lynxApplicationInstance;
  }
}
