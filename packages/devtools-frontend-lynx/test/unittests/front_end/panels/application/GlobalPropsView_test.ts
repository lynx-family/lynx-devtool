// Copyright (c) 2026 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const {assert} = chai;

import * as Root from '../../../../../front_end/core/root/root.js';
import * as SDK from '../../../../../front_end/core/sdk/sdk.js';
import * as Protocol from '../../../../../front_end/generated/protocol.js';
import * as Resources from '../../../../../front_end/panels/application/application.js';
import {describeWithEnvironment} from '../../helpers/EnvironmentHelpers.js';

const {
  applyGlobalPropsChanges,
  formatGlobalPropsValue,
  globalPropsValueType,
  parseGlobalPropsValue,
} = Resources.GlobalPropsView;

describeWithEnvironment('GlobalPropsView', () => {
  const cssResource = 'panels/application/globalPropsView.css';

  before(() => Root.Runtime.cachedResources.set(cssResource, '/* GlobalPropsView test */'));
  after(() => Root.Runtime.cachedResources.delete(cssResource));

  function createView(): Resources.GlobalPropsView.GlobalPropsView {
    return new Resources.GlobalPropsView.GlobalPropsView();
  }

  function disposeView(view: Resources.GlobalPropsView.GlobalPropsView): void {
    SDK.TargetManager.TargetManager.instance().unobserveTargets(view);
  }

  it('places toolbar items in order and keeps Apply as the rightmost text button', () => {
    const view = createView();
    try {
      const toolbar = view.element.querySelector('.global-props-toolbar') as HTMLElement;
      const toolbarItems = Array.from(toolbar.shadowRoot?.querySelectorAll('.toolbar-shadow > .toolbar-item') || []);
      const refreshButton = toolbarItems[0] as HTMLButtonElement;
      const filterInput = toolbar.shadowRoot?.querySelector('.toolbar-input') as HTMLElement;
      const applyButton = toolbar.shadowRoot?.querySelector('.global-props-apply-button') as HTMLButtonElement;
      const spacer = toolbar.shadowRoot?.querySelector('.toolbar-spacer') as HTMLElement;
      const state = view as unknown as {
        drafts: Map<string, Resources.GlobalPropsView.GlobalPropsValue>,
        discardButton: {element: HTMLElement},
        enabled: boolean,
        inFlight: object|null,
        retryButton: {element: HTMLElement},
        status: {element: HTMLElement},
        target: SDK.Target.Target|null,
        updateActions(): void,
      };
      assert.deepEqual(toolbarItems, [
        refreshButton,
        filterInput,
        spacer,
        state.status.element,
        state.retryButton.element,
        state.discardButton.element,
        applyButton,
      ]);
      assert.deepEqual(
          toolbarItems.filter(item => !item.classList.contains('hidden')),
          [refreshButton, filterInput, spacer, state.status.element, applyButton]);
      assert.strictEqual(applyButton.textContent, 'Apply');
      assert.isTrue(applyButton.classList.contains('text-button'));
      assert.isFalse(applyButton.classList.contains('primary-button'));
      assert.strictEqual(toolbarItems[toolbarItems.length - 1], applyButton);
      // The toolbar host contributes 2px and this item contributes 6px, for 8px total right whitespace.
      assert.strictEqual(applyButton.style.marginInlineEnd, '6px');
      assert.isTrue(applyButton.disabled);

      state.target = {} as SDK.Target.Target;
      state.enabled = true;
      state.drafts.set('theme', 'Dark');
      state.updateActions();
      assert.deepEqual(
          toolbarItems.filter(item => !item.classList.contains('hidden')),
          [refreshButton, filterInput, spacer, state.status.element, state.discardButton.element, applyButton]);
      assert.isFalse(applyButton.disabled);

      state.inFlight = {};
      state.updateActions();
      assert.isTrue(applyButton.disabled);
    } finally {
      disposeView(view);
    }
  });

  it('keeps the title above split main and sidebar content', () => {
    const view = createView();
    try {
      const state = view as unknown as {
        dataGrid: {asWidget(): {element: HTMLElement}},
        detailWidget: {element: HTMLElement},
        errorElement: HTMLElement,
        splitWidget: {
          element: HTMLElement,
          mainWidget(): {element: HTMLElement}|null,
          sidebarWidget(): {element: HTMLElement}|null,
          showBoth(): void,
        },
      };
      state.splitWidget.showBoth();
      const title = view.element.querySelector('.global-props-title') as HTMLElement;
      const filterToolbar = view.element.querySelector('.global-props-toolbar') as HTMLElement;
      const detailToolbar = view.element.querySelector('.global-props-detail-toolbar') as HTMLElement;
      const mainContent = state.splitWidget.mainWidget()?.element;

      assert.isTrue(title.parentElement === view.element);
      assert.isTrue(title.nextElementSibling === state.splitWidget.element);
      assert.isFalse(mainContent?.contains(title) ?? true);
      assert.isTrue(mainContent?.contains(filterToolbar) ?? false);
      assert.isTrue(mainContent?.contains(state.errorElement) ?? false);
      assert.isTrue(mainContent?.contains(state.dataGrid.asWidget().element) ?? false);
      assert.isTrue(state.splitWidget.sidebarWidget()?.element === state.detailWidget.element);
      assert.isTrue(state.detailWidget.element.parentElement === mainContent?.parentElement);
      assert.isTrue(detailToolbar.parentElement === state.detailWidget.element);
      assert.isFalse(mainContent?.contains(detailToolbar) ?? true);
    } finally {
      disposeView(view);
    }
  });

  it('keeps stacked detail toolbar glyphs ordered without overlap', () => {
    const view = createView();
    try {
      const state = view as unknown as {expandAllButton: {element: HTMLElement}};
      const expandGlyphs =
          Array.from(state.expandAllButton.element.querySelector('.toolbar-icon')?.children || []) as HTMLElement[];
      assert.strictEqual(expandGlyphs.length, 2);
      assert.strictEqual(expandGlyphs[0].classList.contains('smallicon-expand-less'), true);
      assert.strictEqual(expandGlyphs[1].classList.contains('smallicon-expand-more'), true);
      assert.strictEqual(expandGlyphs[1].style.marginTop, '');
    } finally {
      disposeView(view);
    }
  });

  it('filters rows by name and formatted value without matching the type column', () => {
    const view = createView();
    try {
      view.changed({
        timestamp: 1,
        changes: [
          {operation: Protocol.GlobalProps.ChangeOperation.Set, key: 'alphaKey', value: 'Hello Lynx'},
          {operation: Protocol.GlobalProps.ChangeOperation.Set, key: 'betaKey', value: {nested: 'Needle'}},
          {operation: Protocol.GlobalProps.ChangeOperation.Set, key: 'gammaKey', value: 42},
        ],
      });
      const state = view as unknown as {
        dataGrid: {rootNode(): {children: Array<{data: {name: string}}>}},
        filterInput: {setValue(value: string, notify?: boolean): void},
      };
      const visibleNames = (): string[] => state.dataGrid.rootNode().children.map(node => node.data.name);

      state.filterInput.setValue('ALPHA', true);
      assert.deepEqual(visibleNames(), ['alphaKey']);
      state.filterInput.setValue('needle', true);
      assert.deepEqual(visibleNames(), ['betaKey']);
      state.filterInput.setValue('42', true);
      assert.deepEqual(visibleNames(), ['gammaKey']);
      state.filterInput.setValue('number', true);
      assert.deepEqual(visibleNames(), []);
      state.filterInput.setValue('', true);
      assert.deepEqual(visibleNames(), ['alphaKey', 'betaKey', 'gammaKey']);
    } finally {
      disposeView(view);
    }
  });

  it('does not submit confirmed edits on a timer or when hidden', () => {
    const clock = sinon.useFakeTimers();
    const view = createView();
    try {
      const submit = sinon.spy();
      const state = view as unknown as {
        editingCallback(node: unknown, column: string, oldText: string, newText: string): void,
        submit: sinon.SinonSpy,
      };
      state.submit = submit;
      state.editingCallback({
        data: {name: 'theme', value: 'Light', type: 'string', rawValue: 'Light'},
      }, 'value', 'Light', 'Dark');

      clock.tick(1000);
      view.willHide();
      sinon.assert.notCalled(submit);
    } finally {
      clock.restore();
      disposeView(view);
    }
  });

  it('submits all drafts once and queues later edits for another Apply', () => {
    const clock = sinon.useFakeTimers();
    const view = createView();
    try {
      const invokeReplace = sinon.stub().returns(new Promise(() => {}));
      const state = view as unknown as {
        authoritative: Resources.GlobalPropsView.GlobalPropsObject,
        drafts: Map<string, Resources.GlobalPropsView.GlobalPropsValue>,
        enabled: boolean,
        filterInput: {setValue(value: string, notify?: boolean): void},
        target: SDK.Target.Target|null,
        updateActions(): void,
      };
      state.authoritative = {theme: 'Light', testNumber: 1};
      state.drafts.set('theme', 'Dark');
      state.drafts.set('testNumber', 2);
      state.enabled = true;
      state.target = {globalPropsAgent: () => ({invoke_replace: invokeReplace})} as unknown as SDK.Target.Target;
      state.updateActions();

      const toolbar = view.element.querySelector('.global-props-toolbar') as HTMLElement;
      state.filterInput.setValue('no matching row', true);
      const applyButton = toolbar.shadowRoot?.querySelector('.global-props-apply-button') as HTMLButtonElement;
      applyButton.click();
      sinon.assert.calledOnceWithExactly(invokeReplace, {globalProps: {theme: 'Dark', testNumber: 2}});
      assert.isTrue(applyButton.disabled);

      state.drafts.set('theme', 'System');
      state.updateActions();
      clock.tick(1000);
      sinon.assert.calledOnce(invokeReplace);
      assert.isTrue(applyButton.disabled);
    } finally {
      clock.restore();
      disposeView(view);
    }
  });

  it('classifies and formats supported values', () => {
    const values: Array<[
      Resources.GlobalPropsView.GlobalPropsValue, Resources.GlobalPropsView.GlobalPropsValueType, string,
    ]> = [
      ['text', 'string', 'text'],
      [12.5, 'number', '12.5'],
      [true, 'boolean', 'true'],
      [null, 'null', 'null'],
      [{nested: 1}, 'object', '{"nested":1}'],
      [[1, 'two'], 'array', '[1,"two"]'],
    ];

    for (const [value, type, formatted] of values) {
      assert.strictEqual(globalPropsValueType(value), type);
      assert.strictEqual(formatGlobalPropsValue(value), formatted);
    }
  });

  it('parses edits without changing the original value type', () => {
    assert.strictEqual(parseGlobalPropsValue('unchanged whitespace ', 'old'), 'unchanged whitespace ');
    assert.strictEqual(parseGlobalPropsValue('2.5', 1), 2.5);
    assert.strictEqual(parseGlobalPropsValue('false', true), false);
    assert.strictEqual(parseGlobalPropsValue('null', null), null);
    assert.deepEqual(parseGlobalPropsValue('{"next":2}', {old: 1}), {next: 2});
    assert.deepEqual(parseGlobalPropsValue('[2,3]', [1]), [2, 3]);

    assert.isNull(parseGlobalPropsValue('', 1));
    assert.isNull(parseGlobalPropsValue('TRUE', true));
    assert.isNull(parseGlobalPropsValue('[]', {}));
    assert.isNull(parseGlobalPropsValue('{}', []));
    assert.isNull(parseGlobalPropsValue('undefined', null));
  });

  it('applies set and remove changes without mutating the authoritative snapshot', () => {
    const snapshot = {keep: 1, remove: 'old'};
    const result = applyGlobalPropsChanges(snapshot, [
      {operation: Protocol.GlobalProps.ChangeOperation.Set, key: 'keep', value: 2},
      {operation: Protocol.GlobalProps.ChangeOperation.Set, key: 'add', value: {nested: true}},
      {operation: Protocol.GlobalProps.ChangeOperation.Set, key: '', value: 'empty key'},
      {operation: Protocol.GlobalProps.ChangeOperation.Remove, key: 'remove'},
    ]);

    assert.deepEqual(result.globalProps, {keep: 2, add: {nested: true}, '': 'empty key'});
    assert.isFalse(result.needsRefresh);
    assert.deepEqual(snapshot, {keep: 1, remove: 'old'});
  });

  it('requests a refresh for replace changes', () => {
    const result = applyGlobalPropsChanges({keep: 1}, [
      {operation: Protocol.GlobalProps.ChangeOperation.Replace},
    ]);

    assert.deepEqual(result.globalProps, {keep: 1});
    assert.isTrue(result.needsRefresh);
  });

});
