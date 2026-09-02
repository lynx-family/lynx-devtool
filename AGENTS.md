# Agent Notes

## Codex Agent: Log-Driven Debugging

- For `plugins/codex-agent` issues, prefer reading the debug log directly instead of asking the user to copy large log blocks back into chat.
- The Codex panel has a `Debug On` toggle. Enabling it clears the in-memory debug list and resets the on-disk JSONL log file before new events are appended.
- The log file path is exposed by the main bridge via `getDebugLogFilePath()` and is also shown in the Codex debug panel.
- Current implementation writes the file under `${os.tmpdir()}/lynx-devtool-codex-agent/codex-debug.log`.

## Recommended Workflow

1. Turn on `Debug On` in the Codex panel.
2. Reproduce the problem in a fresh Codex thread if the issue may depend on newly injected MCP config, developer instructions, or skill content.
3. Read the log file directly from disk.
4. Inspect events in this order:
   - `thread/start` request payload
   - `mcpServer/startupStatus/updated`
   - `mcpServer/elicitation/request` or renderer-side `approval-requested`
   - tool-call request/response pairs such as `proxy-send_cdp` and `proxy-send_cdp-result`
   - `thread/status/changed`, `turn/interrupt`, and tool errors

## Fast Triage Rules

- If the thread sits in `thinking` and the log shows `mcpServer/elicitation/request` plus `waitingOnApproval`, check approval-dialog plumbing before debugging CDP transport.
- If MCP startup never reaches `ready`, inspect the spawned MCP process protocol and handshake first.
- If a tool succeeds but the model still gives weak answers, inspect the returned structured payload before changing prompts or instructions.
