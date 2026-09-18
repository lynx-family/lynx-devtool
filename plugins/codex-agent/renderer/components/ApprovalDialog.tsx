// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import React, { useState } from 'react';
import { Modal, Button, Tag, Space, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import {
  ExecDetails,
  McpApprovalDetails,
  PendingApproval,
  PatchDetails
} from '../types/protocol';
import { DiffViewer } from './DiffViewer';

const { Text, Paragraph } = Typography;

interface ApprovalDialogProps {
  approval: PendingApproval | null;
  onApprove: () => void;
  onDeny: () => void;
}

function PatchApprovalContent({
  details,
  onViewDiff
}: {
  details: PatchDetails;
  onViewDiff: () => void;
}) {
  const fileEntries = Object.entries(details.fileChanges ?? {});

  return (
    <div>
      {details.reason && (
        <Paragraph style={{ marginBottom: 12 }}>
          <Text type="secondary">{details.reason}</Text>
        </Paragraph>
      )}
      {details.grantRoot && (
        <Paragraph style={{ marginBottom: 12 }}>
          <Text type="secondary">Requested writable root: {details.grantRoot}</Text>
        </Paragraph>
      )}
      <div style={{ marginBottom: 12 }}>
        <Text strong>Affected files:</Text>
        {fileEntries.length > 0 ? (
          <div style={{ marginTop: 6 }}>
            {fileEntries.map(([filePath, change]) => (
              <div
                key={filePath}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '3px 0',
                  fontSize: 13
                }}
              >
                <Tag
                  color={
                    change.type === 'add' ? 'green' : change.type === 'delete' ? 'red' : 'blue'
                  }
                  style={{ margin: 0, minWidth: 46, textAlign: 'center' }}
                >
                  {change.type}
                </Tag>
                <Text
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                  ellipsis={{ tooltip: filePath }}
                >
                  {filePath}
                </Text>
              </div>
            ))}
          </div>
        ) : (
          <Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
            Diff details are not available for this approval request yet.
          </Paragraph>
        )}
      </div>
      {fileEntries.length > 0 && (
        <Button size="small" onClick={onViewDiff} style={{ marginBottom: 4 }}>
          View Diff
        </Button>
      )}
    </div>
  );
}

function ExecApprovalContent({ details }: { details: ExecDetails }) {
  const commandStr = Array.isArray(details.command)
    ? details.command.join(' ')
    : details.command ?? 'Command details unavailable';
  return (
    <div>
      {details.reason && (
        <Paragraph style={{ marginBottom: 12 }}>
          <Text type="secondary">{details.reason}</Text>
        </Paragraph>
      )}
      <div style={{ marginBottom: 8 }}>
        <Text strong>Command:</Text>
        <pre
          style={{
            marginTop: 6,
            padding: '8px 12px',
            background: '#1e1e1e',
            color: '#d4d4d4',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {commandStr}
        </pre>
      </div>
      <div>
        <Text strong>Working directory: </Text>
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {details.cwd ?? 'Unknown'}
        </Text>
      </div>
    </div>
  );
}

function formatApprovalValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

function McpApprovalContent({ details }: { details: McpApprovalDetails }) {
  const displayParams = details.toolParamsDisplay ?? [];
  const hasStructuredParams = displayParams.length > 0;
  const requestedSchemaText =
    details.mode === 'form' && details.requestedSchema
      ? formatApprovalValue(details.requestedSchema)
      : null;

  return (
    <div>
      {details.message && (
        <Paragraph style={{ marginBottom: 12 }}>
          <Text type="secondary">{details.message}</Text>
        </Paragraph>
      )}
      <Space size={[8, 8]} wrap style={{ marginBottom: 12 }}>
        {details.serverName && <Tag color="blue">{details.serverName}</Tag>}
        {details.approvalKind && <Tag>{details.approvalKind}</Tag>}
        {details.mode && <Tag>{details.mode}</Tag>}
      </Space>
      {details.toolTitle && (
        <div style={{ marginBottom: 8 }}>
          <Text strong>Tool:</Text>{' '}
          <Text>{details.toolTitle}</Text>
        </div>
      )}
      {details.toolDescription && (
        <Paragraph style={{ marginBottom: 12 }}>
          <Text type="secondary">{details.toolDescription}</Text>
        </Paragraph>
      )}
      {hasStructuredParams && (
        <div style={{ marginBottom: 12 }}>
          <Text strong>Parameters:</Text>
          <div style={{ marginTop: 6 }}>
            {displayParams.map((param) => (
              <div key={param.name} style={{ marginBottom: 10 }}>
                <Text strong>{param.displayName ?? param.name}</Text>
                <pre
                  style={{
                    marginTop: 6,
                    marginBottom: 0,
                    padding: '8px 12px',
                    background: '#1e1e1e',
                    color: '#d4d4d4',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}
                >
                  {formatApprovalValue(param.value)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
      {!hasStructuredParams && details.toolParams !== undefined && (
        <div style={{ marginBottom: 12 }}>
          <Text strong>Parameters:</Text>
          <pre
            style={{
              marginTop: 6,
              marginBottom: 0,
              padding: '8px 12px',
              background: '#1e1e1e',
              color: '#d4d4d4',
              borderRadius: 4,
              fontFamily: 'monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {formatApprovalValue(details.toolParams)}
          </pre>
        </div>
      )}
      {details.url && (
        <div style={{ marginBottom: 12 }}>
          <Text strong>Approval URL: </Text>
          <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {details.url}
          </Text>
        </div>
      )}
      {requestedSchemaText && requestedSchemaText !== '{}' && (
        <div>
          <Text strong>Requested schema:</Text>
          <pre
            style={{
              marginTop: 6,
              marginBottom: 0,
              padding: '8px 12px',
              background: '#fafafa',
              color: '#595959',
              borderRadius: 4,
              fontFamily: 'monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {requestedSchemaText}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ApprovalDialog({ approval, onApprove, onDeny }: ApprovalDialogProps) {
  const [showDiff, setShowDiff] = useState(false);

  if (!approval) return null;

  const isPatch = approval.type === 'patch';
  const isExec = approval.type === 'exec';
  const isMcp = approval.type === 'mcp';
  const title = isPatch ? 'Apply File Changes?' : isExec ? 'Run Command?' : 'Allow MCP Tool?';
  const patchDetails = isPatch ? (approval.details as PatchDetails) : null;
  const execDetails = isExec ? (approval.details as ExecDetails) : null;
  const mcpDetails = isMcp ? (approval.details as McpApprovalDetails) : null;
  const approveLabel = isPatch ? 'Apply' : 'Allow';

  return (
    <>
      <Modal
        open={true}
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            {title}
          </Space>
        }
        onCancel={onDeny}
        footer={
          <Space>
            <Button onClick={onDeny} danger>
              Deny
            </Button>
            <Button type="primary" onClick={onApprove}>
              {approveLabel}
            </Button>
          </Space>
        }
        width={560}
      >
        {isPatch && patchDetails && (
          <PatchApprovalContent
            details={patchDetails}
            onViewDiff={() => setShowDiff(true)}
          />
        )}
        {isExec && execDetails && <ExecApprovalContent details={execDetails} />}
        {isMcp && mcpDetails && <McpApprovalContent details={mcpDetails} />}
      </Modal>

      {isPatch && patchDetails && showDiff && (
        <DiffViewer
          visible={showDiff}
          changes={patchDetails.fileChanges}
          onClose={() => setShowDiff(false)}
        />
      )}
    </>
  );
}
