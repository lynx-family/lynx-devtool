// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/*
 * Copyright (C) 2011 Google Inc.  All rights reserved.
 * Copyright (C) 2007, 2008 Apple Inc.  All rights reserved.
 * Copyright (C) 2009 Joseph Pecoraro
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable rulesdir/no_underscored_properties */

import * as Common from '../../core/common/common.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as Platform from '../../core/platform/platform.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';
import * as Bindings from '../../models/bindings/bindings.js';
import type * as IssuesManager from '../../models/issues_manager/issues_manager.js';
import * as Logs from '../../models/logs/logs.js';
import * as TextUtils from '../../models/text_utils/text_utils.js';
import * as Workspace from '../../models/workspace/workspace.js';
import * as IssueCounter from '../../ui/components/issue_counter/issue_counter.js';
import * as RequestLinkIcon from '../../ui/components/request_link_icon/request_link_icon.js';
import * as DataGrid from '../../ui/legacy/components/data_grid/data_grid.js';
import * as ObjectUI from '../../ui/legacy/components/object_ui/object_ui.js';
import * as TextEditor from '../../ui/legacy/components/text_editor/text_editor.js';
import * as Components from '../../ui/legacy/components/utils/utils.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as ThemeSupport from '../../ui/legacy/theme_support/theme_support.js';

import type {ConsoleViewportElement} from './ConsoleViewport.js';

const UIStrings = {
  /**
  * @description Message element text content in Console View Message of the Console panel. Shown
  * when the user tried to run console.clear() but the 'Preserve log' option is enabled, which stops
  * the log from being cleared.
  */
  consoleclearWasPreventedDueTo: '`console.clear()` was prevented due to \'Preserve log\'',
  /**
  * @description Text shown in the Console panel after the user has cleared the console, which
  * removes all messages from the console so that it is empty.
  */
  consoleWasCleared: 'Console was cleared',
  /**
  *@description Message element title in Console View Message of the Console panel
  *@example {Ctrl+L} PH1
  */
  clearAllMessagesWithS: 'Clear all messages with {PH1}',
  /**
  *@description Message prefix in Console View Message of the Console panel
  */
  assertionFailed: 'Assertion failed: ',
  /**
  *@description Message text in Console View Message of the Console panel
  *@example {console.log(1)} PH1
  */
  violationS: '`[Violation]` {PH1}',
  /**
  *@description Message text in Console View Message of the Console panel
  *@example {console.log(1)} PH1
  */
  interventionS: '`[Intervention]` {PH1}',
  /**
  *@description Message text in Console View Message of the Console panel
  *@example {console.log(1)} PH1
  */
  deprecationS: '`[Deprecation]` {PH1}',
  /**
  *@description Note title in Console View Message of the Console panel
  */
  thisValueWillNotBeCollectedUntil: 'This value will not be collected until console is cleared.',
  /**
  *@description Note title in Console View Message of the Console panel
  */
  thisValueWasEvaluatedUponFirst: 'This value was evaluated upon first expanding. It may have changed since then.',
  /**
  *@description Note title in Console View Message of the Console panel
  */
  functionWasResolvedFromBound: 'Function was resolved from bound function.',
  /**
  * @description Shown in the Console panel when an exception is thrown when trying to access a
  * property on an object. Should be translated.
  */
  exception: '<exception>',
  /**
  *@description Text to indicate an item is a warning
  */
  warning: 'Warning',
  /**
  *@description Text for errors
  */
  error: 'Error',
  /**
  * @description Announced by the screen reader to indicate how many times a particular message in
  * the console was repeated.
  */
  repeatS: '{n, plural, =1 {Repeated # time} other {Repeated # times}}',
  /**
  * @description Announced by the screen reader to indicate how many times a particular warning
  * message in the console was repeated.
  */
  warningS: '{n, plural, =1 {Warning, Repeated # time} other {Warning, Repeated # times}}',
  /**
  * @description Announced by the screen reader to indicate how many times a particular error
  * message in the console was repeated.
  */
  errorS: '{n, plural, =1 {Error, Repeated # time} other {Error, Repeated # times}}',
  /**
  *@description Text appended to grouped console messages that are related to URL requests
  */
  url: '<URL>',
  /**
  *@description Text appended to grouped console messages about tasks that took longer than N ms
  */
  tookNms: 'took <N>ms',
  /**
  *@description Text appended to grouped console messages about tasks that are related to some DOM event
  */
  someEvent: '<some> event',
  /**
  *@description Text appended to grouped console messages about tasks that are related to a particular milestone
  */
  Mxx: ' M<XX>',
  /**
  *@description Text appended to grouped console messages about tasks that are related to autofill completions
  */
  attribute: '<attribute>',
  /**
  *@description Text for the index of something
  */
  index: '(index)',
  /**
  *@description Text for the value of something
  */
  value: 'Value',
  /**
  *@description Title of the Console tool
  */
  console: 'Console',
};
const str_ = i18n.i18n.registerUIStrings('panels/console/ConsoleViewMessage.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
const elementToMessage = new WeakMap<Element, ConsoleViewMessage>();

export const getMessageForElement = (element: Element): ConsoleViewMessage|undefined => {
  return elementToMessage.get(element);
};

// This value reflects the 18px min-height of .console-message, plus the
// 1px border of .console-message-wrapper. Keep in sync with consoleView.css.
const defaultConsoleRowHeight = 19;

const parameterToRemoteObject = (runtimeModel: SDK.RuntimeModel.RuntimeModel|null): (
    parameter?: SDK.RemoteObject.RemoteObject|Protocol.Runtime.RemoteObject|string) => SDK.RemoteObject.RemoteObject =>
    (parameter?: string|SDK.RemoteObject.RemoteObject|Protocol.Runtime.RemoteObject): SDK.RemoteObject.RemoteObject => {
      if (parameter instanceof SDK.RemoteObject.RemoteObject) {
        return parameter;
      }
      if (!runtimeModel) {
        return SDK.RemoteObject.RemoteObject.fromLocalObject(parameter);
      }
      if (typeof parameter === 'object') {
        return runtimeModel.createRemoteObject(parameter);
      }
      return runtimeModel.createRemoteObjectFromPrimitiveValue(parameter);
    };

export class ConsoleViewMessage implements ConsoleViewportElement {
  _message: SDK.ConsoleModel.ConsoleMessage;
  _linkifier: Components.Linkifier.Linkifier;
  _repeatCount: number;
  _closeGroupDecorationCount: number;
  _nestingLevel: number;
  _selectableChildren: {
    element: HTMLElement,
    forceSelect: () => void,
  }[];
  _messageResized: (arg0: Common.EventTarget.EventTargetEvent) => void;
  _element: HTMLElement|null;
  _previewFormatter: ObjectUI.RemoteObjectPreviewFormatter.RemoteObjectPreviewFormatter;
  _searchRegex: RegExp|null;
  _messageLevelIcon: UI.Icon.Icon|null;
  _traceExpanded: boolean;
  _expandTrace: ((arg0: boolean) => void)|null;
  _anchorElement: HTMLElement|null;
  _contentElement: HTMLElement|null;
  _nestingLevelMarkers: HTMLElement[]|null;
  _searchHighlightNodes: Element[];
  _searchHighlightNodeChanges: UI.UIUtils.HighlightChange[];
  _isVisible: boolean;
  _cachedHeight: number;
  _messagePrefix: string;
  _timestampElement: HTMLElement|null;
  _inSimilarGroup: boolean;
  _similarGroupMarker: HTMLElement|null;
  _lastInSimilarGroup: boolean;
  _groupKey: string;
  _repeatCountElement: UI.UIUtils.DevToolsSmallBubble|null;
  private requestResolver: Logs.RequestResolver.RequestResolver;
  private issueResolver: IssuesManager.IssueResolver.IssueResolver;
  private _isDevMode: boolean;


  constructor(
      consoleMessage: SDK.ConsoleModel.ConsoleMessage, linkifier: Components.Linkifier.Linkifier,
      requestResolver: Logs.RequestResolver.RequestResolver, issueResolver: IssuesManager.IssueResolver.IssueResolver,
      nestingLevel: number, onResize: (arg0: Common.EventTarget.EventTargetEvent) => void) {
    this._message = consoleMessage;
    this._linkifier = linkifier;
    this.requestResolver = requestResolver;
    this.issueResolver = issueResolver;
    this._repeatCount = 1;
    this._closeGroupDecorationCount = 0;
    this._nestingLevel = nestingLevel;
    this._selectableChildren = [];
    this._messageResized = onResize;
    this._element = null;

    this._previewFormatter = new ObjectUI.RemoteObjectPreviewFormatter.RemoteObjectPreviewFormatter();
    this._searchRegex = null;
    this._messageLevelIcon = null;
    this._traceExpanded = false;
    this._expandTrace = null;
    this._anchorElement = null;
    this._contentElement = null;
    this._nestingLevelMarkers = null;
    this._searchHighlightNodes = [];
    this._searchHighlightNodeChanges = [];
    this._isVisible = false;
    this._cachedHeight = 0;
    this._messagePrefix = '';
    this._timestampElement = null;
    this._inSimilarGroup = false;
    this._similarGroupMarker = null;
    this._lastInSimilarGroup = false;
    this._groupKey = '';
    this._repeatCountElement = null;

    this._isDevMode = new URLSearchParams(location.search).get('dev')?.split(':').includes('console') ?? false;
  }

  element(): HTMLElement {
    return this.toMessageElement();
  }

  wasShown(): void {
    this._isVisible = true;
  }

  onResize(): void {
  }

  willHide(): void {
    this._isVisible = false;
    this._cachedHeight = this.element().offsetHeight;
  }

  isVisible(): boolean {
    return this._isVisible;
  }

  fastHeight(): number {
    if (this._cachedHeight) {
      return this._cachedHeight;
    }
    return this.approximateFastHeight();
  }

  approximateFastHeight(): number {
    return defaultConsoleRowHeight;
  }

  consoleMessage(): SDK.ConsoleModel.ConsoleMessage {
    return this._message;
  }

  // TODO console
  _buildMessage(): HTMLElement {
    let messageElement;
    let messageText: Common.UIString.LocalizedString|string = this._message.messageText;
    if (this._message.source === SDK.ConsoleModel.FrontendMessageSource.ConsoleAPI) {
      switch (this._message.type) {
        case Protocol.Runtime.ConsoleAPICalledEventType.Trace:
          messageElement = this._format(this._message.parameters || ['console.trace']);
          break;
        case Protocol.Runtime.ConsoleAPICalledEventType.Clear:
          messageElement = document.createElement('span');
          messageElement.classList.add('console-info');
          if (Common.Settings.Settings.instance().moduleSetting('preserveConsoleLog').get()) {
            messageElement.textContent = i18nString(UIStrings.consoleclearWasPreventedDueTo);
          } else {
            messageElement.textContent = i18nString(UIStrings.consoleWasCleared);
          }
          UI.Tooltip.Tooltip.install(
              messageElement, i18nString(UIStrings.clearAllMessagesWithS, {
                PH1: String(UI.ShortcutRegistry.ShortcutRegistry.instance().shortcutTitleForAction('console.clear')),
              }));
          break;
        case Protocol.Runtime.ConsoleAPICalledEventType.Dir: {
          const obj = this._message.parameters ? this._message.parameters[0] : undefined;
          const args = ['%O', obj];
          messageElement = this._format(args);
          break;
        }
        case Protocol.Runtime.ConsoleAPICalledEventType.Profile:
        case Protocol.Runtime.ConsoleAPICalledEventType.ProfileEnd:
          messageElement = this._format([messageText]);
          break;
        default: {
          if (this._message.type === Protocol.Runtime.ConsoleAPICalledEventType.Assert) {
            this._messagePrefix = i18nString(UIStrings.assertionFailed);
          }
          if (this._message.parameters && this._message.parameters.length === 1) {
            const parameter = this._message.parameters[0];
            if (typeof parameter !== 'string' && parameter.type === 'string') {
              messageElement = this._tryFormatAsError((parameter.value as string));
            }
          }
          const args = this._message.parameters || [messageText];
          messageElement = messageElement || this._format(args);
        }
      }
    } else {
      if (this._message.source === Protocol.Log.LogEntrySource.Network) {
        messageElement = this._formatAsNetworkRequest() || this._format([messageText]);
      } else {
        const messageInParameters = this._message.parameters && messageText === (this._message.parameters[0] as string);
        // These terms are locked because the console message will not be translated anyway.
        if (this._message.source === Protocol.Log.LogEntrySource.Violation) {
          messageText = i18nString(UIStrings.violationS, {PH1: messageText});
        } else if (this._message.source === Protocol.Log.LogEntrySource.Intervention) {
          messageText = i18nString(UIStrings.interventionS, {PH1: messageText});
        } else if (this._message.source === Protocol.Log.LogEntrySource.Deprecation) {
          messageText = i18nString(UIStrings.deprecationS, {PH1: messageText});
        }
        const args = this._message.parameters || [messageText];
        if (messageInParameters) {
          args[0] = messageText;
        }
        messageElement = this._format(args);
      }
    }
    messageElement.classList.add('console-message-text');

    const formattedMessage = document.createElement('span');
    formattedMessage.classList.add('source-code');
    this._anchorElement = this._buildMessageAnchor();
    if (this._anchorElement) {
      formattedMessage.appendChild(this._anchorElement);
    }
    formattedMessage.appendChild(messageElement);
    return formattedMessage;
  }

  _formatAsNetworkRequest(): HTMLElement|null {
    const request = Logs.NetworkLog.NetworkLog.requestForConsoleMessage(this._message);
    if (!request) {
      return null;
    }
    const messageElement = document.createElement('span');
    if (this._message.level === Protocol.Log.LogEntryLevel.Error) {
      UI.UIUtils.createTextChild(messageElement, request.requestMethod + ' ');
      const linkElement = Components.Linkifier.Linkifier.linkifyRevealable(request, request.url(), request.url());
      // Focus is handled by the viewport.
      linkElement.tabIndex = -1;
      this._selectableChildren.push({element: linkElement, forceSelect: (): void => linkElement.focus()});
      messageElement.appendChild(linkElement);
      if (request.failed) {
        UI.UIUtils.createTextChildren(messageElement, ' ', request.localizedFailDescription || '');
      }
      if (request.statusCode !== 0) {
        UI.UIUtils.createTextChildren(messageElement, ' ', String(request.statusCode));
      }
      if (request.statusText) {
        UI.UIUtils.createTextChildren(messageElement, ' (', request.statusText, ')');
      }
    } else {
      const messageText = this._message.messageText;
      const fragment = this._linkifyWithCustomLinkifier(messageText, (text, url, lineNumber, columnNumber) => {
        const linkElement = url === request.url() ?
            Components.Linkifier.Linkifier.linkifyRevealable(
                (request as SDK.NetworkRequest.NetworkRequest), url, request.url()) :
            Components.Linkifier.Linkifier.linkifyURL(
                url, ({text, lineNumber, columnNumber, bypassURLTrimming: true} as Components.Linkifier.LinkifyURLOptions));
        // TODO byPassURULTrimming
        linkElement.tabIndex = -1;
        this._selectableChildren.push({element: linkElement, forceSelect: (): void => linkElement.focus()});
        return linkElement;
      });
      messageElement.appendChild(fragment);
    }
    return messageElement;
  }

  private createAffectedResourceLinks(): HTMLElement[] {
    const elements = [];
    const requestId = this._message.getAffectedResources()?.requestId;
    if (requestId) {
      const icon = new RequestLinkIcon.RequestLinkIcon.RequestLinkIcon();
      icon.classList.add('resource-links');
      icon.data = {
        affectedRequest: {requestId},
        requestResolver: this.requestResolver,
        displayURL: false,
      };
      elements.push(icon);
    }
    const issueId = this._message.getAffectedResources()?.issueId;
    if (issueId) {
      const icon = new IssueCounter.IssueLinkIcon.IssueLinkIcon();
      icon.classList.add('resource-links');
      icon.data = {issueId, issueResolver: this.issueResolver};
      elements.push(icon);
    }
    return elements;
  }

  _buildMessageAnchor(): HTMLElement|null {
    const linkify = (message: SDK.ConsoleModel.ConsoleMessage): HTMLElement|null => {
      if (message.scriptId) {
        return this._linkifyScriptId(message.scriptId, message.url || '', message.line, message.column);
      }
      if (message.stackTrace && message.stackTrace.callFrames.length) {
        return this._linkifyStackTraceTopFrame(message.stackTrace);
      }
      if (message.url && message.url !== 'undefined') {
        return this._linkifyLocation(message.url, message.line, message.column);
      }
      return null;
    };
    const anchorElement = linkify(this._message);
    // Append a space to prevent the anchor text from being glued to the console message when the user selects and copies the console messages.
    if (anchorElement) {
      anchorElement.tabIndex = -1;
      this._selectableChildren.push({
        element: anchorElement,
        forceSelect: (): void => anchorElement.focus(),
      });
      const anchorWrapperElement = document.createElement('span');
      anchorWrapperElement.classList.add('console-message-anchor');
      anchorWrapperElement.appendChild(anchorElement);

      for (const element of this.createAffectedResourceLinks()) {
        UI.UIUtils.createTextChild(anchorWrapperElement, ' ');
        anchorWrapperElement.append(element);
      }

      UI.UIUtils.createTextChild(anchorWrapperElement, ' ');
      return anchorWrapperElement;
    }
    return null;
  }

  _buildMessageWithStackTrace(runtimeModel: SDK.RuntimeModel.RuntimeModel): HTMLElement {
    const toggleElement = document.createElement('div');
    toggleElement.classList.add('console-message-stack-trace-toggle');
    const contentElement = toggleElement.createChild('div', 'console-message-stack-trace-wrapper');
    UI.ARIAUtils.markAsTree(contentElement);

    const messageElement = this._buildMessage();
    const icon = UI.Icon.Icon.create('smallicon-triangle-right', 'console-message-expand-icon');
    const clickableElement = contentElement.createChild('div');
    UI.ARIAUtils.markAsTreeitem(clickableElement);
    UI.ARIAUtils.setExpanded(clickableElement, false);
    clickableElement.appendChild(icon);
    // Intercept focus to avoid highlight on click.
    clickableElement.tabIndex = -1;
    clickableElement.appendChild(messageElement);
    const stackTraceElement = contentElement.createChild('div');
    const stackTracePreview = Components.JSPresentationUtils.buildStackTracePreviewContents(
        runtimeModel.target(), this._linkifier, {stackTrace: this._message.stackTrace, tabStops: undefined});
    stackTraceElement.appendChild(stackTracePreview.element);
    for (const linkElement of stackTracePreview.links) {
      this._selectableChildren.push({element: linkElement, forceSelect: (): void => linkElement.focus()});
    }
    stackTraceElement.classList.add('hidden');
    UI.ARIAUtils.markAsGroup(stackTraceElement);
    this._expandTrace = (expand: boolean): void => {
      icon.setIconType(expand ? 'smallicon-triangle-down' : 'smallicon-triangle-right');
      stackTraceElement.classList.toggle('hidden', !expand);
      UI.ARIAUtils.setExpanded(clickableElement, expand);
      this._traceExpanded = expand;
    };

    const toggleStackTrace = (event: Event): void => {
      if (UI.UIUtils.isEditing() || contentElement.hasSelection()) {
        return;
      }
      this._expandTrace && this._expandTrace(stackTraceElement.classList.contains('hidden'));
      event.consume();
    };

    clickableElement.addEventListener('click', toggleStackTrace, false);
    if (this._message.type === Protocol.Runtime.ConsoleAPICalledEventType.Trace) {
      this._expandTrace(true);
    }

    // @ts-ignore
    toggleElement._expandStackTraceForTest = this._expandTrace.bind(this, true);
    return toggleElement;
  }

  _linkifyLocation(url: string, lineNumber: number, columnNumber: number): HTMLElement|null {
    const runtimeModel = this._message.runtimeModel();
    if (!runtimeModel) {
      return null;
    }
    return this._linkifier.linkifyScriptLocation(
        runtimeModel.target(), /* scriptId */ null, url, lineNumber,
        {columnNumber, className: undefined, tabStop: undefined, inlineFrameIndex: 0});
  }

  _linkifyStackTraceTopFrame(stackTrace: Protocol.Runtime.StackTrace): HTMLElement|null {
    const runtimeModel = this._message.runtimeModel();
    if (!runtimeModel) {
      return null;
    }
    return this._linkifier.linkifyStackTraceTopFrame(runtimeModel.target(), stackTrace);
  }

  _linkifyScriptId(scriptId: string, url: string, lineNumber: number, columnNumber: number): HTMLElement|null {
    const runtimeModel = this._message.runtimeModel();
    if (!runtimeModel) {
      return null;
    }
    return this._linkifier.linkifyScriptLocation(
        runtimeModel.target(), scriptId, url, lineNumber,
        {columnNumber, className: undefined, tabStop: undefined, inlineFrameIndex: 0});
  }

  // TODO console
  _format(rawParameters: (string|SDK.RemoteObject.RemoteObject|Protocol.Runtime.RemoteObject|undefined)[]):
      HTMLElement {
    // This node is used like a Builder. Values are continually appended onto it.
    const formattedResult = document.createElement('span');

    // dev mode message has more info
    if (this._isDevMode) {
      const { consoleId, viewId, groupId, consoleTag } = this._message.identities;
      const { tag } = this._message;
      formattedResult.createChild('span').textContent = [
        `[consoleId] ${consoleId}\t`,
        `[viewId] ${viewId}\t`,
        `[groupId] ${groupId}\t`,
        `[consoleTag] ${consoleTag}\t`,
        `[logTag] ${tag}`,
        '\n'
      ].join('');
    }

    if (this._messagePrefix) {
      formattedResult.createChild('span').textContent = this._messagePrefix;
    }
    if (!rawParameters.length) {
      return formattedResult;
    }

    // Formatting code below assumes that parameters are all wrappers whereas frontend console
    // API allows passing arbitrary values as messages (strings, numbers, etc.). Wrap them here.
    // FIXME: Only pass runtime wrappers here.
    let parameters = rawParameters.map(parameterToRemoteObject(this._message.runtimeModel()));

    // There can be string log and string eval result. We distinguish between them based on message type.
    const shouldFormatMessage =
        SDK.RemoteObject.RemoteObject.type((parameters as SDK.RemoteObject.RemoteObject[])[0]) === 'string' &&
        (this._message.type !== SDK.ConsoleModel.FrontendMessageType.Result ||
         this._message.level === Protocol.Log.LogEntryLevel.Error);

    // Multiple parameters with the first being a format string. Save unused substitutions.
    if (shouldFormatMessage) {
      const result = this._formatWithSubstitutionString(
          (parameters[0].description as string), parameters.slice(1), formattedResult);
      parameters = Array.from(result.unusedSubstitutions || []);
      if (parameters.length) {
        UI.UIUtils.createTextChild(formattedResult, ' ');
      }
    }

    // Single parameter, or unused substitutions from above.
    for (let i = 0; i < parameters.length; ++i) {
      // Inline strings when formatting.
      if (shouldFormatMessage && parameters[i].type === 'string') {
        formattedResult.appendChild(this._linkifyStringAsFragment(parameters[i].description || ''));
      } else {
        formattedResult.appendChild(this._formatParameter(parameters[i], false, true));
      }
      if (i < parameters.length - 1) {
        UI.UIUtils.createTextChild(formattedResult, ' ');
      }
    }
    return formattedResult;
  }

  _formatParameter(output: SDK.RemoteObject.RemoteObject, forceObjectFormat?: boolean, includePreview?: boolean):
      HTMLElement {
    if (output.customPreview()) {
      return new ObjectUI.CustomPreviewComponent.CustomPreviewComponent(output).element as HTMLElement;
    }

    const outputType = forceObjectFormat ? 'object' : (output.subtype || output.type);
    let element;
    switch (outputType) {
      case 'error':
        element = this._formatParameterAsError(output);
        break;
      case 'function':
        element = this._formatParameterAsFunction(output, includePreview);
        break;
      case 'array':
      case 'arraybuffer':
      case 'blob':
      case 'dataview':
      case 'generator':
      case 'iterator':
      case 'map':
      case 'object':
      case 'promise':
      case 'proxy':
      case 'set':
      case 'typedarray':
      case 'wasmvalue':
      case 'weakmap':
      case 'weakset':
      case 'webassemblymemory':
        element = this._formatParameterAsObject(output, includePreview);
        break;
      case 'node':
        element = output.isNode() ? this._formatParameterAsNode(output) : this._formatParameterAsObject(output, false);
        break;
      case 'trustedtype':
        element = this._formatParameterAsObject(output, false);
        break;
      case 'string':
        element = this._formatParameterAsString(output);
        break;
      case 'boolean':
      case 'date':
      case 'null':
      case 'number':
      case 'regexp':
      case 'symbol':
      case 'undefined':
      case 'bigint':
        element = this._formatParameterAsValue(output);
        break;
      default:
        element = this._formatParameterAsValue(output);
        console.error(`Tried to format remote object of unknown type ${outputType}.`);
    }
    element.classList.add(`object-value-${outputType}`);
    element.classList.add('source-code');
    return element;
  }

  _formatParameterAsValue(obj: SDK.RemoteObject.RemoteObject): HTMLElement {
    const result = document.createElement('span');
    const description = obj.description || '';
    if (description.length > getMaxTokenizableStringLength()) {
      const propertyValue = new ObjectUI.ObjectPropertiesSection.ExpandableTextPropertyValue(
          document.createElement('span'), description, getLongStringVisibleLength());
      result.appendChild(propertyValue.element);
    } else {
      UI.UIUtils.createTextChild(result, description);
    }
    result.addEventListener('contextmenu', this._contextMenuEventFired.bind(this, obj), false);
    return result;
  }

  _formatParameterAsTrustedType(obj: SDK.RemoteObject.RemoteObject): HTMLElement {
    const result = document.createElement('span');
    const trustedContentSpan = document.createElement('span');
    trustedContentSpan.appendChild(this._formatParameterAsString(obj));
    trustedContentSpan.classList.add('object-value-string');
    UI.UIUtils.createTextChild(result, `${obj.className} `);
    result.appendChild(trustedContentSpan);
    return result;
  }

  _formatParameterAsObject(obj: SDK.RemoteObject.RemoteObject, includePreview?: boolean): HTMLElement {
    const titleElement = document.createElement('span');
    titleElement.classList.add('console-object');
    if (includePreview && obj.preview) {
      titleElement.classList.add('console-object-preview');
      this._previewFormatter.appendObjectPreview(titleElement, obj.preview, false /* isEntry */);
    } else if (obj.type === 'function') {
      const functionElement = titleElement.createChild('span');
      ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection.formatObjectAsFunction(obj, functionElement, false);
      titleElement.classList.add('object-value-function');
    } else if (obj.subtype === 'trustedtype') {
      titleElement.appendChild(this._formatParameterAsTrustedType(obj));
    } else {
      UI.UIUtils.createTextChild(titleElement, obj.description || '');
    }

    if (!obj.hasChildren || obj.customPreview()) {
      return titleElement;
    }

    const note = titleElement.createChild('span', 'object-state-note info-note');
    if (this._message.type === SDK.ConsoleModel.FrontendMessageType.QueryObjectResult) {
      UI.Tooltip.Tooltip.install(note, i18nString(UIStrings.thisValueWillNotBeCollectedUntil));
    } else {
      UI.Tooltip.Tooltip.install(note, i18nString(UIStrings.thisValueWasEvaluatedUponFirst));
    }

    const section = new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection(obj, titleElement, this._linkifier);
    section.element.classList.add('console-view-object-properties-section');
    section.enableContextMenu();
    section.setShowSelectionOnKeyboardFocus(true, true);
    this._selectableChildren.push(section);
    section.addEventListener(UI.TreeOutline.Events.ElementAttached, this._messageResized);
    section.addEventListener(UI.TreeOutline.Events.ElementExpanded, this._messageResized);
    section.addEventListener(UI.TreeOutline.Events.ElementCollapsed, this._messageResized);
    return section.element;
  }

  _formatParameterAsFunction(func: SDK.RemoteObject.RemoteObject, includePreview?: boolean): HTMLElement {
    const result = document.createElement('span');
    SDK.RemoteObject.RemoteFunction.objectAsFunction(func).targetFunction().then(formatTargetFunction.bind(this));
    return result;

    function formatTargetFunction(this: ConsoleViewMessage, targetFunction: SDK.RemoteObject.RemoteObject): void {
      const functionElement = document.createElement('span');
      const promise = ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection.formatObjectAsFunction(
          targetFunction, functionElement, true, includePreview);
      result.appendChild(functionElement);
      if (targetFunction !== func) {
        const note = result.createChild('span', 'object-info-state-note');
        UI.Tooltip.Tooltip.install(note, i18nString(UIStrings.functionWasResolvedFromBound));
      }
      result.addEventListener('contextmenu', this._contextMenuEventFired.bind(this, targetFunction), false);
      promise.then(() => this._formattedParameterAsFunctionForTest());
    }
  }

  _formattedParameterAsFunctionForTest(): void {
  }

  _contextMenuEventFired(obj: SDK.RemoteObject.RemoteObject, event: Event): void {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    contextMenu.appendApplicableItems(obj);
    contextMenu.show();
  }

  _renderPropertyPreviewOrAccessor(
      object: SDK.RemoteObject.RemoteObject|null, property: Protocol.Runtime.PropertyPreview, propertyPath: {
        name: (string|symbol),
      }[]): HTMLElement {
    if (property.type === 'accessor') {
      return this._formatAsAccessorProperty(object, propertyPath.map(property => property.name.toString()), false);
    }
    return this._previewFormatter.renderPropertyPreview(
        property.type, 'subtype' in property ? property.subtype : undefined, null, property.value);
  }

  _formatParameterAsNode(remoteObject: SDK.RemoteObject.RemoteObject): HTMLElement {
    const result = document.createElement('span');

    const domModel = remoteObject.runtimeModel().target().model(SDK.DOMModel.DOMModel);
    if (!domModel) {
      return result;
    }
    domModel.pushObjectAsNodeToFrontend(remoteObject).then(async (node: SDK.DOMModel.DOMNode|null) => {
      if (!node) {
        result.appendChild(this._formatParameterAsObject(remoteObject, false));
        return;
      }
      const renderResult = await UI.UIUtils.Renderer.render((node as Object));
      if (renderResult) {
        if (renderResult.tree) {
          this._selectableChildren.push(renderResult.tree);
          renderResult.tree.addEventListener(UI.TreeOutline.Events.ElementAttached, this._messageResized);
          renderResult.tree.addEventListener(UI.TreeOutline.Events.ElementExpanded, this._messageResized);
          renderResult.tree.addEventListener(UI.TreeOutline.Events.ElementCollapsed, this._messageResized);
        }
        result.appendChild(renderResult.node);
      } else {
        result.appendChild(this._formatParameterAsObject(remoteObject, false));
      }
      this._formattedParameterAsNodeForTest();
    });

    return result;
  }

  _formattedParameterAsNodeForTest(): void {
  }

  _formatParameterAsString(output: SDK.RemoteObject.RemoteObject): HTMLElement {
    const description = output.description ?? '';
    const text = Platform.StringUtilities.formatAsJSLiteral(description);
    const result = document.createElement('span');
    result.addEventListener('contextmenu', this._contextMenuEventFired.bind(this, output), false);
    result.appendChild(this._linkifyStringAsFragment(text));
    return result;
  }

  _formatParameterAsError(output: SDK.RemoteObject.RemoteObject): HTMLElement {
    const result = document.createElement('span');
    const errorSpan = this._tryFormatAsError(output.description || '');
    result.appendChild(errorSpan ? errorSpan : this._linkifyStringAsFragment(output.description || ''));
    return result;
  }

  _formatAsArrayEntry(output: SDK.RemoteObject.RemoteObject): HTMLElement {
    return this._previewFormatter.renderPropertyPreview(
        output.type, output.subtype, output.className, output.description);
  }

  _formatAsAccessorProperty(object: SDK.RemoteObject.RemoteObject|null, propertyPath: string[], isArrayEntry: boolean):
      HTMLElement {
    const rootElement =
        ObjectUI.ObjectPropertiesSection.ObjectPropertyTreeElement.createRemoteObjectAccessorPropertySpan(
            object, propertyPath, onInvokeGetterClick.bind(this));

    function onInvokeGetterClick(this: ConsoleViewMessage, result: SDK.RemoteObject.CallFunctionResult): void {
      const wasThrown = result.wasThrown;
      const object = result.object;
      if (!object) {
        return;
      }
      rootElement.removeChildren();
      if (wasThrown) {
        const element = rootElement.createChild('span');
        element.textContent = i18nString(UIStrings.exception);
        UI.Tooltip.Tooltip.install(element, (object.description as string));
      } else if (isArrayEntry) {
        rootElement.appendChild(this._formatAsArrayEntry(object));
      } else {
        // Make a PropertyPreview from the RemoteObject similar to the backend logic.
        const maxLength = 100;
        const type = object.type;
        const subtype = object.subtype;
        let description = '';
        if (type !== 'function' && object.description) {
          if (type === 'string' || subtype === 'regexp' || subtype === 'trustedtype') {
            description = Platform.StringUtilities.trimMiddle(object.description, maxLength);
          } else {
            description = Platform.StringUtilities.trimEndWithMaxLength(object.description, maxLength);
          }
        }
        rootElement.appendChild(
            this._previewFormatter.renderPropertyPreview(type, subtype, object.className, description));
      }
    }

    return rootElement;
  }

  // TODO console
  _formatWithSubstitutionString(
      format: string, parameters: SDK.RemoteObject.RemoteObject[], formattedResult: HTMLElement): {
    formattedResult: Element,
    unusedSubstitutions: ArrayLike<SDK.RemoteObject.RemoteObject>|null,
  } {
    function parameterFormatter(
        this: ConsoleViewMessage, force: boolean, includePreview: boolean,
        obj?: string|SDK.RemoteObject.RemoteObject): string|HTMLElement|undefined {
      if (obj instanceof SDK.RemoteObject.RemoteObject) {
        return this._formatParameter(obj, force, includePreview);
      }
      return stringFormatter(obj);
    }

    function stringFormatter(obj?: string|SDK.RemoteObject.RemoteObject): string|undefined {
      if (obj === undefined) {
        return undefined;
      }
      if (typeof obj === 'string') {
        return obj;
      }
      return obj.description;
    }

    function floatFormatter(obj?: string|SDK.RemoteObject.RemoteObject): number|string|undefined {
      if (obj instanceof SDK.RemoteObject.RemoteObject) {
        if (typeof obj.value !== 'number') {
          return 'NaN';
        }
        return obj.value;
      }
      return undefined;
    }

    function integerFormatter(obj?: string|SDK.RemoteObject.RemoteObject): string|number|undefined {
      if (obj instanceof SDK.RemoteObject.RemoteObject) {
        if (obj.type === 'bigint') {
          return obj.description;
        }
        if (typeof obj.value !== 'number') {
          return 'NaN';
        }
        return Math.floor(obj.value);
      }
      return undefined;
    }

    function bypassFormatter(obj?: string|SDK.RemoteObject.RemoteObject): Node|string {
      return (obj instanceof Node) ? obj : '';
    }

    let currentStyle: Map<string, {value: string, priority: string}>|null = null;
    function styleFormatter(obj?: string|SDK.RemoteObject.RemoteObject): void {
      currentStyle = new Map();
      const buffer = document.createElement('span');
      if (obj === undefined) {
        return;
      }
      if (typeof obj === 'string' || !obj.description) {
        return;
      }
      buffer.setAttribute('style', obj.description);
      for (const property of buffer.style) {
        if (isAllowedProperty(property)) {
          const info = {
            value: buffer.style.getPropertyValue(property),
            priority: buffer.style.getPropertyPriority(property),
          };
          currentStyle.set(property, info);
        }
      }
    }

    function isAllowedProperty(property: string): boolean {
      // Make sure that allowed properties do not interfere with link visibility.
      const prefixes = [
        'background',
        'border',
        'color',
        'font',
        'line',
        'margin',
        'padding',
        'text',
        '-webkit-background',
        '-webkit-border',
        '-webkit-font',
        '-webkit-margin',
        '-webkit-padding',
        '-webkit-text',
      ];
      for (const prefix of prefixes) {
        if (property.startsWith(prefix)) {
          return true;
        }
      }
      return false;
    }

    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatters: Record<string, Platform.StringUtilities.FormatterFunction<any>> = {};
    // Firebug uses %o for formatting objects.
    formatters.o = parameterFormatter.bind(this, false /* force */, true /* includePreview */);
    formatters.s = stringFormatter;
    formatters.f = floatFormatter;
    // Firebug allows both %i and %d for formatting integers.
    formatters.i = integerFormatter;
    formatters.d = integerFormatter;

    // Firebug uses %c for styling the message.
    formatters.c = styleFormatter;

    // Support %O to force object formatting, instead of the type-based %o formatting.
    formatters.O = parameterFormatter.bind(this, true /* force */, false /* includePreview */);

    formatters._ = bypassFormatter;

    function append(this: ConsoleViewMessage, a: HTMLElement, b?: string|Node): HTMLElement {
      if (b instanceof Node) {
        a.appendChild(b);
        return a;
      }
      if (typeof b === 'undefined') {
        return a;
      }
      if (!currentStyle) {
        a.appendChild(this._linkifyStringAsFragment(String(b)));
        return a;
      }
      const lines = String(b).split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineFragment = this._linkifyStringAsFragment(line);
        const wrapper = document.createElement('span');
        wrapper.style.setProperty('contain', 'paint');
        wrapper.style.setProperty('display', 'inline-block');
        wrapper.style.setProperty('max-width', '100%');
        wrapper.appendChild(lineFragment);
        applyCurrentStyle(wrapper);
        for (const child of wrapper.children) {
          if (child.classList.contains('devtools-link') && child instanceof HTMLElement) {
            this._applyForcedVisibleStyle(child);
          }
        }
        a.appendChild(wrapper);
        if (i < lines.length - 1) {
          a.appendChild(document.createElement('br'));
        }
      }
      return a;
    }

    function applyCurrentStyle(element: HTMLElement): void {
      if (!currentStyle) {
        return;
      }
      for (const [property, {value, priority}] of currentStyle.entries()) {
        element.style.setProperty((property as string), value, priority);
      }
    }

    // Platform.StringUtilities.format does treat formattedResult like a Builder, result is an object.
    return Platform.StringUtilities.format(format, parameters, formatters, formattedResult, append.bind(this));
  }

  _applyForcedVisibleStyle(element: HTMLElement): void {
    element.style.setProperty('-webkit-text-stroke', '0', 'important');
    element.style.setProperty('text-decoration', 'underline', 'important');

    const themedColor = ThemeSupport.ThemeSupport.instance().patchColorText(
        'rgb(33%, 33%, 33%)', ThemeSupport.ThemeSupport.ColorUsage.Foreground);
    element.style.setProperty('color', themedColor, 'important');

    let backgroundColor = 'hsl(0, 0%, 100%)';
    if (this._message.level === Protocol.Log.LogEntryLevel.Error) {
      backgroundColor = 'hsl(0, 100%, 97%)';
    } else if (this._message.level === Protocol.Log.LogEntryLevel.Warning || this._shouldRenderAsWarning()) {
      backgroundColor = 'hsl(50, 100%, 95%)';
    }
    const themedBackgroundColor = ThemeSupport.ThemeSupport.instance().patchColorText(
        backgroundColor, ThemeSupport.ThemeSupport.ColorUsage.Background);
    element.style.setProperty('background-color', themedBackgroundColor, 'important');
  }

  matchesFilterRegex(regexObject: RegExp): boolean {
    regexObject.lastIndex = 0;
    const contentElement = this.contentElement();
    const anchorText = this._anchorElement ? this._anchorElement.deepTextContent() : '';
    return (Boolean(anchorText) && regexObject.test(anchorText.trim())) ||
        regexObject.test(contentElement.deepTextContent().slice(anchorText.length));
  }

  matchesFilterText(filter: string): boolean {
    const text = this.contentElement().deepTextContent();
    return text.toLowerCase().includes(filter.toLowerCase());
  }

  updateTimestamp(): void {
    if (!this._contentElement) {
      return;
    }

    if (Common.Settings.Settings.instance().moduleSetting('consoleTimestampsEnabled').get()) {
      if (!this._timestampElement) {
        this._timestampElement = document.createElement('span');
        this._timestampElement.classList.add('console-timestamp');
      }
      this._timestampElement.textContent = UI.UIUtils.formatTimestamp(this._message.timestamp, false) + ' ';
      UI.Tooltip.Tooltip.install(this._timestampElement, UI.UIUtils.formatTimestamp(this._message.timestamp, true));
      this._contentElement.insertBefore(this._timestampElement, this._contentElement.firstChild);
    } else if (this._timestampElement) {
      this._timestampElement.remove();
      this._timestampElement = null;
    }
  }

  nestingLevel(): number {
    return this._nestingLevel;
  }

  setInSimilarGroup(inSimilarGroup: boolean, isLast?: boolean): void {
    this._inSimilarGroup = inSimilarGroup;
    this._lastInSimilarGroup = inSimilarGroup && Boolean(isLast);
    if (this._similarGroupMarker && !inSimilarGroup) {
      this._similarGroupMarker.remove();
      this._similarGroupMarker = null;
    } else if (this._element && !this._similarGroupMarker && inSimilarGroup) {
      this._similarGroupMarker = document.createElement('div');
      this._similarGroupMarker.classList.add('nesting-level-marker');
      this._element.insertBefore(this._similarGroupMarker, this._element.firstChild);
      this._similarGroupMarker.classList.toggle('group-closed', this._lastInSimilarGroup);
    }
  }

  isLastInSimilarGroup(): boolean {
    return Boolean(this._inSimilarGroup) && Boolean(this._lastInSimilarGroup);
  }

  resetCloseGroupDecorationCount(): void {
    if (!this._closeGroupDecorationCount) {
      return;
    }
    this._closeGroupDecorationCount = 0;
    this._updateCloseGroupDecorations();
  }

  incrementCloseGroupDecorationCount(): void {
    ++this._closeGroupDecorationCount;
    this._updateCloseGroupDecorations();
  }

  _updateCloseGroupDecorations(): void {
    if (!this._nestingLevelMarkers) {
      return;
    }
    for (let i = 0, n = this._nestingLevelMarkers.length; i < n; ++i) {
      const marker = this._nestingLevelMarkers[i];
      marker.classList.toggle('group-closed', n - i <= this._closeGroupDecorationCount);
    }
  }

  _focusedChildIndex(): number {
    if (!this._selectableChildren.length) {
      return -1;
    }
    return this._selectableChildren.findIndex(child => child.element.hasFocus());
  }

  _onKeyDown(event: KeyboardEvent): void {
    if (UI.UIUtils.isEditing() || !this._element || !this._element.hasFocus() || this._element.hasSelection()) {
      return;
    }
    if (this.maybeHandleOnKeyDown(event)) {
      event.consume(true);
    }
  }

  maybeHandleOnKeyDown(event: KeyboardEvent): boolean {
    // Handle trace expansion.
    const focusedChildIndex = this._focusedChildIndex();
    const isWrapperFocused = focusedChildIndex === -1;
    if (this._expandTrace && isWrapperFocused) {
      if ((event.key === 'ArrowLeft' && this._traceExpanded) || (event.key === 'ArrowRight' && !this._traceExpanded)) {
        this._expandTrace(!this._traceExpanded);
        return true;
      }
    }
    if (!this._selectableChildren.length) {
      return false;
    }

    if (event.key === 'ArrowLeft') {
      this._element && this._element.focus();
      return true;
    }
    if (event.key === 'ArrowRight') {
      if (isWrapperFocused && this._selectNearestVisibleChild(0)) {
        return true;
      }
    }
    if (event.key === 'ArrowUp') {
      const firstVisibleChild = this._nearestVisibleChild(0);
      if (this._selectableChildren[focusedChildIndex] === firstVisibleChild && firstVisibleChild) {
        this._element && this._element.focus();
        return true;
      }
      if (this._selectNearestVisibleChild(focusedChildIndex - 1, true /* backwards */)) {
        return true;
      }
    }
    if (event.key === 'ArrowDown') {
      if (isWrapperFocused && this._selectNearestVisibleChild(0)) {
        return true;
      }
      if (!isWrapperFocused && this._selectNearestVisibleChild(focusedChildIndex + 1)) {
        return true;
      }
    }
    return false;
  }

  _selectNearestVisibleChild(fromIndex: number, backwards?: boolean): boolean {
    const nearestChild = this._nearestVisibleChild(fromIndex, backwards);
    if (nearestChild) {
      nearestChild.forceSelect();
      return true;
    }
    return false;
  }

  _nearestVisibleChild(fromIndex: number, backwards?: boolean): {
    element: Element,
    forceSelect: () => void,
  }|null {
    const childCount = this._selectableChildren.length;
    if (fromIndex < 0 || fromIndex >= childCount) {
      return null;
    }
    const direction = backwards ? -1 : 1;
    let index = fromIndex;

    while (!this._selectableChildren[index].element.offsetParent) {
      index += direction;
      if (index < 0 || index >= childCount) {
        return null;
      }
    }
    return this._selectableChildren[index];
  }

  focusLastChildOrSelf(): void {
    if (this._element && !this._selectNearestVisibleChild(this._selectableChildren.length - 1, true /* backwards */)) {
      this._element.focus();
    }
  }

  setContentElement(element: HTMLElement): void {
    console.assert(!this._contentElement, 'Cannot set content element twice');
    this._contentElement = element;
  }

  getContentElement(): HTMLElement|null {
    return this._contentElement;
  }

  contentElement(): HTMLElement {
    if (this._contentElement) {
      return this._contentElement;
    }

    const contentElement = document.createElement('div');
    contentElement.classList.add('console-message');
    if (this._messageLevelIcon) {
      contentElement.appendChild(this._messageLevelIcon);
    }
    this._contentElement = contentElement;

    const runtimeModel = this._message.runtimeModel();
    let formattedMessage;
    const shouldIncludeTrace = Boolean(this._message.stackTrace) &&
        (this._message.source === Protocol.Log.LogEntrySource.Network ||
         this._message.source === Protocol.Log.LogEntrySource.Violation ||
         this._message.level === Protocol.Log.LogEntryLevel.Error ||
         this._message.level === Protocol.Log.LogEntryLevel.Warning ||
         this._message.type === Protocol.Runtime.ConsoleAPICalledEventType.Trace);
    if (runtimeModel && shouldIncludeTrace) {
      formattedMessage = this._buildMessageWithStackTrace(runtimeModel);
    } else {
      formattedMessage = this._buildMessage();
    }
    contentElement.appendChild(formattedMessage);

    this.updateTimestamp();
    return this._contentElement;
  }

  toMessageElement(): HTMLElement {
    if (this._element) {
      return this._element;
    }
    this._element = document.createElement('div');
    this._element.tabIndex = -1;
    this._element.addEventListener('keydown', (this._onKeyDown.bind(this) as EventListener));
    this.updateMessageElement();
    return this._element;
  }

  updateMessageElement(): void {
    if (!this._element) {
      return;
    }

    this._element.className = 'console-message-wrapper';
    this._element.removeChildren();
    if (this._message.isGroupStartMessage()) {
      this._element.classList.add('console-group-title');
    }
    if (this._message.source === SDK.ConsoleModel.FrontendMessageSource.ConsoleAPI) {
      this._element.classList.add('console-from-api');
    }
    if (this._inSimilarGroup) {
      this._similarGroupMarker = (this._element.createChild('div', 'nesting-level-marker') as HTMLElement);
      this._similarGroupMarker.classList.toggle('group-closed', this._lastInSimilarGroup);
    }

    this._nestingLevelMarkers = [];
    for (let i = 0; i < this._nestingLevel; ++i) {
      this._nestingLevelMarkers.push(this._element.createChild('div', 'nesting-level-marker'));
    }
    this._updateCloseGroupDecorations();
    elementToMessage.set(this._element, this);

    switch (this._message.level) {
      case Protocol.Log.LogEntryLevel.Verbose:
        this._element.classList.add('console-verbose-level');
        break;
      case Protocol.Log.LogEntryLevel.Info:
        this._element.classList.add('console-info-level');
        if (this._message.type === SDK.ConsoleModel.FrontendMessageType.System) {
          this._element.classList.add('console-system-type');
        }
        break;
      case Protocol.Log.LogEntryLevel.Warning:
        this._element.classList.add('console-warning-level');
        break;
      case Protocol.Log.LogEntryLevel.Error:
        this._element.classList.add('console-error-level');
        break;
    }
    this._updateMessageLevelIcon();
    if (this._shouldRenderAsWarning()) {
      this._element.classList.add('console-warning-level');
    }

    this._element.appendChild(this.contentElement());
    if (this._repeatCount > 1) {
      this._showRepeatCountElement();
    }
  }

  _shouldRenderAsWarning(): boolean {
    return (this._message.level === Protocol.Log.LogEntryLevel.Verbose ||
            this._message.level === Protocol.Log.LogEntryLevel.Info) &&
        (this._message.source === Protocol.Log.LogEntrySource.Violation ||
         this._message.source === Protocol.Log.LogEntrySource.Deprecation ||
         this._message.source === Protocol.Log.LogEntrySource.Intervention ||
         this._message.source === Protocol.Log.LogEntrySource.Recommendation);
  }

  _updateMessageLevelIcon(): void {
    let iconType = '';
    let accessibleName = '';
    if (this._message.level === Protocol.Log.LogEntryLevel.Warning) {
      iconType = 'smallicon-warning';
      accessibleName = i18nString(UIStrings.warning);
    } else if (this._message.level === Protocol.Log.LogEntryLevel.Error) {
      iconType = 'smallicon-error';
      accessibleName = i18nString(UIStrings.error);
    }
    if (!this._messageLevelIcon) {
      if (!iconType) {
        return;
      }
      this._messageLevelIcon = UI.Icon.Icon.create('', 'message-level-icon');
      if (this._contentElement) {
        this._contentElement.insertBefore(this._messageLevelIcon, this._contentElement.firstChild);
      }
    }
    this._messageLevelIcon.setIconType(iconType);
    UI.ARIAUtils.setAccessibleName(this._messageLevelIcon, accessibleName);
  }

  repeatCount(): number {
    return this._repeatCount || 1;
  }

  resetIncrementRepeatCount(): void {
    this._repeatCount = 1;
    if (!this._repeatCountElement) {
      return;
    }

    this._repeatCountElement.remove();
    if (this._contentElement) {
      this._contentElement.classList.remove('repeated-message');
    }
    this._repeatCountElement = null;
  }

  incrementRepeatCount(): void {
    this._repeatCount++;
    this._showRepeatCountElement();
  }

  setRepeatCount(repeatCount: number): void {
    this._repeatCount = repeatCount;
    this._showRepeatCountElement();
  }
  _showRepeatCountElement(): void {
    if (!this._element) {
      return;
    }

    if (!this._repeatCountElement) {
      this._repeatCountElement =
          (document.createElement('span', {is: 'dt-small-bubble'}) as UI.UIUtils.DevToolsSmallBubble);
      this._repeatCountElement.classList.add('console-message-repeat-count');
      switch (this._message.level) {
        case Protocol.Log.LogEntryLevel.Warning:
          this._repeatCountElement.type = 'warning';
          break;
        case Protocol.Log.LogEntryLevel.Error:
          this._repeatCountElement.type = 'error';
          break;
        case Protocol.Log.LogEntryLevel.Verbose:
          this._repeatCountElement.type = 'verbose';
          break;
        default:
          this._repeatCountElement.type = 'info';
      }
      if (this._shouldRenderAsWarning()) {
        this._repeatCountElement.type = 'warning';
      }

      this._element.insertBefore(this._repeatCountElement, this._contentElement);
      this.contentElement().classList.add('repeated-message');
    }
    this._repeatCountElement.textContent = `${this._repeatCount}`;

    let accessibleName;
    if (this._message.level === Protocol.Log.LogEntryLevel.Warning) {
      accessibleName = i18nString(UIStrings.warningS, {n: this._repeatCount});
    } else if (this._message.level === Protocol.Log.LogEntryLevel.Error) {
      accessibleName = i18nString(UIStrings.errorS, {n: this._repeatCount});
    } else {
      accessibleName = i18nString(UIStrings.repeatS, {n: this._repeatCount});
    }
    UI.ARIAUtils.setAccessibleName(this._repeatCountElement, accessibleName);
  }

  get text(): string {
    return this._message.messageText;
  }

  toExportString(): string {
    const lines = [];
    const nodes = this.contentElement().childTextNodes();
    const messageContent = nodes.map(Components.Linkifier.Linkifier.untruncatedNodeText).join('');
    for (let i = 0; i < this.repeatCount(); ++i) {
      lines.push(messageContent);
    }
    return lines.join('\n');
  }

  setSearchRegex(regex: RegExp|null): void {
    if (this._searchHighlightNodeChanges && this._searchHighlightNodeChanges.length) {
      UI.UIUtils.revertDomChanges(this._searchHighlightNodeChanges);
    }
    this._searchRegex = regex;
    this._searchHighlightNodes = [];
    this._searchHighlightNodeChanges = [];
    if (!this._searchRegex) {
      return;
    }

    const text = this.contentElement().deepTextContent();
    let match;
    this._searchRegex.lastIndex = 0;
    const sourceRanges = [];
    while ((match = this._searchRegex.exec(text)) && match[0]) {
      sourceRanges.push(new TextUtils.TextRange.SourceRange(match.index, match[0].length));
    }

    if (sourceRanges.length) {
      this._searchHighlightNodes =
          UI.UIUtils.highlightSearchResults(this.contentElement(), sourceRanges, this._searchHighlightNodeChanges);
    }
  }

  searchRegex(): RegExp|null {
    return this._searchRegex;
  }

  searchCount(): number {
    return this._searchHighlightNodes.length;
  }

  searchHighlightNode(index: number): Element {
    return this._searchHighlightNodes[index];
  }

  async _getInlineFrames(
      debuggerModel: SDK.DebuggerModel.DebuggerModel, url: string, lineNumber: number|undefined,
      columnNumber: number|undefined): Promise<{frames: Bindings.DebuggerLanguagePlugins.FunctionInfo[]}> {
    const debuggerWorkspaceBinding = Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance();
    if (debuggerWorkspaceBinding.pluginManager) {
      const projects = Workspace.Workspace.WorkspaceImpl.instance().projects();
      const uiSourceCodes = projects.map(project => project.uiSourceCodeForURL(url)).flat().filter(f => Boolean(f)) as
          Workspace.UISourceCode.UISourceCode[];
      const scripts =
          uiSourceCodes.map(uiSourceCode => debuggerWorkspaceBinding.scriptsForUISourceCode(uiSourceCode)).flat();
      if (scripts.length) {
        const location =
            new SDK.DebuggerModel.Location(debuggerModel, scripts[0].scriptId, lineNumber || 0, columnNumber);
        return await debuggerWorkspaceBinding.pluginManager.getFunctionInfo(scripts[0], location) ?? {frames: []};
      }
    }

    return {frames: []};
  }

  // Expand inline stack frames in the formatted error in the stackTrace element, inserting new elements before the
  // insertBefore anchor.
  async _expandInlineStackFrames(
      debuggerModel: SDK.DebuggerModel.DebuggerModel, prefix: string, suffix: string, url: string,
      lineNumber: number|undefined, columnNumber: number|undefined, stackTrace: HTMLElement,
      insertBefore: HTMLElement): Promise<boolean> {
    const {frames} = await this._getInlineFrames(debuggerModel, url, lineNumber, columnNumber);
    if (!frames.length) {
      return false;
    }

    for (let f = 0; f < frames.length; ++f) {
      const {name} = frames[f];
      const formattedLine = document.createElement('span');
      formattedLine.appendChild(this._linkifyStringAsFragment(`${prefix} ${name} (`));
      const scriptLocationLink = this._linkifier.linkifyScriptLocation(
          debuggerModel.target(), null, url, lineNumber,
          {columnNumber, className: undefined, tabStop: undefined, inlineFrameIndex: f});
      scriptLocationLink.tabIndex = -1;
      this._selectableChildren.push({element: scriptLocationLink, forceSelect: (): void => scriptLocationLink.focus()});
      formattedLine.appendChild(scriptLocationLink);
      formattedLine.appendChild(this._linkifyStringAsFragment(suffix));
      stackTrace.insertBefore(formattedLine, insertBefore);
    }
    return true;
  }

  _tryFormatAsError(string: string): HTMLElement|null {
    function startsWith(prefix: string): boolean {
      return string.startsWith(prefix);
    }

    const runtimeModel = this._message.runtimeModel();
    // TODO: Consider removing these in favor of a simpler regex.
    const errorPrefixes = [
      'AggregateError',
      'Error',
      'EvalError',
      'RangeError',
      'ReferenceError',
      'SyntaxError',
      'TypeError',
      'URIError',
    ];
    if (!runtimeModel || !errorPrefixes.some(startsWith) && !/^[\w.]+Error\b/.test(string)) {
      return null;
    }
    const debuggerModel = runtimeModel.debuggerModel();
    const baseURL = runtimeModel.target().inspectedURL();

    const lines = string.split('\n');
    const linkInfos = [];
    for (const line of lines) {
      const isCallFrameLine = /^\s*at\s/.test(line);
      if (!isCallFrameLine && linkInfos.length && linkInfos[linkInfos.length - 1].link) {
        return null;
      }

      if (!isCallFrameLine) {
        linkInfos.push({line});
        continue;
      }

      let openBracketIndex = -1;
      let closeBracketIndex = -1;
      const inBracketsWithLineAndColumn = /\([^\)\(]+:\d+:\d+\)/g;
      const inBrackets = /\([^\)\(]+\)/g;
      let lastMatch: RegExpExecArray|null = null;
      let currentMatch;
      while ((currentMatch = inBracketsWithLineAndColumn.exec(line))) {
        lastMatch = currentMatch;
      }
      if (!lastMatch) {
        while ((currentMatch = inBrackets.exec(line))) {
          lastMatch = currentMatch;
        }
      }
      if (lastMatch) {
        openBracketIndex = lastMatch.index;
        closeBracketIndex = lastMatch.index + lastMatch[0].length - 1;
      }
      const hasOpenBracket = openBracketIndex !== -1;
      let left = hasOpenBracket ? openBracketIndex + 1 : line.indexOf('at') + 3;
      if (!hasOpenBracket && line.indexOf('async ') === left) {
        left += 6;
      }
      const right = hasOpenBracket ? closeBracketIndex : line.length;
      const linkCandidate = line.substring(left, right);
      const splitResult = Common.ParsedURL.ParsedURL.splitLineAndColumn(linkCandidate);
      if (!splitResult) {
        return null;
      }

      if (splitResult.url === '<anonymous>') {
        linkInfos.push({line});
        continue;
      }
      let url = parseOrScriptMatch(splitResult.url);
      if (!url && Common.ParsedURL.ParsedURL.isRelativeURL(splitResult.url)) {
        url = parseOrScriptMatch(Common.ParsedURL.ParsedURL.completeURL(baseURL, splitResult.url));
      }
      if (!url) {
        return null;
      }

      linkInfos.push({
        line,
        link: {
          url,
          enclosedInBraces: hasOpenBracket,
          positionLeft: left,
          positionRight: right,
          lineNumber: splitResult.lineNumber,
          columnNumber: splitResult.columnNumber,
        },
      });
    }

    if (!linkInfos.length) {
      return null;
    }

    const formattedResult = document.createElement('span');
    for (let i = 0; i < linkInfos.length; ++i) {
      const newline = i < linkInfos.length - 1 ? '\n' : '';
      const {line, link} = linkInfos[i];
      if (!link) {
        formattedResult.appendChild(this._linkifyStringAsFragment(`${line}${newline}`));
        continue;
      }
      const formattedLine = document.createElement('span');
      const prefix = line.substring(0, link.positionLeft);
      const suffix = `${line.substring(link.positionRight)}${newline}`;

      formattedLine.appendChild(this._linkifyStringAsFragment(prefix));
      const scriptLocationLink = this._linkifier.linkifyScriptLocation(
          debuggerModel.target(), null, link.url, link.lineNumber,
          {columnNumber: link.columnNumber, className: undefined, tabStop: undefined, inlineFrameIndex: 0});
      scriptLocationLink.tabIndex = -1;
      this._selectableChildren.push({element: scriptLocationLink, forceSelect: (): void => scriptLocationLink.focus()});
      formattedLine.appendChild(scriptLocationLink);
      formattedLine.appendChild(this._linkifyStringAsFragment(suffix));
      formattedResult.appendChild(formattedLine);

      if (!link.enclosedInBraces) {
        continue;
      }

      const prefixWithoutFunction = prefix.substring(0, prefix.lastIndexOf(' ', prefix.length - 3));

      // If we were able to parse the function name from the stack trace line, try to replace it with an expansion of
      // any inline frames.
      const selectableChildIndex = this._selectableChildren.length - 1;
      this._expandInlineStackFrames(
              debuggerModel, prefixWithoutFunction, suffix, link.url, link.lineNumber, link.columnNumber,
              formattedResult, formattedLine)
          .then(modified => {
            if (modified) {
              formattedResult.removeChild(formattedLine);
              this._selectableChildren.splice(selectableChildIndex, 1);
            }
          });
    }

    return formattedResult;

    function parseOrScriptMatch(url: string|null): string|null {
      if (!url) {
        return null;
      }
      const parsedURL = Common.ParsedURL.ParsedURL.fromString(url);
      if (parsedURL) {
        return parsedURL.url;
      }
      if (debuggerModel.scriptsForSourceURL(url).length) {
        return url;
      }
      // nodejs stack traces contain (absolute) file paths, but v8 reports them as file: urls.
      const fileUrl = new URL(url, 'file://');
      if (debuggerModel.scriptsForSourceURL(fileUrl.href).length) {
        return fileUrl.href;
      }
      return null;
    }
  }

  // TODO console linkify
  _linkifyWithCustomLinkifier(
      string: string, linkifier: (arg0: string, arg1: string, arg2?: number, arg3?: number) => Node): DocumentFragment {
    if (string.length > getMaxTokenizableStringLength()) {
      const propertyValue = new ObjectUI.ObjectPropertiesSection.ExpandableTextPropertyValue(
          document.createElement('span'), string, getLongStringVisibleLength());
      const fragment = document.createDocumentFragment();
      fragment.appendChild(propertyValue.element);
      return fragment;
    }
    const container = document.createDocumentFragment();
    const tokens = ConsoleViewMessage._tokenizeMessageText(string);
    for (const token of tokens) {
      if (!token.text) {
        continue;
      }
      switch (token.type) {
        case 'url': {
          const realURL = (token.text.startsWith('www.') ? 'http://' + token.text : token.text);
          const splitResult = Common.ParsedURL.ParsedURL.splitLineAndColumn(realURL);
          const sourceURL = Common.ParsedURL.ParsedURL.removeWasmFunctionInfoFromURL(splitResult.url);
          let linkNode;
          if (splitResult) {
            linkNode = linkifier(token.text, sourceURL, splitResult.lineNumber, splitResult.columnNumber);
          } else {
            linkNode = linkifier(token.text, '');
          }
          container.appendChild(linkNode);
          break;
        }
        default:
          container.appendChild(document.createTextNode(token.text));
          break;
      }
    }
    return container;
  }

  // TODO console linkify
  _linkifyStringAsFragment(string: string): DocumentFragment {
    return this._linkifyWithCustomLinkifier(string, (text, url, lineNumber, columnNumber) => {
      const options = {text, lineNumber, columnNumber};
      const linkElement =
          Components.Linkifier.Linkifier.linkifyURL(url, (options as Components.Linkifier.LinkifyURLOptions));
      linkElement.tabIndex = -1;
      this._selectableChildren.push({element: linkElement, forceSelect: (): void => linkElement.focus()});
      return linkElement;
    });
  }

  // TODO console linkify collapse long link
  static _tokenizeMessageText(string: string): {
    type?: string, text: string,
  }[] {
    const {tokenizerRegexes, tokenizerTypes} = getOrCreateTokenizers();
    if (string.length > getMaxTokenizableStringLength()) {
      return [{text: string, type: undefined}];
    }
    const results = TextUtils.TextUtils.Utils.splitStringByRegexes(string, tokenizerRegexes);
    return results.map(result => ({text: result.value, type: tokenizerTypes[result.regexIndex]}));
  }

  groupKey(): string {
    if (!this._groupKey) {
      this._groupKey = this._message.groupCategoryKey() + ':' + this.groupTitle();
    }
    return this._groupKey;
  }

  groupTitle(): string {
    const tokens = ConsoleViewMessage._tokenizeMessageText(this._message.messageText);
    const result = tokens.reduce((acc, token) => {
      let text: Common.UIString.LocalizedString|string = token.text;
      if (token.type === 'url') {
        text = i18nString(UIStrings.url);
      } else if (token.type === 'time') {
        text = i18nString(UIStrings.tookNms);
      } else if (token.type === 'event') {
        text = i18nString(UIStrings.someEvent);
      } else if (token.type === 'milestone') {
        text = i18nString(UIStrings.Mxx);
      } else if (token.type === 'autofill') {
        text = i18nString(UIStrings.attribute);
      }
      return acc + text;
    }, '');
    return result.replace(/[%]o/g, '');
  }
}

let tokenizerRegexes: RegExp[]|null = null;
let tokenizerTypes: string[]|null = null;

function getOrCreateTokenizers(): {
  tokenizerRegexes: Array<RegExp>,
  tokenizerTypes: Array<string>,
} {
  if (!tokenizerRegexes || !tokenizerTypes) {
    const controlCodes = '\\u0000-\\u0020\\u007f-\\u009f';
    const linkStringRegex = new RegExp(
        '(?:[a-zA-Z][a-zA-Z0-9+.-]{2,}:\\/\\/|data:|www\\.)[^\\s' + controlCodes + '"]{2,}[^\\s' + controlCodes +
            '"\')}\\],:;.!?]',
        'u');
    const pathLineRegex = /(?:\/[\w\.-]*)+\:[\d]+/;
    const timeRegex = /took [\d]+ms/;
    const eventRegex = /'\w+' event/;
    const milestoneRegex = /\sM[6-7]\d/;
    const autofillRegex = /\(suggested: \"[\w-]+\"\)/;
    const handlers = new Map<RegExp, string>();
    handlers.set(linkStringRegex, 'url');
    handlers.set(pathLineRegex, 'url');
    handlers.set(timeRegex, 'time');
    handlers.set(eventRegex, 'event');
    handlers.set(milestoneRegex, 'milestone');
    handlers.set(autofillRegex, 'autofill');
    tokenizerRegexes = Array.from(handlers.keys());
    tokenizerTypes = Array.from(handlers.values());
    return {tokenizerRegexes, tokenizerTypes};
  }
  return {tokenizerRegexes, tokenizerTypes};
}

export class ConsoleGroupViewMessage extends ConsoleViewMessage {
  _collapsed: boolean;
  _expandGroupIcon: UI.Icon.Icon|null;
  _onToggle: () => void;

  constructor(
      consoleMessage: SDK.ConsoleModel.ConsoleMessage, linkifier: Components.Linkifier.Linkifier,
      requestResolver: Logs.RequestResolver.RequestResolver, issueResolver: IssuesManager.IssueResolver.IssueResolver,
      nestingLevel: number, onToggle: () => void, onResize: (arg0: Common.EventTarget.EventTargetEvent) => void) {
    console.assert(consoleMessage.isGroupStartMessage());
    super(consoleMessage, linkifier, requestResolver, issueResolver, nestingLevel, onResize);
    this._collapsed = consoleMessage.type === Protocol.Runtime.ConsoleAPICalledEventType.StartGroupCollapsed;
    this._expandGroupIcon = null;
    this._onToggle = onToggle;
  }

  _setCollapsed(collapsed: boolean): void {
    this._collapsed = collapsed;
    if (this._expandGroupIcon) {
      this._expandGroupIcon.setIconType(this._collapsed ? 'smallicon-triangle-right' : 'smallicon-triangle-down');
    }
    this._onToggle.call(null);
  }

  collapsed(): boolean {
    return this._collapsed;
  }

  maybeHandleOnKeyDown(event: KeyboardEvent): boolean {
    const focusedChildIndex = this._focusedChildIndex();
    if (focusedChildIndex === -1) {
      if ((event.key === 'ArrowLeft' && !this._collapsed) || (event.key === 'ArrowRight' && this._collapsed)) {
        this._setCollapsed(!this._collapsed);
        return true;
      }
    }
    return super.maybeHandleOnKeyDown(event);
  }

  toMessageElement(): HTMLElement {
    let element: HTMLElement|null = this._element || null;
    if (!element) {
      element = super.toMessageElement();
      const iconType = this._collapsed ? 'smallicon-triangle-right' : 'smallicon-triangle-down';
      this._expandGroupIcon = UI.Icon.Icon.create(iconType, 'expand-group-icon');
      // Intercept focus to avoid highlight on click.
      this.contentElement().tabIndex = -1;
      if (this._repeatCountElement) {
        this._repeatCountElement.insertBefore(this._expandGroupIcon, this._repeatCountElement.firstChild);
      } else {
        element.insertBefore(this._expandGroupIcon, this._contentElement);
      }
      element.addEventListener('click', () => this._setCollapsed(!this._collapsed));
    }
    return element;
  }

  _showRepeatCountElement(): void {
    super._showRepeatCountElement();
    if (this._repeatCountElement && this._expandGroupIcon) {
      this._repeatCountElement.insertBefore(this._expandGroupIcon, this._repeatCountElement.firstChild);
    }
  }
}

export class ConsoleCommand extends ConsoleViewMessage {
  _formattedCommand: HTMLElement|null;

  constructor(
      consoleMessage: SDK.ConsoleModel.ConsoleMessage, linkifier: Components.Linkifier.Linkifier,
      requestResolver: Logs.RequestResolver.RequestResolver, issueResolver: IssuesManager.IssueResolver.IssueResolver,
      nestingLevel: number, onResize: (arg0: Common.EventTarget.EventTargetEvent) => void) {
    super(consoleMessage, linkifier, requestResolver, issueResolver, nestingLevel, onResize);
    this._formattedCommand = null;
  }

  contentElement(): HTMLElement {
    const contentElement = this.getContentElement();
    if (contentElement) {
      return contentElement;
    }
    const newContentElement = document.createElement('div');
    this.setContentElement(newContentElement);
    newContentElement.classList.add('console-user-command');
    const icon = UI.Icon.Icon.create('smallicon-user-command', 'command-result-icon');
    newContentElement.appendChild(icon);

    elementToMessage.set(newContentElement, this);
    this._formattedCommand = document.createElement('span');
    this._formattedCommand.classList.add('source-code');
    this._formattedCommand.textContent = Platform.StringUtilities.replaceControlCharacters(this.text);
    newContentElement.appendChild(this._formattedCommand);

    if (this._formattedCommand.textContent.length < MaxLengthToIgnoreHighlighter) {
      const javascriptSyntaxHighlighter = new TextEditor.SyntaxHighlighter.SyntaxHighlighter('text/javascript', true);
      javascriptSyntaxHighlighter.syntaxHighlightNode(this._formattedCommand).then(this._updateSearch.bind(this));
    } else {
      this._updateSearch();
    }

    this.updateTimestamp();
    return newContentElement;
  }

  _updateSearch(): void {
    this.setSearchRegex(this.searchRegex());
  }
}

export class ConsoleCommandResult extends ConsoleViewMessage {
  contentElement(): HTMLElement {
    const element = super.contentElement();
    if (!element.classList.contains('console-user-command-result')) {
      element.classList.add('console-user-command-result');
      if (this.consoleMessage().level === Protocol.Log.LogEntryLevel.Info) {
        const icon = UI.Icon.Icon.create('smallicon-command-result', 'command-result-icon');
        element.insertBefore(icon, element.firstChild);
      }
    }
    return element;
  }
}

export class ConsoleTableMessageView extends ConsoleViewMessage {
  _dataGrid: DataGrid.SortableDataGrid.SortableDataGrid<unknown>|null;

  constructor(
      consoleMessage: SDK.ConsoleModel.ConsoleMessage, linkifier: Components.Linkifier.Linkifier,
      requestResolver: Logs.RequestResolver.RequestResolver, issueResolver: IssuesManager.IssueResolver.IssueResolver,
      nestingLevel: number, onResize: (arg0: Common.EventTarget.EventTargetEvent) => void) {
    super(consoleMessage, linkifier, requestResolver, issueResolver, nestingLevel, onResize);
    console.assert(consoleMessage.type === Protocol.Runtime.ConsoleAPICalledEventType.Table);
    this._dataGrid = null;
  }

  wasShown(): void {
    if (this._dataGrid) {
      this._dataGrid.updateWidths();
    }
    super.wasShown();
  }

  onResize(): void {
    if (!this.isVisible()) {
      return;
    }
    if (this._dataGrid) {
      this._dataGrid.onResize();
    }
  }

  contentElement(): HTMLElement {
    const contentElement = this.getContentElement();
    if (contentElement) {
      return contentElement;
    }

    const newContentElement = document.createElement('div');
    newContentElement.classList.add('console-message');
    if (this._messageLevelIcon) {
      newContentElement.appendChild(this._messageLevelIcon);
    }
    this.setContentElement(newContentElement);

    newContentElement.appendChild(this._buildTableMessage());
    this.updateTimestamp();
    return newContentElement;
  }

  // TODO console
  _buildTableMessage(): HTMLElement {
    const formattedMessage = document.createElement('span');
    formattedMessage.classList.add('source-code');
    this._anchorElement = this._buildMessageAnchor();
    if (this._anchorElement) {
      formattedMessage.appendChild(this._anchorElement);
    }

    const table = this._message.parameters && this._message.parameters.length ? this._message.parameters[0] : null;
    if (!table) {
      return this._buildMessage();
    }
    const actualTable = parameterToRemoteObject(this._message.runtimeModel())(table);
    if (!actualTable || !actualTable.preview) {
      return this._buildMessage();
    }

    const rawValueColumnSymbol = Symbol('rawValueColumn');
    const columnNames: (string|symbol)[] = [];
    const preview = actualTable.preview;
    const rows = [];
    for (let i = 0; i < preview.properties.length; ++i) {
      const rowProperty = preview.properties[i];
      let rowSubProperties: Protocol.Runtime.PropertyPreview[];
      if (rowProperty.valuePreview && rowProperty.valuePreview.properties.length) {
        rowSubProperties = rowProperty.valuePreview.properties;
      } else if (rowProperty.value) {
        rowSubProperties =
            [{name: rawValueColumnSymbol as unknown as string, type: rowProperty.type, value: rowProperty.value}];
      } else {
        continue;
      }

      const rowValue = new Map<string|symbol, HTMLElement>();
      const maxColumnsToRender = 20;
      for (let j = 0; j < rowSubProperties.length; ++j) {
        const cellProperty = rowSubProperties[j];
        let columnRendered: true|boolean = columnNames.indexOf(cellProperty.name) !== -1;
        if (!columnRendered) {
          if (columnNames.length === maxColumnsToRender) {
            continue;
          }
          columnRendered = true;
          columnNames.push(cellProperty.name);
        }

        if (columnRendered) {
          const cellElement =
              this._renderPropertyPreviewOrAccessor(actualTable, cellProperty, [rowProperty, cellProperty]);
          cellElement.classList.add('console-message-nowrap-below');
          rowValue.set(cellProperty.name, cellElement);
        }
      }
      rows.push({rowName: rowProperty.name, rowValue});
    }

    const flatValues = [];
    for (const {rowName, rowValue} of rows) {
      flatValues.push(rowName);
      for (let j = 0; j < columnNames.length; ++j) {
        flatValues.push(rowValue.get(columnNames[j]));
      }
    }
    columnNames.unshift(i18nString(UIStrings.index));
    const columnDisplayNames =
        columnNames.map(name => name === rawValueColumnSymbol ? i18nString(UIStrings.value) : name.toString());

    if (flatValues.length) {
      this._dataGrid = DataGrid.SortableDataGrid.SortableDataGrid.create(
          columnDisplayNames, flatValues, i18nString(UIStrings.console));
      if (this._dataGrid) {
        this._dataGrid.setStriped(true);
        this._dataGrid.setFocusable(false);

        const formattedResult = document.createElement('span');
        formattedResult.classList.add('console-message-text');
        const tableElement = formattedResult.createChild('div', 'console-message-formatted-table');
        const dataGridContainer = tableElement.createChild('span');
        tableElement.appendChild(this._formatParameter(actualTable, true, false));
        dataGridContainer.appendChild(this._dataGrid.element);
        formattedMessage.appendChild(formattedResult);
        this._dataGrid.renderInline();
      }
    }
    return formattedMessage;
  }

  approximateFastHeight(): number {
    const table = this._message.parameters && this._message.parameters[0];
    if (table && typeof table !== 'string' && table.preview) {
      return defaultConsoleRowHeight * table.preview.properties.length;
    }
    return defaultConsoleRowHeight;
  }
}

/**
 * The maximum length before strings are considered too long for syntax highlighting.
 * @const
 */
const MaxLengthToIgnoreHighlighter: number = 10000;

/**
 * @const
 */
export const MaxLengthForLinks: number = 40;

// TODO console
let maxTokenizableStringLength = 10000;
let longStringVisibleLength = 5000;

export const getMaxTokenizableStringLength = (): number => {
  return maxTokenizableStringLength;
};

export const setMaxTokenizableStringLength = (length: number): void => {
  maxTokenizableStringLength = length;
};

export const getLongStringVisibleLength = (): number => {
  return longStringVisibleLength;
};

export const setLongStringVisibleLength = (length: number): void => {
  longStringVisibleLength = length;
};
