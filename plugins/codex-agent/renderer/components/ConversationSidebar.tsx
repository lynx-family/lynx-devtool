// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import React from 'react';
import { Button, Empty, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ConversationHistoryItem } from '../types/protocol';

const { Text } = Typography;

type ConversationSidebarProps = {
  currentTitle: string;
  currentPreview: string;
  currentUpdatedAt?: number | null;
  historyItems: ConversationHistoryItem[];
  selectedHistoryId: string | null;
  onSelectCurrent: () => void;
  onSelectHistory: (conversationId: string) => void;
  onStartNewConversation: () => void;
  footerContent?: React.ReactNode;
};

function formatTimestamp(timestamp?: number | null): string {
  if (!timestamp) {
    return 'Now';
  }

  try {
    return new Date(timestamp).toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return 'Recent';
  }
}

function ConversationRow({
  title,
  preview,
  timestamp,
  selected,
  badge,
  onClick
}: {
  title: string;
  preview: string;
  timestamp?: number | null;
  selected: boolean;
  badge: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 8,
        border: selected ? '1px solid #91caff' : '1px solid #f0f0f0',
        background: selected ? '#e6f4ff' : '#fff',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text
          strong
          style={{
            flex: 1,
            fontSize: 12,
            color: '#1f1f1f'
          }}
          ellipsis
        >
          {title}
        </Text>
        <span
          style={{
            fontSize: 10,
            lineHeight: 1,
            padding: '3px 6px',
            borderRadius: 999,
            background: selected ? '#bae0ff' : '#f5f5f5',
            color: '#595959',
            whiteSpace: 'nowrap'
          }}
        >
          {badge}
        </span>
      </div>
      <Text
        style={{
          fontSize: 11,
          lineHeight: 1.4,
          color: '#8c8c8c'
        }}
        ellipsis={{ rows: 2 }}
      >
        {preview}
      </Text>
      <Text style={{ fontSize: 10, color: '#bfbfbf' }}>{formatTimestamp(timestamp)}</Text>
    </button>
  );
}

export function ConversationSidebar({
  currentTitle,
  currentPreview,
  currentUpdatedAt,
  historyItems,
  selectedHistoryId,
  onSelectCurrent,
  onSelectHistory,
  onStartNewConversation,
  footerContent
}: ConversationSidebarProps) {
  return (
    <aside
      style={{
        width: 248,
        borderRight: '1px solid #f0f0f0',
        background: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }}
    >
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text strong style={{ fontSize: 12, color: '#595959' }}>
            Conversations
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={onStartNewConversation} block>
          New conversation
        </Button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Current</Text>
          <ConversationRow
            title={currentTitle}
            preview={currentPreview}
            timestamp={currentUpdatedAt}
            selected={selectedHistoryId === null}
            badge="Live"
            onClick={onSelectCurrent}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>History</Text>
          {historyItems.length === 0 ? (
            <div
              style={{
                border: '1px dashed #d9d9d9',
                borderRadius: 8,
                background: '#fff'
              }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                    Archived conversations will appear here after you start a new one.
                  </Text>
                }
                style={{ margin: '18px 0' }}
              />
            </div>
          ) : (
            historyItems.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                title={conversation.title}
                preview={conversation.preview}
                timestamp={conversation.updatedAt}
                selected={selectedHistoryId === conversation.id}
                badge="Archived"
                onClick={() => onSelectHistory(conversation.id)}
              />
            ))
          )}
        </div>
      </div>

      {footerContent && (
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid #f0f0f0',
            background: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          {footerContent}
        </div>
      )}
    </aside>
  );
}
