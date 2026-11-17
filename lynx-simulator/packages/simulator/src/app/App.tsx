// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useState } from '@lynx-js/react';
import './App.css';
import LynxDarkLogo from '@assets/lynx-dark-logo.svg?inline';
import LynxLightLogo from '@assets/lynx-light-logo.svg?inline';
import { SizePicker } from './components/size-picker';
import {
  CONNECT_DEVTOOL_JSB,
  OPEN_PAGE_JSB,
  connectDevTool,
  openPage,
  type OpenPagePayload,
} from './services/bridge';
import type { InputEvent, JSBResult, SizeSelection } from './shared/types';
import { formatJSBError, getGlobalTheme } from './shared/utils';

type Feedback = {
  type: 'error' | 'success';
  message: string;
};

export function App() {
  const [target, setTarget] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isConnectionExpanded, setIsConnectionExpanded] = useState(false);
  const [devToolUrl, setDevToolUrl] = useState('');
  const [sizeSelection, setSizeSelection] = useState<SizeSelection>({
    mode: 'default',
  });
  const theme = getGlobalTheme();
  const isDark = theme === 'dark';
  const logo = isDark ? LynxLightLogo : LynxDarkLogo;
  const withTheme = (className: string) => `${className} ${className}--${theme}`;

  const handleTargetInput = (event: InputEvent) => {
    'background only';
    setTarget(event.detail?.value?.trim() ?? '');
    setFeedback(null);
  };

  const handleSizeSelectionChange = (selection: SizeSelection) => {
    'background only';
    setSizeSelection(selection);
    setFeedback(null);
  };

  const handleOpenTarget = () => {
    'background only';
    if (!target) {
      setFeedback({
        type: 'error',
        message: 'Please enter a Lynx bundle URL or local path.',
      });
      return;
    }

    setFeedback(null);
    openPage(
      {
        target,
        ...getOpenSizePayload(),
      },
      (result: JSBResult) => {
        if (result?.ok === false) {
          setFeedback({
            type: 'error',
            message: formatJSBError(OPEN_PAGE_JSB, result),
          });
        }
      }
    );
  };

  const handleDevToolUrlInput = (event: InputEvent) => {
    'background only';
    setDevToolUrl(event.detail?.value?.trim() ?? '');
    setFeedback(null);
  };

  const handleConnectDevTool = () => {
    'background only';
    if (!devToolUrl) {
      setFeedback({ type: 'error', message: 'Please enter a DevTool URL.' });
      return;
    }

    setFeedback(null);
    connectDevTool({ url: devToolUrl }, (result) => {
      if (result?.ok === false) {
        setFeedback({
          type: 'error',
          message: formatJSBError(CONNECT_DEVTOOL_JSB, result),
        });
        return;
      }
      setFeedback({ type: 'success', message: 'Connection request sent.' });
    });
  };

  const handleToggleConnection = () => {
    'background only';
    setIsConnectionExpanded(!isConnectionExpanded);
  };

  const getOpenSizePayload = (): Omit<OpenPagePayload, 'target'> => {
    if (sizeSelection.mode === 'device') {
      return {
        device: sizeSelection.device.name,
      };
    }

    if (sizeSelection.mode === 'custom') {
      return {
        size: {
          width: sizeSelection.size.width,
          height: sizeSelection.size.height,
        },
      };
    }

    return {};
  };

  return (
    <view className={withTheme('Page')}>
      <view className={withTheme('Panel')}>
        <svg src={logo} className="logo" />
        <input
          className={withTheme('Input')}
          bindinput={handleTargetInput}
          placeholder="Enter Lynx bundle URL or local path"
          text-color={isDark ? '#f9fafb' : '#111827'}
        />
        <SizePicker onChange={handleSizeSelectionChange} />
        <view className={`${withTheme('ActionButton')} OpenButton`} bindtap={handleOpenTarget}>
          <text className="ActionButtonText">Open</text>
        </view>
        <view className={withTheme('ConnectionTrigger')} bindtap={handleToggleConnection}>
          <text className={withTheme('ConnectionTriggerText')}>Wi-Fi Connection</text>
          <text className={withTheme('ConnectionTriggerIcon')}>
            {isConnectionExpanded ? '^' : 'v'}
          </text>
        </view>
        {isConnectionExpanded ? (
          <view className="ConnectionRow">
            <input
              className={`${withTheme('Input')} ConnectionInput`}
              bindinput={handleDevToolUrlInput}
              placeholder="Enter DevTool URL"
              text-color={isDark ? '#f9fafb' : '#111827'}
            />
            <view
              className={`${withTheme('ActionButton')} ConnectButton`}
              bindtap={handleConnectDevTool}
            >
              <text className="ActionButtonText">Connect</text>
            </view>
          </view>
        ) : null}
        {feedback ? (
          <view
            className={withTheme(feedback.type === 'error' ? 'FeedbackError' : 'FeedbackSuccess')}
          >
            <text
              className={withTheme(
                feedback.type === 'error' ? 'FeedbackErrorText' : 'FeedbackSuccessText'
              )}
              text-selection={true}
            >
              {feedback.message}
            </text>
          </view>
        ) : null}
      </view>
    </view>
  );
}
