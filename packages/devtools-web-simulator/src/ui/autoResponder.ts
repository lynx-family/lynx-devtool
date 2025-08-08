export type AutoResponseRule = {
  id: string;
  method: string;
  enabled: boolean;
  // JSON-able structure; will be deep-cloned and id will be overwritten with request id before sending
  response: any;
};

export const STORAGE_KEY = 'devtools-web-simulator:autoResponderRules';

export function generateRuleId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_RULES: AutoResponseRule[] = [
  {
    id: 'rule-dom-getDocument',
    method: 'DOM.getDocument',
    enabled: true,
    response: {
      // id will be set dynamically
      result: {
        root: {
          nodeId: 1,
          backendNodeId: 1,
          nodeType: 9,
          nodeName: '#document',
          localName: '',
          nodeValue: '',
          childNodeCount: 1,
          children: [
            {
              nodeId: 2,
              backendNodeId: 2,
              nodeType: 1,
              nodeName: 'HTML',
              localName: 'html',
              nodeValue: '',
              childNodeCount: 1,
              attributes: [],
              children: [
                {
                  nodeId: 3,
                  backendNodeId: 3,
                  nodeType: 1,
                  nodeName: 'BODY',
                  localName: 'body',
                  nodeValue: '',
                  childNodeCount: 0,
                  attributes: []
                }
              ]
            }
          ]
        }
      }
    }
  },
  { id: 'rule-overlay-highlight', method: 'Overlay.highlightNode', enabled: true, response: { result: {} } },
  { id: 'rule-overlay-hide', method: 'Overlay.hideHighlight', enabled: true, response: { result: {} } },
  { id: 'rule-dom-enable', method: 'DOM.enable', enabled: true, response: { result: {} } },
  { id: 'rule-css-enable', method: 'CSS.enable', enabled: true, response: { result: {} } },
  { id: 'rule-runtime-enable', method: 'Runtime.enable', enabled: true, response: { result: {} } },
  { id: 'rule-overlay-enable', method: 'Overlay.enable', enabled: true, response: { result: {} } },
  { id: 'rule-debugger-enable', method: 'Debugger.enable', enabled: true, response: { result: {} } },
  {
    id: 'rule-runtime-evaluate',
    method: 'Runtime.evaluate',
    enabled: true,
    response: {
      result: {
        result: { type: 'string', value: 'ok' }
      }
    }
  }
];

export function loadRules(): AutoResponseRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_RULES];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data as AutoResponseRule[];
    return [...DEFAULT_RULES];
  } catch {
    return [...DEFAULT_RULES];
  }
}

export function saveRules(rules: AutoResponseRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}


