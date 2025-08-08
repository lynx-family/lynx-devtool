import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Tabs } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Table, type Column } from '../components/ui/table';
import { Dialog } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { Upload as UploadIcon, RefreshCcw, Settings2, FileJson, Send, Trash2, Pencil, Code2 } from 'lucide-react';
import { AutoResponseRule, DEFAULT_RULES, clone, generateRuleId, loadRules, saveRules } from './autoResponder';

type MessageRecord = {
  ts: number;
  from: 'DevTools' | 'Host' | 'SDK';
  direction: '->' | '<-';
  type: string;
  sessionId?: number;
  clientId?: number;
  payload: unknown;
};

type QueueMsg = {
  type: string;
  content: any;
};

export default function App() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [devtoolsUrl, setDevtoolsUrl] = useState('');
  const [sessionId, setSessionId] = useState<number>(1);
  const [clientId, setClientId] = useState<number>(1001);
  const [view, setView] = useState<'log' | 'raw'>('log');
  const [sdkInput, setSdkInput] = useState('');
  const [devtoolsInput, setDevtoolsInput] = useState('');
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const messagePool = useRef<Record<string, QueueMsg[]>>({});
  // auto responder
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [rules, setRules] = useState<AutoResponseRule[]>(loadRules());
  const [editorOpen, setEditorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Icon wrappers to normalize types across environments
  const withIcon = (C: any) => (props: any) => <C {...props} />;
  const IRefreshCcw = withIcon(RefreshCcw);
  const ISettings2 = withIcon(Settings2);
  const IUpload = withIcon(UploadIcon);
  const IFileJson = withIcon(FileJson);
  const ISend = withIcon(Send);
  const ITrash2 = withIcon(Trash2);
  const IPencil = withIcon(Pencil);
  const ICode2 = withIcon(Code2);

  const addLog = useCallback((log: Omit<MessageRecord, 'ts'>) => {
    setMessages((prev) => [{ ts: Date.now(), ...log }, ...prev].slice(0, 300));
  }, []);

  const postToIframe = useCallback((type: string, content?: any) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type, content, sessionId, clientId }, '*');
  }, [sessionId, clientId]);

  // Basic dispatcher that mimics plugins/devtool/renderer/devtool/index.tsx
  const lynxOpen = useCallback(() => {
    postToIframe('lynx_open', {
      wsUrl: 'ws://localhost:0/mock',
      roomId: 'sim-room',
      sessionId,
      info: { ldtVersion: 'sim', sdkVersion: 'sim' },
      sessionUrl: devtoolsUrl
    });
    // flush pooled messages
    const key = `${clientId}:${sessionId}`;
    const queued = messagePool.current[key] || [];
    queued.forEach((m) => postToIframe('lynx_message', { type: m.type, message: m.content }));
    messagePool.current[key] = [];
  }, [postToIframe, sessionId, clientId, devtoolsUrl]);

  const onIframeLoad = useCallback(() => {
    const handle = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.sessionId && data.sessionId !== sessionId) return;
      if (data.event === 'simulator') {
        addLog({ from: 'DevTools', direction: '->', type: 'simulator', payload: data.data });
        return;
      }

      const { type, content } = data;
      if (type) {
        addLog({ from: 'DevTools', direction: '->', type, sessionId, clientId, payload: content });
      }

      switch (type) {
        case 'iframe_init':
          postToIframe('inject_data', { info: { sdkVersion: 'sim' }, plugins: [] });
          break;
        case 'iframe_loaded':
          lynxOpen();
          break;
        case 'send_message':
          // forward to SDK simulator
          addLog({ from: 'DevTools', direction: '->', type: 'CDP', payload: content });
          // auto responder
          if (autoReplyEnabled && content && content.message) {
            try {
              const req = typeof content.message === 'string' ? JSON.parse(content.message) : content.message;
              const method = req.method as string;
              const reqId = req.id;
              const rule = rules.find((r) => r.enabled && r.method === method);
              if (rule) {
                const resp = clone(rule.response || {});
                if (reqId !== undefined) {
                  resp.id = reqId;
                }
                // send back to iframe
                postToIframe('lynx_message', { type: 'CDP', message: resp });
                addLog({ from: 'SDK', direction: '->', type: 'AutoResponder', payload: resp });
              }
            } catch (e) {
              // ignore
            }
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', handle);
  }, [lynxOpen, addLog, postToIframe, sessionId, clientId]);

  // simulate incoming CDP from SDK -> Host -> DevTools iframe
  const sendSdkToDevTools = useCallback(() => {
    try {
      const parsed = JSON.parse(sdkInput || '{}');
      const key = `${clientId}:${sessionId}`;
      const msg = { type: 'CDP', content: parsed };
      if (!iframeRef.current?.contentWindow) {
        messagePool.current[key] = messagePool.current[key] || [];
        messagePool.current[key].push(msg);
      } else {
        postToIframe('lynx_message', { type: 'CDP', message: parsed });
      }
      addLog({ from: 'SDK', direction: '->', type: 'CDP', sessionId, clientId, payload: parsed });
    } catch (e) {
      addLog({ from: 'SDK', direction: '->', type: 'INVALID_JSON', payload: sdkInput });
    }
  }, [sdkInput, clientId, sessionId, postToIframe, addLog]);

  // simulate sending message from host to DevTools (not via SDK)
  const sendHostToDevTools = useCallback(() => {
    try {
      const parsed = JSON.parse(devtoolsInput || '{}');
      postToIframe('inspect-devtool-message', parsed);
      addLog({ from: 'Host', direction: '->', type: 'inspect-devtool-message', payload: parsed });
    } catch (e) {
      addLog({ from: 'Host', direction: '->', type: 'INVALID_JSON', payload: devtoolsInput });
    }
  }, [devtoolsInput, postToIframe, addLog]);

  const iframeSrc = useMemo(() => {
    if (!devtoolsUrl) return '';
    const url = new URL(devtoolsUrl);
    url.searchParams.set('sessionId', String(sessionId));
    url.searchParams.set('clientId', String(clientId));
    url.searchParams.set('ldtVersion', 'sim');
    url.searchParams.set('sdkVersion', 'sim');
    return url.toString();
  }, [devtoolsUrl, sessionId, clientId]);

  const handleImportFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data)) {
          setRules(data);
          saveRules(data);
        }
      } catch {/* noop */}
    };
    reader.readAsText(file);
  };

  const rulesColumns: Column<AutoResponseRule>[] = [
    {
      key: 'enabled',
      title: 'Enabled',
      width: 90,
      render: (record) => (
        <Switch
          checked={record.enabled}
          onChange={(val) => {
            const next = rules.map((r) => (r.id === record.id ? { ...r, enabled: val } : r));
            setRules(next);
            saveRules(next);
          }}
        />
      ),
    },
    { key: 'method', title: 'Method', width: 240 },
    {
      key: 'response',
      title: 'Response',
      render: (record) => (
        <Textarea
          className="code"
          rows={4}
          value={JSON.stringify(record.response, null, 2)}
          onChange={(e) => {
            try {
              const val = JSON.parse(e.target.value || '{}');
              const next = rules.map((r) => (r.id === record.id ? { ...r, response: val } : r));
              setRules(next);
            } catch {/* ignore */}
          }}
          onBlur={() => saveRules(rules)}
        />
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 180,
      render: (record) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="h-8 px-2">
            <IPencil className="mr-1 h-4 w-4" /> Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 px-2"
            onClick={() => {
              const next = rules.filter((r) => r.id !== record.id);
              setRules(next);
              saveRules(next);
            }}
          >
            <ITrash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="layout flex min-h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 bg-indigo-900 px-4 py-3">
        <span className="text-sm font-semibold text-slate-100">DevTools Simulator</span>
        <Input
          className="w-[460px] bg-white text-black"
          placeholder="DevTools Frontend Server (E.g. http://localhost:8000/devtools_app.html)"
          value={devtoolsUrl}
          onChange={(e) => setDevtoolsUrl(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300">session</span>
          <Input className="w-[120px] bg-white text-black" value={sessionId} onChange={(e) => setSessionId(Number(e.target.value || 0))} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300">client</span>
          <Input className="w-[120px] bg-white text-black" value={clientId} onChange={(e) => setClientId(Number(e.target.value || 0))} />
        </div>
        <Button className="ml-1" onClick={() => (iframeRef.current?.contentWindow ? lynxOpen() : null)}>
          <IRefreshCcw className="mr-2 h-4 w-4" /> Reset
        </Button>
        <Separator orientation="vertical" className="mx-2 h-6" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300">Auto Responder</span>
          <Switch checked={autoReplyEnabled} onChange={setAutoReplyEnabled} />
          <Button size="sm" variant="secondary" onClick={() => setEditorOpen(true)}>
            <ISettings2 className="mr-2 h-4 w-4" /> Rules
          </Button>
          <input
            type="file"
            accept="application/json"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => handleImportFile(e.target.files?.[0])}
          />
          <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <IUpload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'auto-responder-rules.json';
              a.click();
            }}
          >
            <IFileJson className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left */}
        <aside className="w-[420px] shrink-0 border-r bg-background">
          <div className="space-y-3 p-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">SDK → DevTools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <span>CDP Message JSON </span>
                  <Badge variant="blue">Send lynx_message to iframe</Badge>
                </div>
                <Textarea rows={6} className="code" placeholder='{"id":1, "result":{}}' value={sdkInput} onChange={(e) => setSdkInput(e.target.value)} />
                <div className="flex items-center gap-2">
                  <Button onClick={sendSdkToDevTools}>
                    <ISend className="mr-2 h-4 w-4" /> Send
                  </Button>
                  <Button variant="secondary" onClick={() => setSdkInput('')}>Clear</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Host → DevTools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <span>Host Message JSON </span>
                  <Badge variant="purple">inspect-devtool-message</Badge>
                </div>
                <Textarea rows={6} className="code" placeholder='{"type":"a11y_mark_lynx","payload":{}}' value={devtoolsInput} onChange={(e) => setDevtoolsInput(e.target.value)} />
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={sendHostToDevTools}>Send</Button>
                  <Button variant="secondary" onClick={() => setDevtoolsInput('')}>Clear</Button>
                </div>
              </CardContent>
            </Card>

            <Tabs
              value={view}
              onValueChange={(v) => setView(v as 'log' | 'raw')}
              items={[{ label: 'Log', value: 'log' }, { label: 'RAW JSON', value: 'raw' }]}
              className="w-full"
            />
            <div className="h-80 overflow-auto rounded-md border bg-muted/30 p-2">
              {view === 'log' ? (
                <div className="flex flex-col">
                  {messages.map((m, idx) => (
                    <div key={idx} className="py-1">
                      <code className="text-xs text-muted-foreground">{new Date(m.ts).toLocaleTimeString()}</code>{' '}
                      <Badge variant={m.from === 'DevTools' ? 'blue' : m.from === 'SDK' ? 'green' : 'purple'}>{m.from}</Badge>{' '}
                      <Badge>{m.direction}</Badge>{' '}
                      <Badge variant="blue">{m.type}</Badge>
                      <div className="code mt-1 select-text break-words">
                        {typeof m.payload === 'string' ? m.payload : JSON.stringify(m.payload)}
                      </div>
                      <Separator className="my-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="code m-0 whitespace-pre-wrap">{JSON.stringify(messages, null, 2)}</pre>
              )}
            </div>
          </div>
        </aside>

        {/* Right */}
        <main className="min-w-0 flex-1">
          <div className="iframe-wrapper">
            {iframeSrc ? (
              <iframe ref={iframeRef} className="iframe" src={iframeSrc} onLoad={onIframeLoad} />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                <div className="flex items-center gap-2">
                  <ICode2 className="h-5 w-5" />
                  <span>Please enter the DevTools Frontend address to load.</span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Rules Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen} title="Auto Responder Rules" width={880}>
        <div className="space-y-3">
          <Table data={rules} rowKey={(r) => r.id} columns={rulesColumns} />
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                const newRule: AutoResponseRule = {
                  id: generateRuleId(),
                  method: 'Domain.method',
                  enabled: true,
                  response: { result: {} },
                };
                const next = [newRule, ...rules];
                setRules(next);
                saveRules(next);
              }}
            >
              Add Rule
            </Button>
            <Button variant="secondary" onClick={() => { const def = clone(DEFAULT_RULES); setRules(def); saveRules(def); }}>
              Reset to Default
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}


