// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import React from 'react';
import { Modal, Tabs, Empty } from 'antd';
import { DiffEditor } from '@monaco-editor/react';
import { FileChange } from '../types/protocol';

interface DiffViewerProps {
  visible: boolean;
  changes: Record<string, FileChange>;
  onClose: () => void;
}

function getOriginalAndModified(
  filePath: string,
  change: FileChange
): { original: string; modified: string } {
  if (change.type === 'add') {
    return { original: '', modified: change.content ?? '' };
  }
  if (change.type === 'delete') {
    return { original: change.content ?? '', modified: '' };
  }
  // update: show unified diff as modified, original empty (approximation)
  return { original: '', modified: change.unified_diff ?? change.content ?? '' };
}

function inferLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    py: 'python',
    go: 'go',
    rs: 'rust',
    css: 'css',
    scss: 'scss',
    html: 'html',
    md: 'markdown',
    sh: 'shell',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    h: 'c'
  };
  return langMap[ext ?? ''] ?? 'plaintext';
}

export function DiffViewer({ visible, changes, onClose }: DiffViewerProps) {
  const fileEntries = Object.entries(changes);

  if (fileEntries.length === 0) {
    return (
      <Modal
        open={visible}
        onCancel={onClose}
        footer={null}
        title="File Changes"
        width="80vw"
      >
        <Empty description="No file changes" />
      </Modal>
    );
  }

  const tabItems = fileEntries.map(([filePath, change]) => {
    const { original, modified } = getOriginalAndModified(filePath, change);
    const lang = inferLanguage(filePath);
    const shortName = filePath.split('/').pop() ?? filePath;

    return {
      key: filePath,
      label: (
        <span style={{ fontSize: 12, fontFamily: 'monospace' }} title={filePath}>
          {shortName}
        </span>
      ),
      children: (
        <DiffEditor
          height={400}
          language={lang}
          original={original}
          modified={modified}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            wordWrap: 'on'
          }}
          theme="vs-dark"
        />
      )
    };
  });

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      title="File Changes"
      width="80vw"
      styles={{ body: { padding: '8px 0 0' } }}
    >
      {fileEntries.length === 1 ? (
        <DiffEditor
          height={400}
          language={inferLanguage(fileEntries[0][0])}
          original={getOriginalAndModified(fileEntries[0][0], fileEntries[0][1]).original}
          modified={getOriginalAndModified(fileEntries[0][0], fileEntries[0][1]).modified}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            wordWrap: 'on'
          }}
          theme="vs-dark"
        />
      ) : (
        <Tabs items={tabItems} size="small" style={{ padding: '0 16px' }} />
      )}
    </Modal>
  );
}
