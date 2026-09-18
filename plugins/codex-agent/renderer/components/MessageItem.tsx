// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import React, { CSSProperties, useState } from 'react';
import { Badge, Collapse, Spin, Tag } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  DiffOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { ChatEntry, TextEntry, ToolEntry } from '../types/protocol';

interface MessageItemProps {
  entry: ChatEntry;
}

// ─── Simple Markdown-like text renderer ─────────────────────────────────────

function renderTextWithCode(text: string): React.ReactNode[] {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const lines = part.split('\n');
      const firstLine = lines[0].replace('```', '').trim();
      const lang = firstLine || 'code';
      const code = lines.slice(1, lines.length - 1).join('\n');
      return (
        <pre
          key={i}
          style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: '10px 12px',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
            overflowX: 'auto',
            margin: '8px 0',
            position: 'relative'
          }}
        >
          <Tag
            color="blue"
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              fontSize: 10,
              lineHeight: '16px',
              padding: '0 4px'
            }}
          >
            {lang}
          </Tag>
          {code}
        </pre>
      );
    }
    return (
      <span key={i} style={{ whiteSpace: 'pre-wrap' }}>
        {part}
      </span>
    );
  });
}

// ─── Text Entry Component ────────────────────────────────────────────────────

function TextEntryView({ entry }: { entry: TextEntry }) {
  const isUser = entry.role === 'user';

  const containerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: isUser ? 'flex-end' : 'flex-start',
    marginBottom: 12,
    padding: '0 8px'
  };

  const bubbleStyle: CSSProperties = {
    maxWidth: '80%',
    padding: '8px 12px',
    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
    background: isUser ? '#1677ff' : '#f0f0f0',
    color: isUser ? '#fff' : '#000',
    fontSize: 13,
    lineHeight: 1.6,
    wordBreak: 'break-word'
  };

  return (
    <div style={containerStyle}>
      <div style={bubbleStyle}>
        {renderTextWithCode(entry.content)}
        {entry.streaming && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              background: 'currentColor',
              marginLeft: 2,
              verticalAlign: 'middle',
              animation: 'codex-blink 1s step-end infinite'
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tool Entry Component ────────────────────────────────────────────────────

function ToolEntryView({ entry }: { entry: ToolEntry }) {
  const [collapsed, setCollapsed] = useState(true);

  const statusIcon = () => {
    if (entry.status === 'running') {
      return <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />;
    }
    if (entry.status === 'done') {
      return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />;
    }
    return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />;
  };

  const toolIcon =
    entry.toolType === 'exec' ? (
      <CodeOutlined style={{ color: '#1677ff' }} />
    ) : (
      <DiffOutlined style={{ color: '#722ed1' }} />
    );

  const containerStyle: CSSProperties = {
    margin: '6px 8px',
    border: '1px solid #d9d9d9',
    borderRadius: 6,
    background: '#fafafa',
    overflow: 'hidden'
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    cursor: entry.toolType === 'exec' && entry.output ? 'pointer' : 'default',
    userSelect: 'none'
  };

  const titleStyle: CSSProperties = {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const handleHeaderClick = () => {
    if (entry.toolType === 'exec' && entry.output) {
      setCollapsed((c) => !c);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle} onClick={handleHeaderClick}>
        {toolIcon}
        <span style={titleStyle}>{entry.title}</span>
        {statusIcon()}
      </div>

      {entry.toolType === 'exec' && entry.output && !collapsed && (
        <pre
          style={{
            margin: 0,
            padding: '6px 10px',
            borderTop: '1px solid #e8e8e8',
            background: '#1e1e1e',
            color: '#d4d4d4',
            fontSize: 11,
            fontFamily: 'monospace',
            maxHeight: 200,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {entry.output}
        </pre>
      )}

      {entry.toolType === 'patch' && entry.fileChanges && (
        <div style={{ padding: '4px 10px 8px', borderTop: '1px solid #e8e8e8' }}>
          {Object.entries(entry.fileChanges).map(([filePath, change]) => (
            <div
              key={filePath}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#555',
                padding: '2px 0'
              }}
            >
              <Tag
                color={
                  change.type === 'add'
                    ? 'green'
                    : change.type === 'delete'
                    ? 'red'
                    : 'blue'
                }
                style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
              >
                {change.type}
              </Tag>
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{filePath}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function MessageItem({ entry }: MessageItemProps) {
  if (entry.kind === 'text') {
    return <TextEntryView entry={entry} />;
  }
  return <ToolEntryView entry={entry} />;
}
