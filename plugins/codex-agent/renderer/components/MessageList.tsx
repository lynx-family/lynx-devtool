// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import React, { CSSProperties, useEffect, useRef } from 'react';
import { ChatEntry } from '../types/protocol';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  entries: ChatEntry[];
  style?: CSSProperties;
  emptyStateText?: string;
}

export function MessageList({ entries, style, emptyStateText = 'Start a conversation with Codex' }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 0',
        ...style
      }}
    >
      {entries.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#999',
            fontSize: 13
          }}
        >
          {emptyStateText}
        </div>
      ) : (
        entries.map((entry, idx) => (
          <MessageItem
            key={
              entry.kind === 'text'
                ? `text-${idx}-${entry.itemId ?? ''}`
                : `tool-${entry.callId}`
            }
            entry={entry}
          />
        ))
      )}
    </div>
  );
}
