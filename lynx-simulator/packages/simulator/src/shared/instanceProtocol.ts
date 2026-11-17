// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface InstanceRequest {
  /**
   * One newline-terminated JSON object is sent per IPC connection.
   *
   * Example:
   * {
   *   "command": "open",
   *   "instanceId": "sim_mabc12_x3k9q1",
   *   "rawArgv": ["open", "file:///tmp/main.js", "--instance", "sim_mabc12_x3k9q1"]
   * }
   *
   * The launcher only uses --instance for routing. The simulator app parses
   * rawArgv to understand the command and its options.
   */
  command: string;
  instanceId: string;
  rawArgv?: string[];
}

export interface InstanceResponse {
  /**
   * Common response shape for IPC commands.
   *
   * `ok` is always present. Other fields depend on the command.
   *
   * Success example:
   * { "ok": true, "instanceId": "sim_xxx", "windowId": "win_xxx" }
   *
   * Error example:
   * { "ok": false, "code": "WINDOW_NOT_FOUND", "message": "Window not found: win_xxx" }
   */
  ok: boolean;
  [key: string]: unknown;
}
