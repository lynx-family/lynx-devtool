// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable max-lines-per-function */
import useConnection from '@/renderer/hooks/connection';
import { viewMode } from '@/renderer/utils';
import { DownOutlined, CopyOutlined, PictureOutlined, SearchOutlined } from '@ant-design/icons';
import { Dropdown, Input, Popover, Tag, message } from 'antd';
import copy from 'copy-text-to-clipboard';
import { useEffect, useRef } from 'react';
import './SessionSelect.scss';
import SessionSelectHeader from './SessionSelectHeader';

const SessionSelect = () => {
  const { deviceInfoMap, selectedDevice, cardFilter, setCardFilter, setSelectedSession } = useConnection();
  if (viewMode !== 'mobile' || !selectedDevice.clientId) {
    return null;
  }
  const deviceInfo = deviceInfoMap[selectedDevice.clientId];

  if (!deviceInfo) {
    return null;
  }

  const getDeviceText = () => {
    const { sessions, selectedSession } = deviceInfo;
    if (!sessions || sessions.length === 0) {
      return 'Please open a card';
    }
    return selectedSession?.url;
  };

  const getSessionTagColor = (session) => {
    if (session.type === 'web') {
      return 'blue';
    }
    if (session.type === 'worker') {
      return 'green';
    }
    return 'gold';
  };

  const handleSelectSession = (session) => {
    if (session.url.includes(cardFilter)) {
      setSelectedSession(session.session_id);
    }
  };

  const SessionItem = () => {
    const inputRef = useRef<any>();
          // fix: When filtering cards with input, if card switching occurs, the card selection page will close due to focus issues
    useEffect(() => {
      const focusInput = () => {
        setTimeout(() => {
          window.focus();
          inputRef.current?.focus();
        }, 0);
      };
      window.addEventListener('blur', focusInput);
      return () => {
        window.removeEventListener('blur', focusInput);
      };
    }, []);
    return (
      <div className="device-select-wrapper">
        <SessionSelectHeader />
        <div className="session-header">
          <div className="title">Card List</div>
          <Input
            ref={inputRef}
            placeholder="Search cards"
            className="flex-1"
            size="small"
            prefix={<SearchOutlined />}
            allowClear
            autoFocus
            value={cardFilter}
            onChange={(e) => {
              setCardFilter(e.target.value);
            }}
          />
        </div>
        <div className="device-session-list">
          {deviceInfo.sessions?.map((session) => (
            <Popover
              key={session.session_id}
              placement="leftTop"
              arrow
              content={
                <div className="session-item-popover">
                  {session.screenshot && (
                    <img
                      src={`data:image/jpeg;base64, ${session.screenshot}`}
                      alt="session-preview"
                      className="session-item-popover-content"
                    />
                  )}

                  <div className="session-item-popover-title">
                    <CopyOutlined
                      className="copy-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        copy(session.url);
                        message.success('Copy Success');
                      }}
                    />
                    {session.url}
                  </div>
                </div>
              }
            >
              <div
                className={`session-item${
                  deviceInfo.selectedSession?.session_id === session.session_id ? ' selected' : ''
                }${session.url.includes(cardFilter) ? '' : ' session-filtered-out'}`}
                onClick={() => handleSelectSession(session)}
              >
                <Tag color={getSessionTagColor(session)} style={{ marginRight: 5 }}>
                  {session.type === '' ? 'lynx' : session.type}
                </Tag>
                {session.url}
              </div>
            </Popover>
          ))}
          {(!deviceInfo.sessions || deviceInfo.sessions.length === 0) && <div className="session-empty">No cards available</div>}
        </div>
      </div>
    );
  };

  return (
    <Dropdown trigger={['hover']} dropdownRender={() => <SessionItem />}>
      <div className="session-select-button">
        <PictureOutlined />
        <div className="session-select-button-text">{getDeviceText()}</div>
        <DownOutlined />
      </div>
    </Dropdown>
  );
};
export default SessionSelect;
