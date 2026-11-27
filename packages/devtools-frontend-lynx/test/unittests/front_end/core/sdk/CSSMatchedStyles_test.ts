// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const {assert} = chai;

import * as SDK from '../../../../../front_end/core/sdk/sdk.js';
import * as Protocol from '../../../../../front_end/generated/protocol.js';

const {Active, Overloaded} = SDK.CSSMatchedStyles.PropertyState;

interface PropertyDescriptor {
  name: string;
  value: string;
  important?: boolean;
}

interface RuleOptions {
  // Cascade layers this rule belongs to, innermost first. Omit for an unlayered rule.
  layers?: string[];
  origin?: Protocol.CSS.StyleSheetOrigin;
}

// Builds a matched-rule payload the same way the CDP backend reports it. The
// backend lists matched rules in ascending normal-cascade priority, so callers
// pass rules weakest-first (e.g. earlier @layer before later @layer).
function ruleMatch(
    selector: string, properties: PropertyDescriptor[], options: RuleOptions = {}): Protocol.CSS.RuleMatch {
  const {layers = [], origin = Protocol.CSS.StyleSheetOrigin.Regular} = options;
  return {
    rule: {
      selectorList: {selectors: [{text: selector}], text: selector},
      origin,
      style: {
        cssProperties: properties.map(({name, value, important}) => ({name, value, important})),
        shorthandEntries: [],
      },
      layers: layers.map(text => ({text})),
    },
    matchingSelectors: [0],
  } as Protocol.CSS.RuleMatch;
}

describe('CSSMatchedStyles', () => {
  function computeMatchedStyles(matchedPayload: Protocol.CSS.RuleMatch[]): SDK.CSSMatchedStyles.CSSMatchedStyles {
    const cssModel = sinon.createStubInstance(SDK.CSSModel.CSSModel);
    const node = sinon.createStubInstance(SDK.DOMModel.DOMNode);
    node.id = 1 as Protocol.DOM.NodeId;
    return new SDK.CSSMatchedStyles.CSSMatchedStyles(
        cssModel as unknown as SDK.CSSModel.CSSModel, node as unknown as SDK.DOMModel.DOMNode, null, null, matchedPayload,
        [], [], []);
  }

  // Maps each authored declaration value to its cascade state. Test declarations
  // use distinct values so a value uniquely identifies its declaration.
  function statesByValue(matchedStyles: SDK.CSSMatchedStyles.CSSMatchedStyles):
      Map<string, SDK.CSSMatchedStyles.PropertyState|null> {
    const states = new Map<string, SDK.CSSMatchedStyles.PropertyState|null>();
    for (const style of matchedStyles.nodeStyles()) {
      for (const property of style.allProperties()) {
        states.set(property.value, matchedStyles.propertyState(property));
      }
    }
    return states;
  }

  describe('cascade layers with !important', () => {
    it('reverses layer order for important declarations across named layers', () => {
      // Normal order is base < override, so `override` would win a normal cascade.
      // With !important the order reverses and the earlier layer (`base`) wins.
      const states = statesByValue(computeMatchedStyles([
        ruleMatch('.rule1', [{name: 'width', value: '20px', important: true}], {layers: ['base']}),
        ruleMatch('.rule1', [{name: 'width', value: '10px', important: true}], {layers: ['override']}),
      ]));

      assert.strictEqual(states.get('20px'), Active, 'important in the earlier layer should win');
      assert.strictEqual(states.get('10px'), Overloaded, 'important in the later layer should be overridden');
    });

    it('keeps forward layer order for normal declarations', () => {
      // Regression guard: without !important the later layer still wins.
      const states = statesByValue(computeMatchedStyles([
        ruleMatch('.rule1', [{name: 'width', value: '20px'}], {layers: ['base']}),
        ruleMatch('.rule1', [{name: 'width', value: '10px'}], {layers: ['override']}),
      ]));

      assert.strictEqual(states.get('10px'), Active, 'the later layer should win for normal declarations');
      assert.strictEqual(states.get('20px'), Overloaded, 'the earlier layer should be overridden');
    });

    it('prefers layered important over unlayered important', () => {
      // An unlayered rule wins the normal cascade, but for !important a layered
      // declaration outranks an unlayered one.
      const states = statesByValue(computeMatchedStyles([
        ruleMatch('.rule1', [{name: 'width', value: '20px', important: true}], {layers: ['base']}),
        ruleMatch('.rule1', [{name: 'width', value: '10px', important: true}]),
      ]));

      assert.strictEqual(states.get('20px'), Active, 'layered important should win');
      assert.strictEqual(states.get('10px'), Overloaded, 'unlayered important should be overridden');
    });

    it('uses source order for important declarations in the same layer', () => {
      // Within a single layer the traditional rule applies: the later declaration wins.
      const states = statesByValue(computeMatchedStyles([
        ruleMatch('.rule1', [{name: 'width', value: '20px', important: true}], {layers: ['base']}),
        ruleMatch('.rule2', [{name: 'width', value: '10px', important: true}], {layers: ['base']}),
      ]));

      assert.strictEqual(states.get('10px'), Active, 'the later declaration in the same layer should win');
      assert.strictEqual(states.get('20px'), Overloaded, 'the earlier declaration in the same layer should lose');
    });
  });
});
