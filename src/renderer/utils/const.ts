// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const KEY_AUTO_FOCUS_LAST_SESSION = 'autoFocusOnLastSession';
const TRACING_EVENT_COMPLETE = 'Tracing.tracingComplete';
const TESTBENCH_EVENT_COMPLETE = 'Recording.recordingComplete';
const TRACING_METHOD_START = 'Tracing.start';
const TRACING_METHOD_END = 'Tracing.end';
const TRACING_IO_READ = 'IO.read';
const EVENT_CUSTOMIZED = 'Customized';
const EVENT_PING = 'Ping';
const EVENT_PONG = 'Pong';
const MEMORY_EVENT_UPLOADIMAGEINFO = 'Memory.uploadImageInfo';
const ONLINE_URL = 'http://devtool.bytedance.net';
const SYNC_UNATTACHED = 'sync_unattached';
const KEY_USE_VPN_IP = 'useVpnIp';

const MSG_GetScreenshot = 'Lynx.getScreenshot';
const MSG_ScreenshotCaptured = 'Lynx.screenshotCaptured';
const MSG_SetGlobalSwitch = 'SetGlobalSwitch';
const MSG_GetGlobalSwitch = 'GetGlobalSwitch';
const MSG_SELECT_SESSION = 'selectSession';
const MSG_SET_CARD_FILTER = 'LDT.setCardFilter';

const LDT_CONST = {
  KEY_AUTO_FOCUS_LAST_SESSION,
  EVENT_CUSTOMIZED,
  EVENT_PING,
  EVENT_PONG,
  TRACING_EVENT_COMPLETE,
  TESTBENCH_EVENT_COMPLETE,
  TRACING_METHOD_START,
  TRACING_METHOD_END,
  TRACING_IO_READ,
  MSG_GetScreenshot,
  MSG_ScreenshotCaptured,
  MSG_SetGlobalSwitch,
  MSG_GetGlobalSwitch,
  MSG_SELECT_SESSION,
  MEMORY_EVENT_UPLOADIMAGEINFO,
  ONLINE_URL,
  SYNC_UNATTACHED,
  MSG_SET_CARD_FILTER,
  KEY_USE_VPN_IP
};

export default LDT_CONST;
