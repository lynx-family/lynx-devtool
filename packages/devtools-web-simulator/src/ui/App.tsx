import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Col, Divider, Flex, Form, Input, Layout, Row, Segmented, Space, Tag, Typography } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text, Paragraph } = Typography;

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

  return (
    <Layout className="layout">
      <Header style={{ background: '#262a7a', padding: 12 }}>
        <Space wrap>
          <Text style={{ color: '#e2e8f0' }} strong>DevTools Simulator</Text>
          <Input
            style={{ width: 420 }}
            placeholder="DevTools Frontend Server (ex. http://localhost:8000/devtools_app.html)"
            value={devtoolsUrl}
            onChange={(e) => setDevtoolsUrl(e.target.value)}
          />
          <Input style={{ width: 120, backgroundColor: '#fff' }} addonBefore="session" value={sessionId} onChange={(e) => setSessionId(Number(e.target.value || 0))} />
          <Input style={{ width: 120, backgroundColor: '#fff' }} addonBefore="client" value={clientId} onChange={(e) => setClientId(Number(e.target.value || 0))} />
          <Button type="primary" onClick={() => iframeRef.current?.contentWindow ? lynxOpen() : null}>Reset</Button>
        </Space>
      </Header>
      <Layout>
        <Sider width={420} theme="light" style={{ borderRight: '1px solid #eee' }}>
          <div style={{ padding: 12 }}>
            <Card size="small" title="SDK -> DevTools">
              <Form layout="vertical">
                <Form.Item label={<span>CDP Message JSON <Tag color="blue">Send lynx_message to iframe</Tag></span>}>
                  <Input.TextArea rows={6} className="code" placeholder='{"id":1, "result":{}}' value={sdkInput} onChange={(e) => setSdkInput(e.target.value)} />
                </Form.Item>
                <Space>
                  <Button type="primary" onClick={sendSdkToDevTools}>Send</Button>
                  <Button onClick={() => setSdkInput('')}>Clear</Button>
                </Space>
              </Form>
            </Card>
            <Divider />
            <Card size="small" title="Host -> DevTools">
              <Form layout="vertical">
                <Form.Item label={<span>Host Message JSON <Tag color="purple">inspect-devtool-message</Tag></span>}>
                  <Input.TextArea rows={6} className="code" placeholder='{"type":"a11y_mark_lynx","payload":{}}' value={devtoolsInput} onChange={(e) => setDevtoolsInput(e.target.value)} />
                </Form.Item>
                <Space>
                  <Button onClick={sendHostToDevTools}>Send</Button>
                  <Button onClick={() => setDevtoolsInput('')}>Clear</Button>
                </Space>
              </Form>
            </Card>
            <Divider />
            <Segmented
              block
              options={[{ label: 'Log', value: 'log' }, { label: 'RAW JSON', value: 'raw' }]}
              value={view}
              onChange={(v) => setView(v as any)}
            />
            <div style={{ marginTop: 12, height: 320, overflow: 'auto', background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
              {view === 'log' ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {messages.map((m, idx) => (
                    <div key={idx}>
                      <Text code>{new Date(m.ts).toLocaleTimeString()}</Text>{' '}
                      <Tag color={m.from === 'DevTools' ? 'geekblue' : m.from === 'SDK' ? 'green' : 'purple'}>{m.from}</Tag>
                      <Tag>{m.direction}</Tag>
                      <Tag color="blue">{m.type}</Tag>
                      <Paragraph className="code" style={{ marginTop: 4 }} copyable>{typeof m.payload === 'string' ? m.payload : JSON.stringify(m.payload)}</Paragraph>
                      <Divider style={{ margin: '8px 0' }} />
                    </div>
                  ))}
                </Space>
              ) : (
                <pre className="code" style={{ margin: 0 }}>{JSON.stringify(messages, null, 2)}</pre>
              )}
            </div>
          </div>
        </Sider>
        <Content>
          <div className="iframe-wrapper">
            {iframeSrc ? (
              <iframe ref={iframeRef} className="iframe" src={iframeSrc} onLoad={onIframeLoad} />
            ) : (
              <Flex align="center" justify="center" style={{ height: '100%', color: '#94a3b8' }}>
                <Row gutter={16}>
                  <Col>
                    <Text>Please enter the DevTools Frontend address to load.</Text>
                  </Col>
                </Row>
              </Flex>
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}


