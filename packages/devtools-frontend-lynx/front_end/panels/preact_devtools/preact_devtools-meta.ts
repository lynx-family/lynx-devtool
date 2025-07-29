// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as Root from '../../core/root/root.js';
import * as UI from '../../ui/legacy/legacy.js';

// eslint-disable-next-line rulesdir/es_modules_import
import * as PreactDevtools from './preact_devtools.js';

import * as i18n from '../../core/i18n/i18n.js';

const UIStrings = {
  /**
  *@description Title of the Preact Devtools tool
  */
  preactDevtools: 'Preact Devtools',
  /**
  *@description Title of an action that shows the Preact Devtools.
  */
  showPreactDevtools: 'Show Preact Devtools',
};

const str_ = i18n.i18n.registerUIStrings('panels/preact_devtools/preact_devtools-meta.ts', UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(undefined, str_);

let loadedPreactDevtoolsModule: (typeof PreactDevtools | undefined);

async function loadPreactDevtoolsModule(): Promise<typeof PreactDevtools> {
  if (!loadedPreactDevtoolsModule) {
    // Side-effect import resources in module.json
    await Root.Runtime.Runtime.instance().loadModulePromise('panels/preact_devtools');
    loadedPreactDevtoolsModule = await import('./preact_devtools.js');
  }
  return loadedPreactDevtoolsModule;
}

UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: 'preact_devtools',
  title: i18nLazyString(UIStrings.preactDevtools),
  commandPrompt: i18nLazyString(UIStrings.showPreactDevtools),
  order: 40,
  async loadView() {
    const PreactDevtoolsModule = await loadPreactDevtoolsModule();
    return PreactDevtoolsModule.PreactDevtoolsPanel.PreactDevtoolsPanel.instance();
  },
});
