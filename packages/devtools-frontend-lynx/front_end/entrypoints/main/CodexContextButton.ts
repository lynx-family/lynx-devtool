// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as Host from '../../core/host/host.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as DOMPath from '../../panels/elements/DOMPath.js';

import {getMessageForElement} from '../../panels/console/ConsoleViewMessage.js';

const BUTTON_CLASS_NAME = 'lynx-codex-context-button';
const BUTTON_STYLE_ID = 'lynx-codex-context-button-style';
const ELEMENT_ANCHOR_EVENT_NAME = 'lynx-codex-element-anchor';

type CodexContextKind = 'console'|'element';

type CodexContext = {
  kind: CodexContextKind;
  label: string;
  source: string;
  text: string;
  title: string;
  getAnchorRect: () => DOMRect|null;
};

let codexContextButtonControllerInstance: CodexContextButtonController|null = null;

type ConsoleMessageDetails = {
  fullMessage: string;
  level: string;
  source: string;
  type: string;
  location: string;
  topFrameText: string;
};

type ElementTreeClickAnchor = {
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
  relativeToTreeItem: boolean;
};

type ScreencastClickAnchor = {
  clientX: number;
  clientY: number;
  nodeId: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function getCurrentPanelName(): string {
  const currentPanel = UI.InspectorView.InspectorView.instance().currentPanelDeprecated() as {
    name?: string,
  }|null;
  return currentPanel?.name ?? '';
}

function getParentNodeOrShadowHost(node: Node): Node|null {
  if (node.parentNode) {
    return node.parentNode;
  }

  const rootNode = node.getRootNode();
  return rootNode instanceof ShadowRoot ? rootNode.host : null;
}

function findClosestElement(node: Node|null, selector: string): Element|null {
  for (let currentNode = node; currentNode; currentNode = getParentNodeOrShadowHost(currentNode)) {
    if (currentNode instanceof Element && currentNode.matches(selector)) {
      return currentNode;
    }
  }

  return null;
}

function findClosestElementInEvent(event: Event, selector: string): Element|null {
  const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
  for (const item of eventPath) {
    if (item instanceof Node) {
      const matchedElement = findClosestElement(item, selector);
      if (matchedElement) {
        return matchedElement;
      }
    }
  }

  return findClosestElement(event.target instanceof Node ? event.target : null, selector);
}

function deepQuerySelector(root: ParentNode, selector: string): Element|null {
  const directMatch = root.querySelector(selector);
  if (directMatch) {
    return directMatch;
  }

  const elements = root.querySelectorAll('*');
  for (const element of elements) {
    if (element.shadowRoot) {
      const shadowMatch = deepQuerySelector(element.shadowRoot, selector);
      if (shadowMatch) {
        return shadowMatch;
      }
    }
  }

  return null;
}

function deepElementFromPoint(root: Document|ShadowRoot, x: number, y: number): Element|null {
  const element = ((root as unknown) as {
    elementFromPoint?: (left: number, top: number) => Element|null,
  }).elementFromPoint?.(x, y) ?? null;
  if (element?.shadowRoot) {
    const shadowElement = deepElementFromPoint(element.shadowRoot, x, y);
    return shadowElement ?? element;
  }

  return element;
}

function buildAttributeSummary(node: SDK.DOMModel.DOMNode): string {
  const attributes = node.attributes();
  if (attributes.length === 0) {
    return 'none';
  }

  return truncate(
      attributes
          .slice(0, 8)
          .map(attribute => `${attribute.name}="${attribute.value}"`)
          .join(', '),
      500);
}

function sanitizeConsoleText(text: string): string {
  return text.replace(/\u200B/g, '').trim();
}

function inferConsoleLevelFromElement(element: Element): string {
  if (element.classList.contains('console-error-level')) {
    return 'error';
  }

  if (element.classList.contains('console-warning-level')) {
    return 'warning';
  }

  if (element.classList.contains('console-info-level')) {
    return 'info';
  }

  if (element.classList.contains('console-verbose-level')) {
    return 'verbose';
  }

  return 'unknown';
}

function inferConsoleSourceFromElement(element: Element): string {
  if (element.classList.contains('console-from-api')) {
    return 'console-api';
  }

  return 'unknown';
}

function extractConsoleLocationFromElement(element: Element): string {
  const linkElement = element.querySelector('.console-message-anchor .devtools-link, .console-message-anchor');
  if (!(linkElement instanceof HTMLElement)) {
    return '';
  }

  return sanitizeConsoleText(linkElement.innerText || linkElement.textContent || '');
}

function extractConsoleMessageDetails(element: Element): ConsoleMessageDetails|null {
  const consoleViewMessage = getMessageForElement(element);
  const consoleMessage = consoleViewMessage?.consoleMessage();
  if (consoleViewMessage && consoleMessage) {
    const topFrame = consoleMessage.stackTrace?.callFrames?.[0];
    const location =
        formatLocation(consoleMessage.url, consoleMessage.line, consoleMessage.column) ||
        formatLocation(topFrame?.url, topFrame?.lineNumber, topFrame?.columnNumber);
    const topFrameText =
        topFrame?.url ?
        `${topFrame.functionName || '<anonymous>'} @ ${
            formatLocation(topFrame.url, topFrame.lineNumber, topFrame.columnNumber)
        }` :
        '';

    return {
      fullMessage:
          sanitizeConsoleText(consoleViewMessage.contentElement().deepTextContent()) ||
          sanitizeConsoleText(consoleMessage.messageText),
      level: consoleMessage.level ?? 'unknown',
      source: consoleMessage.source ?? 'unknown',
      type: consoleMessage.type ?? 'unknown',
      location,
      topFrameText
    };
  }

  const fullMessage = sanitizeConsoleText((element as HTMLElement).innerText || element.textContent || '');
  if (!fullMessage) {
    return null;
  }

  return {
    fullMessage,
    level: inferConsoleLevelFromElement(element),
    source: inferConsoleSourceFromElement(element),
    type: 'log',
    location: extractConsoleLocationFromElement(element),
    topFrameText: ''
  };
}

function formatLocation(url?: string, line?: number, column?: number): string {
  if (!url) {
    return '';
  }

  const nextLine = typeof line === 'number' ? line + 1 : null;
  const nextColumn = typeof column === 'number' ? column + 1 : null;
  if (nextLine === null || nextColumn === null) {
    return url;
  }

  return `${url}:${nextLine}:${nextColumn}`;
}

function createPointRect(x: number, y: number): DOMRect {
  return new DOMRect(x, y, 0, 0);
}

export class CodexContextButtonController {
  private readonly button: HTMLButtonElement;
  private elementContext: CodexContext|null = null;
  private consoleContext: CodexContext|null = null;
  private currentContext: CodexContext|null = null;
  private hoveredConsoleMessageElement: Element|null = null;
  private activeConsoleMessageElement: Element|null = null;
  private elementTreeClickAnchor: ElementTreeClickAnchor|null = null;
  private screencastClickAnchor: ScreencastClickAnchor|null = null;
  private buttonHovered = false;
  private latestElementRequestId = 0;

  private constructor() {
    this.installStyles();
    this.button = this.createButton();
    this.installListeners();
    void this.refreshElementContext();
    this.refreshConsoleContext();
  }

  static instance(): CodexContextButtonController {
    if (!codexContextButtonControllerInstance) {
      codexContextButtonControllerInstance = new CodexContextButtonController();
    }

    return codexContextButtonControllerInstance;
  }

  private installStyles(): void {
    if (document.getElementById(BUTTON_STYLE_ID)) {
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = BUTTON_STYLE_ID;
    styleElement.textContent = `
      .${BUTTON_CLASS_NAME} {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 12px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(8, 31, 92, 0.96), rgba(22, 119, 255, 0.92));
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: 0.01em;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
        backdrop-filter: blur(10px);
        cursor: pointer;
        transition: opacity 120ms ease, transform 120ms ease, filter 120ms ease;
      }

      .${BUTTON_CLASS_NAME}::before {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.14);
        flex-shrink: 0;
      }

      .${BUTTON_CLASS_NAME}[data-kind="console"] {
        background: linear-gradient(135deg, rgba(120, 53, 15, 0.96), rgba(250, 140, 22, 0.92));
      }

      .${BUTTON_CLASS_NAME}:hover {
        filter: brightness(1.04);
      }

      .${BUTTON_CLASS_NAME}[data-hidden="true"] {
        opacity: 0;
        pointer-events: none;
        transform: translateY(4px);
      }

      .${BUTTON_CLASS_NAME}[data-hidden="false"] {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(styleElement);
  }

  private createButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = BUTTON_CLASS_NAME;
    button.dataset.hidden = 'true';
    button.dataset.kind = 'element';
    button.textContent = 'Ask Codex';
    button.type = 'button';
    button.addEventListener('mousedown', event => {
      event.preventDefault();
    });
    button.addEventListener('mouseenter', this.handleButtonMouseEnter);
    button.addEventListener('mouseleave', this.handleButtonMouseLeave);
    button.addEventListener('click', this.handleButtonClick);
    document.body.appendChild(button);
    return button;
  }

  private installListeners(): void {
    UI.Context.Context.instance().addFlavorChangeListener(
        SDK.DOMModel.DOMNode, this.handleSelectedNodeChanged, this);
    document.addEventListener('mousemove', this.handlePointerMove, true);
    document.addEventListener('selectionchange', this.handleSelectionChange, true);
    document.addEventListener('mouseup', this.handleSelectionChange, true);
    document.addEventListener('keyup', this.handleSelectionChange, true);
    document.addEventListener('click', this.handleDocumentClick, true);
    window.addEventListener(ELEMENT_ANCHOR_EVENT_NAME, this.handleScreencastElementAnchor as EventListener, true);
    window.addEventListener('resize', this.updateButtonPosition, true);
    document.addEventListener('scroll', this.updateButtonPosition, true);
  }

  private readonly handleButtonClick = (): void => {
    if (!this.currentContext) {
      return;
    }

    Host.InspectorFrontendHost.sendWindowMessage({
      type: 'codex_send_context',
      content: {
        label: this.currentContext.label,
        text: this.currentContext.text,
        autoSend: false,
        includeBaseContext: true,
        source: this.currentContext.source
      }
    });
    this.clearElementAnchors();
    this.buttonHovered = false;
    this.consoleContext = null;
    this.activeConsoleMessageElement = null;
    this.hoveredConsoleMessageElement = null;
    this.currentContext = null;
    this.button.dataset.hidden = 'true';
  };

  private readonly handleSelectedNodeChanged = (): void => {
    this.consoleContext = null;
    this.hoveredConsoleMessageElement = null;
    this.activeConsoleMessageElement = null;
    const selectedNode = UI.Context.Context.instance().flavor(SDK.DOMModel.DOMNode)?.enclosingElementOrSelf();
    if (selectedNode && this.screencastClickAnchor && selectedNode.id !== this.screencastClickAnchor.nodeId) {
      this.screencastClickAnchor = null;
    }
    this.applyVisibleContext();
    void this.refreshElementContext();
  };

  private readonly handleScreencastElementAnchor = (event: Event): void => {
    const customEvent = event as CustomEvent<ScreencastClickAnchor|undefined>;
    const detail = customEvent.detail;
    if (!detail || typeof detail.clientX !== 'number' || typeof detail.clientY !== 'number' ||
        typeof detail.nodeId !== 'number') {
      return;
    }

    this.elementTreeClickAnchor = null;
    this.screencastClickAnchor = detail;
    this.applyVisibleContext();
    this.scheduleButtonReposition();
  };

  private readonly handlePointerMove = (event: Event): void => {
    const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const target = event.target instanceof Node ? event.target : null;
    if (eventPath.includes(this.button) || (target && this.button.contains(target))) {
      return;
    }

    const panelName = getCurrentPanelName();
    const hoveredConsoleCandidate = findClosestElementInEvent(event, '.console-message-wrapper');
    const nextConsoleMessageElement =
        hoveredConsoleCandidate && this.isEligibleConsoleMessage(hoveredConsoleCandidate) ? hoveredConsoleCandidate : null;
    const shouldRefreshConsole =
        this.hoveredConsoleMessageElement !== nextConsoleMessageElement || this.isConsoleSelectionActive();

    this.hoveredConsoleMessageElement = nextConsoleMessageElement;

    if (panelName === 'elements' && !this.elementContext) {
      void this.refreshElementContext();
    }

    if (shouldRefreshConsole) {
      this.refreshConsoleContext();
      return;
    }

    this.applyVisibleContext();
  };

  private readonly handleSelectionChange = (): void => {
    this.refreshConsoleContext();
  };

  private readonly handleButtonMouseEnter = (): void => {
    this.buttonHovered = true;
    this.applyVisibleContext();
  };

  private readonly handleButtonMouseLeave = (): void => {
    this.buttonHovered = false;
    this.applyVisibleContext();
  };

  private readonly handleDocumentClick = (event: Event): void => {
    const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (eventPath.includes(this.button)) {
      return;
    }

    const clickedTreeItem = this.updateElementTreeClickAnchor(event);
    const clickedScreencastElement = findClosestElementInEvent(
        event, '.screencast canvas, .screencast-viewport, .screencast-canvas-container, .screencast-element-title');
    const clickedConsoleMessageElement = findClosestElementInEvent(event, '.console-message-wrapper');
    if (clickedTreeItem) {
      this.screencastClickAnchor = null;
    } else if (!clickedScreencastElement) {
      this.clearElementAnchors();
    }

    this.activeConsoleMessageElement =
        clickedConsoleMessageElement && this.isEligibleConsoleMessage(clickedConsoleMessageElement) ?
        clickedConsoleMessageElement :
        null;
    this.hoveredConsoleMessageElement =
        clickedConsoleMessageElement && this.isEligibleConsoleMessage(clickedConsoleMessageElement) ?
        clickedConsoleMessageElement :
        null;

    this.refreshConsoleContext();
    this.applyVisibleContext();
    void this.refreshElementContext();
    this.scheduleButtonReposition();
  };

  private readonly updateButtonPosition = (): void => {
    if (!this.currentContext) {
      return;
    }

    const anchorRect = this.currentContext.getAnchorRect();
    const buttonWidth = this.button.offsetWidth || 96;
    const buttonHeight = this.button.offsetHeight || 32;
    const horizontalMargin = 16;
    const verticalMargin = 12;

    if (!anchorRect) {
      this.button.style.left = `${window.innerWidth - buttonWidth - 24}px`;
      this.button.style.top = `${window.innerHeight - buttonHeight - 24}px`;
      return;
    }

    const preferredLeft = anchorRect.right + 8;
    const preferredTop = anchorRect.top + Math.max((anchorRect.height - buttonHeight) / 2, 0);
    const left = clamp(preferredLeft, horizontalMargin, window.innerWidth - buttonWidth - horizontalMargin);
    const top = clamp(preferredTop, verticalMargin, window.innerHeight - buttonHeight - verticalMargin);

    this.button.style.left = `${left}px`;
    this.button.style.top = `${top}px`;
  };

  private async refreshElementContext(): Promise<void> {
    const selectedNode = UI.Context.Context.instance().flavor(SDK.DOMModel.DOMNode);
    const requestId = ++this.latestElementRequestId;

    if (getCurrentPanelName() !== 'elements') {
      this.elementContext = null;
      this.applyVisibleContext();
      return;
    }

    const elementNode = selectedNode?.enclosingElementOrSelf();
    if (!elementNode) {
      this.elementContext = null;
      this.applyVisibleContext();
      return;
    }

    const selector = elementNode.simpleSelector();
    const cssPath = DOMPath.cssPath(elementNode, true) || selector;
    const xpath = DOMPath.xPath(elementNode, true);
    const outerHTML = await elementNode.getOuterHTML();

    if (requestId !== this.latestElementRequestId) {
      return;
    }

    const lines = [
      'Elements panel context',
      '',
      'Selected node:',
      `- selector: ${selector || 'unknown'}`,
      `- cssPath: ${cssPath || 'unknown'}`,
      `- xPath: ${xpath || 'unknown'}`,
      `- nodePath: ${elementNode.path() || 'unknown'}`,
      `- attributes: ${buildAttributeSummary(elementNode)}`
    ];

    if (outerHTML) {
      lines.push('', 'Outer HTML:', '```html', truncate(outerHTML, 1600), '```');
    }

    this.elementContext = {
      kind: 'element',
      label: 'Elements context',
      source: 'elements-selection',
      text: lines.join('\n'),
      title: 'Fill the Codex input with the selected element context',
      getAnchorRect: () => this.getElementAnchorRect()
    };
    this.applyVisibleContext();
  }

  private updateElementTreeClickAnchor(event: Event): Element|null {
    if (!(event instanceof MouseEvent)) {
      return null;
    }

    const clickedTreeItem = findClosestElementInEvent(event, '.elements-tree-outline li') ??
        findClosestElement(deepElementFromPoint(document, event.clientX, event.clientY), '.elements-tree-outline li');
    if (clickedTreeItem) {
      const treeItemRect = clickedTreeItem.getBoundingClientRect();
      this.elementTreeClickAnchor = {
        clientX: event.clientX,
        clientY: event.clientY,
        offsetX: clamp(event.clientX - treeItemRect.left, 0, treeItemRect.width),
        offsetY: clamp(event.clientY - treeItemRect.top, 0, treeItemRect.height),
        relativeToTreeItem: true
      };
      return clickedTreeItem;
    }

    return null;
  }

  private clearElementAnchors(): void {
    this.elementTreeClickAnchor = null;
    this.screencastClickAnchor = null;
  }

  private hasElementAnchor(): boolean {
    return Boolean(this.screencastClickAnchor || this.elementTreeClickAnchor);
  }

  private getElementAnchorRect(): DOMRect|null {
    const selectedNode = UI.Context.Context.instance().flavor(SDK.DOMModel.DOMNode)?.enclosingElementOrSelf();
    if (selectedNode && this.screencastClickAnchor && selectedNode.id === this.screencastClickAnchor.nodeId) {
      return createPointRect(this.screencastClickAnchor.clientX, this.screencastClickAnchor.clientY);
    }

    return this.getElementTreeAnchorRect();
  }

  private getElementTreeAnchorRect(): DOMRect|null {
    const selectedTreeItem = deepQuerySelector(document, '.elements-tree-outline li.selected') as HTMLElement|null;
    const anchor = this.elementTreeClickAnchor;
    if (anchor?.relativeToTreeItem && selectedTreeItem) {
      const treeItemRect = selectedTreeItem.getBoundingClientRect();
      return createPointRect(
          treeItemRect.left + clamp(anchor.offsetX, 0, treeItemRect.width),
          treeItemRect.top + clamp(anchor.offsetY, 0, treeItemRect.height));
    }

    if (anchor) {
      return createPointRect(anchor.clientX, anchor.clientY);
    }

    const anchorElement = deepQuerySelector(
        document,
        '.elements-tree-outline li.selected .selection, .elements-tree-outline li.selected') as HTMLElement|null;
    return anchorElement?.getBoundingClientRect() ?? null;
  }

  private scheduleButtonReposition(): void {
    queueMicrotask(this.updateButtonPosition);
    window.requestAnimationFrame(this.updateButtonPosition);
    window.setTimeout(this.updateButtonPosition, 80);
  }

  private refreshConsoleContext(): void {
    const selection = document.getSelection();
    const selectedText = selection?.toString().trim() ?? '';
    const anchorWrapper = findClosestElement(selection?.anchorNode ?? null, '.console-message-wrapper');
    const focusWrapper = findClosestElement(selection?.focusNode ?? null, '.console-message-wrapper');
    const selectionWrapper =
        anchorWrapper && focusWrapper && anchorWrapper === focusWrapper ? anchorWrapper : null;
    const hasExternalSelection = selectedText.length > 0 && !selectionWrapper;
    const targetWrapper =
        hasExternalSelection ? null :
                              (selectionWrapper && selectedText ? selectionWrapper :
                                                                this.activeConsoleMessageElement ??
                                                                    this.hoveredConsoleMessageElement);

    if (!targetWrapper || !this.isEligibleConsoleMessage(targetWrapper)) {
      this.consoleContext = null;
      this.applyVisibleContext();
      return;
    }

    const consoleDetails = extractConsoleMessageDetails(targetWrapper);
    if (!consoleDetails) {
      this.consoleContext = null;
      this.applyVisibleContext();
      return;
    }

    const selectedSnippet =
        selectionWrapper === targetWrapper && selectedText.length > 0 ? truncate(selectedText, 600) : '';

    const lines = [
      'Console panel context',
      '',
      'Selected message:',
      `- level: ${consoleDetails.level}`,
      `- source: ${consoleDetails.source}`,
      `- type: ${consoleDetails.type}`
    ];

    if (consoleDetails.location) {
      lines.push(`- location: ${consoleDetails.location}`);
    }

    if (selectedSnippet) {
      lines.push('', 'Selected text:', '```text', selectedSnippet, '```');
    }

    lines.push('', 'Message text:', '```text', truncate(consoleDetails.fullMessage, 1600), '```');

    if (consoleDetails.topFrameText) {
      lines.push('', `Top stack frame: ${consoleDetails.topFrameText}`);
    }

    this.consoleContext = {
      kind: 'console',
      label: 'Console context',
      source: 'console-selection',
      text: lines.join('\n'),
      title: 'Fill the Codex input with the selected console log context',
      getAnchorRect: () => {
        if (selectionWrapper === targetWrapper && selectedText && selection?.rangeCount) {
          const rangeRect = selection.getRangeAt(0).getBoundingClientRect();
          if (rangeRect.width > 0 || rangeRect.height > 0) {
            return rangeRect;
          }
        }
        return (targetWrapper as HTMLElement).getBoundingClientRect();
      }
    };
    this.applyVisibleContext();
  }

  private isEligibleConsoleMessage(element: Element): boolean {
    return Boolean(extractConsoleMessageDetails(element)?.fullMessage);
  }

  private isConsoleSelectionActive(): boolean {
    const selection = document.getSelection();
    const selectedText = selection?.toString().trim() ?? '';
    if (!selectedText) {
      return false;
    }

    const anchorWrapper = findClosestElement(selection?.anchorNode ?? null, '.console-message-wrapper');
    const focusWrapper = findClosestElement(selection?.focusNode ?? null, '.console-message-wrapper');
    return Boolean(anchorWrapper && focusWrapper && anchorWrapper === focusWrapper);
  }

  private applyVisibleContext(): void {
    const panelName = getCurrentPanelName();
    let nextContext: CodexContext|null = null;
    if (this.consoleContext && this.isConsoleSelectionActive()) {
      nextContext = this.consoleContext;
    } else if (this.consoleContext && (this.activeConsoleMessageElement || this.hoveredConsoleMessageElement)) {
      nextContext = this.consoleContext;
    } else if (panelName === 'elements' && this.elementContext && this.hasElementAnchor()) {
      nextContext = this.elementContext;
    } else if (this.buttonHovered) {
      nextContext = this.currentContext;
    }

    this.currentContext = nextContext;
    if (!nextContext) {
      this.button.dataset.hidden = 'true';
      return;
    }

    this.button.dataset.kind = nextContext.kind;
    this.button.title = nextContext.title;
    this.button.dataset.hidden = 'false';
    this.updateButtonPosition();
  }
}
