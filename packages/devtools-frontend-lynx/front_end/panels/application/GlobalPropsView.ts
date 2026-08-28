// Copyright (c) 2026 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../core/i18n/i18n.js';
import * as Platform from '../../core/platform/platform.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';
import type * as ProtocolProxyApi from '../../generated/protocol-proxy-api.js';
import * as DataGrid from '../../ui/legacy/components/data_grid/data_grid.js';
import * as IconButton from '../../ui/components/icon_button/icon_button.js';
import * as ObjectUI from '../../ui/legacy/components/object_ui/object_ui.js';
import * as UI from '../../ui/legacy/legacy.js';

const UIStrings = {
  /**
   *@description Title of the GlobalProps view in the Application panel
   */
  globalProps: 'GlobalProps',
  /**
   *@description Column title for a GlobalProps property name
   */
  name: 'Name',
  /**
   *@description Column title for a GlobalProps property value
   */
  value: 'Value',
  /**
   *@description Column title for a GlobalProps property type
   */
  type: 'Type',
  /**
   *@description Accessible name for the GlobalProps data grid
   */
  globalPropsItems: 'GlobalProps items',
  /**
   *@description Tooltip for refreshing GlobalProps
   */
  refresh: 'Refresh',
  /**
   *@description Placeholder text for filtering GlobalProps by name or value
   */
  filter: 'Filter',
  /**
   *@description Button text for applying pending GlobalProps edits
   */
  apply: 'Apply',
  /**
   *@description Hint shown when there are no pending GlobalProps edits to apply
   */
  doubleClickValueToEdit: 'double-click value to edit',
  /**
   *@description Button text for retrying a failed GlobalProps update
   */
  retry: 'Retry',
  /**
   *@description Button text for discarding pending GlobalProps edits
   */
  discard: 'Discard',
  /**
   *@description Tooltip for expanding every node in the GlobalProps detail sidebar
   */
  expandAll: 'Expand all',
  /**
   *@description Tooltip for collapsing the GlobalProps detail sidebar back to its default state
   */
  collapseAll: 'Collapse all',
  /**
   *@description Tooltip for closing the GlobalProps detail sidebar
   */
  close: 'Close',
  /**
   *@description Status shown while GlobalProps edits are waiting to be sent
   */
  pendingChanges: 'Pending changes',
  /**
   *@description Status shown while a GlobalProps replacement is in progress
   */
  applyingChanges: 'Applying changes…',
  /**
   *@description Error shown when there is no inspected target for GlobalProps
   */
  noTarget: 'No inspected target is available.',
  /**
   *@description Error prefix for a failed GlobalProps command
   *@example {Protocol error} PH1
   */
  commandFailed: 'GlobalProps operation failed: {PH1}',
  /**
   *@description Error shown when an edited GlobalProps value is invalid for its original type
   *@example {number} PH1
   */
  invalidValue: 'The value is not a valid {PH1}.',
  /**
   *@description Error shown when the authoritative GlobalProps differs after a replacement
   */
  updateNotConfirmed: 'The update was not confirmed by the authoritative GlobalProps snapshot.',
};

const str_ = i18n.i18n.registerUIStrings('panels/application/GlobalPropsView.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

export type GlobalPropsValue = string|number|boolean|null|GlobalPropsObject|GlobalPropsValue[];
export interface GlobalPropsObject {
  [key: string]: GlobalPropsValue;
}
export type GlobalPropsValueType = 'string'|'number'|'boolean'|'null'|'object'|'array';

interface GlobalPropsRow {
  name: string;
  value: string;
  type: GlobalPropsValueType;
  rawValue: GlobalPropsValue;
}

interface InFlightUpdate {
  baseTimestamp: number;
  confirming: boolean;
  values: Map<string, GlobalPropsValue>;
  responseSucceeded: boolean;
  changedTimestamp: number|null;
  timeoutId: number|null;
}

const CONFIRMATION_TIMEOUT = 3000;

export function globalPropsValueType(value: GlobalPropsValue): GlobalPropsValueType {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value as GlobalPropsValueType;
}

export function formatGlobalPropsValue(value: GlobalPropsValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value) || 'null';
}

export function parseGlobalPropsValue(text: string, originalValue: GlobalPropsValue): GlobalPropsValue|null {
  const type = globalPropsValueType(originalValue);
  if (type === 'string') {
    return text;
  }
  if (type === 'number') {
    const value = Number(text);
    return text.trim() && Number.isFinite(value) ? value : null;
  }
  if (type === 'boolean') {
    return text === 'true' ? true : text === 'false' ? false : null;
  }

  try {
    const value = JSON.parse(text) as GlobalPropsValue;
    return globalPropsValueType(value) === type ? value : null;
  } catch (_error) {
    return null;
  }
}

function cloneValue<T extends GlobalPropsValue|GlobalPropsObject>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function valuesEqual(left: GlobalPropsValue, right: GlobalPropsValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function applyGlobalPropsChanges(snapshot: GlobalPropsObject, changes: Protocol.GlobalProps.Change[]): {
  globalProps: GlobalPropsObject,
  needsRefresh: boolean,
} {
  const globalProps = cloneValue(snapshot);
  let needsRefresh = false;
  for (const change of changes) {
    if (change.operation === Protocol.GlobalProps.ChangeOperation.Replace) {
      needsRefresh = true;
      continue;
    }
    if (change.key === undefined) {
      continue;
    }
    if (change.operation === Protocol.GlobalProps.ChangeOperation.Remove) {
      delete globalProps[change.key];
    } else if (change.operation === Protocol.GlobalProps.ChangeOperation.Set && 'value' in change) {
      globalProps[change.key] = cloneValue(change.value as GlobalPropsValue);
    }
  }
  return {globalProps, needsRefresh};
}

class GlobalPropsDataGrid extends DataGrid.DataGrid.DataGridImpl<GlobalPropsRow> {
  private enterPressed: boolean;

  constructor(parameters: DataGrid.DataGrid.Parameters) {
    super(parameters);
    this.enterPressed = false;
    this.element.addEventListener('keydown', event => {
      this.enterPressed = event.key === 'Enter';
    }, true);
  }

  // eslint-disable-next-line rulesdir/no_underscored_properties
  _editingCommitted(
      element: Element, newText: unknown, oldText: unknown, context: string|undefined, moveDirection: string): void {
    const shouldCommit = this.enterPressed;
    this.enterPressed = false;
    super._editingCommitted(element, shouldCommit ? newText : oldText, oldText, context, moveDirection);
  }
}

function createStackedIcon(topGlyph: string, bottomGlyph: string): HTMLElement {
  const container = document.createElement('span');
  container.style.display = 'inline-flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'center';
  const glyphs = [topGlyph, bottomGlyph];
  for (const glyph of glyphs) {
    const icon = UI.Icon.Icon.create(glyph);
    icon.style.backgroundColor = 'var(--color-text-secondary)';
    container.appendChild(icon);
  }
  return container;
}

export class GlobalPropsView extends UI.Widget.VBox implements
    ProtocolProxyApi.GlobalPropsDispatcher, SDK.TargetManager.Observer {
  private target: SDK.Target.Target|null;
  private enabled: boolean;
  private visible: boolean;
  private hideRequested: boolean;
  private authoritative: GlobalPropsObject;
  private timestamp: number;
  private drafts: Map<string, GlobalPropsValue>;
  private inFlight: InFlightUpdate|null;
  private retryAllowed: boolean;
  private filterRegex: RegExp|null;
  private filterInput: UI.Toolbar.ToolbarInput;
  private dataGrid: GlobalPropsDataGrid;
  private status: UI.Toolbar.ToolbarText;
  private errorElement: HTMLElement;
  private applyButton: UI.Toolbar.ToolbarItem;
  private retryButton: UI.Toolbar.ToolbarButton;
  private discardButton: UI.Toolbar.ToolbarButton;
  private splitWidget: UI.SplitWidget.SplitWidget;
  private detailWidget: UI.Widget.VBox;
  private detailContentElement: HTMLElement;
  private detailEntry: {name: string, rawValue: GlobalPropsValue}|null;
  private detailSection: ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection|null;
  private expandAllButton: UI.Toolbar.ToolbarButton;
  private collapseAllButton: UI.Toolbar.ToolbarButton;

  constructor() {
    super(false);
    this.registerRequiredCSS('panels/application/globalPropsView.css');
    this.element.classList.add('global-props-view');

    this.target = null;
    this.enabled = false;
    this.visible = false;
    this.hideRequested = false;
    this.authoritative = {};
    this.timestamp = Number.NEGATIVE_INFINITY;
    this.drafts = new Map();
    this.inFlight = null;
    this.retryAllowed = false;
    this.filterRegex = null;
    this.detailEntry = null;
    this.detailSection = null;

    this.element.createChild('div', 'global-props-title').textContent = i18nString(UIStrings.globalProps);
    const mainContentWidget = new UI.Widget.VBox();
    const toolbar = new UI.Toolbar.Toolbar('global-props-toolbar', mainContentWidget.element);
    const refreshButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.refresh), 'largeicon-refresh');
    refreshButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => void this.refresh());
    toolbar.appendToolbarItem(refreshButton);
    this.filterInput = new UI.Toolbar.ToolbarInput(i18nString(UIStrings.filter), '', 0.4);
    this.filterInput.addEventListener(UI.Toolbar.ToolbarInput.Event.TextChanged, event => {
      const text = event.data as string;
      this.filterRegex = text ? new RegExp(Platform.StringUtilities.escapeForRegExp(text), 'i') : null;
      this.render();
    });
    toolbar.appendToolbarItem(this.filterInput);
    toolbar.appendSpacer();
    this.status = new UI.Toolbar.ToolbarText();
    toolbar.appendToolbarItem(this.status);
    this.retryButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.retry), 'largeicon-refresh');
    this.retryButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => this.retry());
    toolbar.appendToolbarItem(this.retryButton);
    this.discardButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.discard), 'largeicon-clear');
    this.discardButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => this.discard());
    toolbar.appendToolbarItem(this.discardButton);
    const applyButtonElement = UI.UIUtils.createTextButton(
        i18nString(UIStrings.apply), () => this.submit(), 'global-props-apply-button');
    this.applyButton = new UI.Toolbar.ToolbarItem(applyButtonElement);
    this.applyButton.element.style.marginInlineEnd = '6px';
    toolbar.appendToolbarItem(this.applyButton);

    this.errorElement = mainContentWidget.element.createChild('div', 'global-props-error hidden');
    const columns = [
      {id: 'name', title: i18nString(UIStrings.name), sortable: false, editable: false, longText: true, weight: 35},
      {id: 'value', title: i18nString(UIStrings.value), sortable: false, editable: true, longText: true, weight: 45},
      {id: 'type', title: i18nString(UIStrings.type), sortable: false, editable: false, weight: 20},
    ] as DataGrid.DataGrid.ColumnDescriptor[];
    this.dataGrid = new GlobalPropsDataGrid({
      displayName: i18nString(UIStrings.globalPropsItems),
      columns,
      editCallback: this.editingCallback.bind(this),
      refreshCallback: (): void => void this.refresh(),
    });
    this.dataGrid.setStriped(true);
    this.dataGrid.setName('GlobalPropsView');
    const dataGridWidget = this.dataGrid.asWidget();
    dataGridWidget.element.classList.add('global-props-data-grid', 'flex-auto');
    this.dataGrid.element.classList.add('flex-auto');
    this.dataGrid.addEventListener(DataGrid.DataGrid.Events.SelectedNode, event => {
      const node = event.data as DataGrid.DataGrid.DataGridNode<GlobalPropsRow>;
      this.showDetail(node.data.name as string, node.data.rawValue as GlobalPropsValue);
    });

    this.detailWidget = new UI.Widget.VBox();
    const detailToolbar = new UI.Toolbar.Toolbar('global-props-detail-toolbar', this.detailWidget.element);
    this.expandAllButton = new UI.Toolbar.ToolbarButton(
        i18nString(UIStrings.expandAll),
        createStackedIcon('smallicon-expand-less', 'smallicon-expand-more'));
    this.expandAllButton.addEventListener(
        UI.Toolbar.ToolbarButton.Events.Click, () => this.expandAllDetails());
    detailToolbar.appendToolbarItem(this.expandAllButton);
    this.collapseAllButton = new UI.Toolbar.ToolbarButton(
        i18nString(UIStrings.collapseAll),
        createStackedIcon('smallicon-expand-more', 'smallicon-expand-less'));
    this.collapseAllButton.addEventListener(
        UI.Toolbar.ToolbarButton.Events.Click, () => this.collapseAllDetails());
    detailToolbar.appendToolbarItem(this.collapseAllButton);
    detailToolbar.appendSpacer();
    const closeIcon = new IconButton.Icon.Icon();
    closeIcon.data = {iconName: 'close-icon', color: 'var(--color-text-secondary)', width: '10px', height: '10px'};
    const closeButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.close), closeIcon);
    closeButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => this.closeDetail());
    detailToolbar.appendToolbarItem(closeButton);
    this.detailContentElement = this.detailWidget.element.createChild('div', 'global-props-detail');

    this.splitWidget = new UI.SplitWidget.SplitWidget(true, true, 'globalPropsViewSidebarState', 250);
    dataGridWidget.show(mainContentWidget.element);
    this.splitWidget.setMainWidget(mainContentWidget);
    this.splitWidget.setSidebarWidget(this.detailWidget);
    this.splitWidget.hideSidebar();
    this.splitWidget.show(this.element);

    this.updateActions();
    SDK.TargetManager.TargetManager.instance().observeTargets(this);
  }

  wasShown(): void {
    this.visible = true;
    this.hideRequested = false;
    void this.start();
  }

  willHide(): void {
    this.visible = false;
    this.hideRequested = true;
    this.maybeDisable();
  }

  targetAdded(_target: SDK.Target.Target): void {
    if (this.visible && !this.target) {
      void this.start();
    }
  }

  targetRemoved(target: SDK.Target.Target): void {
    if (target !== this.target) {
      return;
    }
    target.unregisterGlobalPropsDispatcher(this);
    this.target = null;
    this.enabled = false;
    this.resetState();
    this.setError(i18nString(UIStrings.noTarget), true);
    if (this.visible) {
      void this.start();
    }
  }

  changed(params: Protocol.GlobalProps.ChangedEvent): void {
    if (params.timestamp <= this.timestamp) {
      return;
    }

    const {globalProps, needsRefresh} = applyGlobalPropsChanges(this.authoritative, params.changes);
    this.authoritative = globalProps;
    this.timestamp = params.timestamp;
    this.render();

    if (!needsRefresh) {
      return;
    }
    if (this.inFlight && params.timestamp > this.inFlight.baseTimestamp) {
      this.inFlight.changedTimestamp = params.timestamp;
      if (this.inFlight.responseSucceeded) {
        void this.confirmInFlight();
      }
      return;
    }
    void this.refresh();
  }

  private async start(): Promise<void> {
    const target = SDK.TargetManager.TargetManager.instance().mainTarget();
    if (!target) {
      this.setError(i18nString(UIStrings.noTarget), true);
      return;
    }
    if (this.target !== target) {
      if (this.target) {
        this.target.unregisterGlobalPropsDispatcher(this);
        this.resetState();
      }
      this.target = target;
      this.target.registerGlobalPropsDispatcher(this);
      this.enabled = false;
    }

    if (!this.enabled) {
      try {
        const response = await target.globalPropsAgent().invoke_enable();
        if (this.target !== target) {
          return;
        }
        const error = response.getError();
        if (error) {
          this.setError(i18nString(UIStrings.commandFailed, {PH1: error}), true);
          return;
        }
        this.enabled = true;
      } catch (error) {
        if (this.target === target) {
          this.setError(i18nString(UIStrings.commandFailed, {PH1: String(error)}), true);
        }
        return;
      }
    }
    await this.refresh();
    this.maybeDisable();
  }

  private async refresh(): Promise<boolean> {
    const target = this.target;
    if (!target) {
      this.setError(i18nString(UIStrings.noTarget), true);
      return false;
    }
    try {
      const response = await target.globalPropsAgent().invoke_get();
      if (this.target !== target) {
        return false;
      }
      const error = response.getError();
      if (error) {
        this.setError(i18nString(UIStrings.commandFailed, {PH1: error}), true);
        return false;
      }
      if (response.timestamp >= this.timestamp) {
        this.authoritative = cloneValue(response.globalProps as GlobalPropsObject);
        this.timestamp = response.timestamp;
      }
      if (!this.retryAllowed || !this.drafts.size) {
        this.clearError();
      }
      this.render();
      return true;
    } catch (error) {
      if (this.target === target) {
        this.setError(i18nString(UIStrings.commandFailed, {PH1: String(error)}), true);
      }
      return false;
    }
  }

  private editingCallback(node: DataGrid.DataGrid.DataGridNode<GlobalPropsRow>, column: string, _oldText: string,
      newText: string): void {
    if (column !== 'value') {
      return;
    }
    const parsedValue = parseGlobalPropsValue(newText, node.data.rawValue as GlobalPropsValue);
    if (parsedValue === null && globalPropsValueType(node.data.rawValue as GlobalPropsValue) !== 'null') {
      node.data.value = formatGlobalPropsValue(node.data.rawValue as GlobalPropsValue);
      node.refresh();
      this.setError(
          i18nString(UIStrings.invalidValue, {PH1: globalPropsValueType(node.data.rawValue as GlobalPropsValue)}), false);
      return;
    }
    if (parsedValue === null && newText !== 'null') {
      node.data.value = 'null';
      node.refresh();
      this.setError(i18nString(UIStrings.invalidValue, {PH1: 'null'}), false);
      return;
    }

    this.clearError();
    this.drafts.set(node.data.name as string, cloneValue(parsedValue as GlobalPropsValue));
    this.render();
  }

  private submit(): void {
    if (!this.target || !this.enabled || this.inFlight || !this.drafts.size) {
      this.maybeDisable();
      return;
    }
    const values = new Map(this.drafts);
    this.drafts.clear();
    const payload = this.mergedProps(values);
    const inFlight: InFlightUpdate = {
      baseTimestamp: this.timestamp,
      confirming: false,
      values,
      responseSucceeded: false,
      changedTimestamp: null,
      timeoutId: null,
    };
    this.inFlight = inFlight;
    this.render();

    void this.target.globalPropsAgent().invoke_replace({globalProps: payload}).then(response => {
      if (this.inFlight !== inFlight) {
        return;
      }
      const error = response.getError();
      if (error) {
        this.failInFlight(i18nString(UIStrings.commandFailed, {PH1: error}));
        return;
      }
      this.inFlight.responseSucceeded = true;
      this.inFlight.timeoutId = window.setTimeout(() => void this.confirmInFlight(), CONFIRMATION_TIMEOUT);
      if (this.inFlight.changedTimestamp !== null) {
        void this.confirmInFlight();
      }
    }).catch(error => {
      if (this.inFlight === inFlight) {
        this.failInFlight(i18nString(UIStrings.commandFailed, {PH1: String(error)}));
      }
    });
  }

  private async confirmInFlight(): Promise<void> {
    const inFlight = this.inFlight;
    if (!inFlight || !inFlight.responseSucceeded || inFlight.confirming) {
      return;
    }
    inFlight.confirming = true;
    if (inFlight.timeoutId !== null) {
      window.clearTimeout(inFlight.timeoutId);
      inFlight.timeoutId = null;
    }
    const refreshed = await this.refresh();
    if (this.inFlight !== inFlight) {
      return;
    }
    const confirmed = refreshed && Array.from(inFlight.values).every(
        ([key, value]) => key in this.authoritative && valuesEqual(this.authoritative[key], value));
    if (!confirmed) {
      this.restoreInFlightDrafts();
      this.setError(i18nString(UIStrings.updateNotConfirmed), true);
      this.maybeDisable();
      return;
    }
    this.inFlight = null;
    this.clearError();
    this.render();
    this.maybeDisable();
  }

  private failInFlight(message: string): void {
    this.restoreInFlightDrafts();
    this.setError(message, true);
    this.maybeDisable();
  }

  private restoreInFlightDrafts(): void {
    if (!this.inFlight) {
      return;
    }
    if (this.inFlight.timeoutId !== null) {
      window.clearTimeout(this.inFlight.timeoutId);
    }
    for (const [key, value] of this.inFlight.values) {
      if (!this.drafts.has(key)) {
        this.drafts.set(key, value);
      }
    }
    this.inFlight = null;
    this.render();
  }

  private retry(): void {
    this.retryAllowed = false;
    this.clearError();
    if (!this.enabled) {
      void this.start();
      return;
    }
    void this.refresh();
  }

  private discard(): void {
    this.drafts.clear();
    this.retryAllowed = false;
    this.clearError();
    this.render();
    this.maybeDisable();
  }

  private showDetail(name: string, rawValue: GlobalPropsValue): void {
    if (this.detailEntry && this.detailEntry.name === name &&
        valuesEqual(this.detailEntry.rawValue, rawValue)) {
      this.splitWidget.showBoth();
      return;
    }
    this.detailEntry = {name, rawValue};
    this.renderDetail();
    this.splitWidget.showBoth();
  }

  private closeDetail(): void {
    this.splitWidget.hideSidebar();
  }

  private expandAllDetails(): void {
    const root = this.detailTreeRoot();
    if (root) {
      void root.expandRecursively(1000);
    }
  }

  private collapseAllDetails(): void {
    const root = this.detailTreeRoot();
    if (root) {
      root.collapseChildren();
    }
  }

  private detailTreeRoot(): UI.TreeOutline.TreeElement|null {
    if (!this.detailSection) {
      return null;
    }
    return this.detailSection.rootElement().children()[0] || null;
  }

  private renderDetail(): void {
    this.detailContentElement.removeChildren();
    const entry = this.detailEntry;
    if (!entry) {
      this.detailSection = null;
      this.updateDetailActions();
      return;
    }
    this.detailContentElement.createChild('div', 'global-props-detail-title').textContent = entry.name;
    const object = SDK.RemoteObject.RemoteObject.fromLocalObject(entry.rawValue);
    if (object.hasChildren) {
      const section = ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection
                          .defaultObjectPropertiesSection(
                              object, undefined /* linkifier */, true /* skipProto */, true /* readOnly */);
      this.detailSection = section;
      this.detailContentElement.appendChild(section.element);
      const root = this.detailTreeRoot();
      if (root) {
        root.expand();
      }
    } else {
      this.detailSection = null;
      this.detailContentElement.appendChild(
          ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection.defaultObjectPresentation(
              object, undefined /* linkifier */, true /* skipProto */, true /* readOnly */));
    }
    this.updateDetailActions();
  }

  private updateDetailActions(): void {
    this.expandAllButton.setEnabled(Boolean(this.detailSection));
    this.collapseAllButton.setEnabled(Boolean(this.detailSection));
  }

  private mergedProps(extraValues?: Map<string, GlobalPropsValue>): GlobalPropsObject {
    const result = cloneValue(this.authoritative);
    if (this.inFlight) {
      for (const [key, value] of this.inFlight.values) {
        result[key] = cloneValue(value);
      }
    }
    for (const [key, value] of extraValues || this.drafts) {
      result[key] = cloneValue(value);
    }
    return result;
  }

  private render(): void {
    const values = this.mergedProps();
    const pendingKeys = new Set(this.drafts.keys());
    if (this.inFlight) {
      for (const key of this.inFlight.values.keys()) {
        pendingKeys.add(key);
      }
    }

    const root = this.dataGrid.rootNode();
    root.removeChildren();
    for (const [name, rawValue] of Object.entries(values)) {
      const value = formatGlobalPropsValue(rawValue);
      if (this.filterRegex && !this.filterRegex.test(`${name}\n${value}`)) {
        continue;
      }
      const node = new DataGrid.DataGrid.DataGridNode<GlobalPropsRow>({
        name,
        value,
        type: globalPropsValueType(rawValue),
        rawValue,
      }, false);
      root.appendChild(node);
      node.element().classList.toggle('global-props-pending', pendingKeys.has(name));
    }
    if (this.detailEntry) {
      const detailName = this.detailEntry.name;
      if (detailName in values) {
        const rawValue = values[detailName];
        if (!valuesEqual(this.detailEntry.rawValue, rawValue)) {
          this.detailEntry = {name: detailName, rawValue};
          this.renderDetail();
        }
      } else {
        this.detailEntry = null;
        this.detailSection = null;
        this.splitWidget.hideSidebar();
      }
    }
    this.updateActions();
  }

  private setError(message: string, canRetry: boolean): void {
    this.retryAllowed = canRetry;
    this.errorElement.textContent = message;
    this.errorElement.classList.remove('hidden');
    this.updateActions();
  }

  private clearError(): void {
    this.retryAllowed = false;
    this.errorElement.textContent = '';
    this.errorElement.classList.add('hidden');
    this.updateActions();
  }

  private updateActions(): void {
    const hasPending = Boolean(this.drafts.size) || Boolean(this.inFlight);
    this.applyButton.element.textContent =
        hasPending ? i18nString(UIStrings.apply) : i18nString(UIStrings.doubleClickValueToEdit);
    this.applyButton.setEnabled(
        Boolean(this.drafts.size) && !this.inFlight && Boolean(this.target) && this.enabled);
    this.retryButton.setVisible(this.retryAllowed && !this.drafts.size);
    this.discardButton.setVisible(Boolean(this.drafts.size));
    this.status.setText(this.inFlight ? i18nString(UIStrings.applyingChanges) :
                                      this.drafts.size ? i18nString(UIStrings.pendingChanges) : '');
  }

  private resetState(): void {
    if (this.inFlight && this.inFlight.timeoutId !== null) {
      window.clearTimeout(this.inFlight.timeoutId);
    }
    this.inFlight = null;
    this.drafts.clear();
    this.authoritative = {};
    this.timestamp = Number.NEGATIVE_INFINITY;
    this.render();
  }

  private maybeDisable(): void {
    if (!this.hideRequested || this.inFlight || !this.enabled || !this.target) {
      return;
    }
    const target = this.target;
    this.enabled = false;
    this.updateActions();
    void target.globalPropsAgent().invoke_disable();
  }
}
