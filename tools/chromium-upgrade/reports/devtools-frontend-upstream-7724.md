# Migration Report: devtools-frontend-upstream-7724

- Upstream path: `/Users/bytedance/workspace/codes/devtools-frontend-upstream-7724`
- Upstream branch: `chromium/7724`
- Upstream commit: `a429d5a8b2e78b92dc99ef220ca67c402cbe1a67`
- Upstream Chrome for tests: `147.0.7721.0`
- Upstream TypeScript: `5.9.3`
- Upstream ESLint: `9.39.1`
- Upstream Rollup: `4.22.4`
- Upstream @types/node: `24.10.0`

## Migration Map

| Priority | Category | Status | Local path | Upstream path | Upstream state | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | transport | rebase | `packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts` | `front_end/core/sdk/Connections.ts` | exists | Upstream switched to ConnectionTransport and session router abstractions; LynxConnection must rebase here. |
| P0 | host | rebase | `packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHost.ts` | `front_end/core/host/InspectorFrontendHost.ts` | exists | Keep Lynx embedder bridge and statistics helpers on top of the new host API. |
| P0 | host_api | rebase | `packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHostAPI.ts` | `front_end/core/host/InspectorFrontendHostAPI.ts` | exists | Reconcile event shape changes such as DispatchMessageChunk and ReattachMainTarget. |
| P0 | embedder | rebase | `packages/devtools-frontend-lynx/front_end/devtools_compatibility.js` | `front_end/devtools_compatibility.js` | exists | Hosted-mode and embedder shims must be ported carefully. |
| P0 | protocol_client | rebase | `packages/devtools-frontend-lynx/front_end/core/protocol_client/InspectorBackend.ts` | `front_end/core/protocol_client/InspectorBackend.ts` | exists | Reapply plugin bridge and env log helpers onto the new CDPConnection architecture. |
| P0 | protocol_source | rebase | `packages/devtools-frontend-lynx/v8/include/js_protocol.pdl` | `v8/include/js_protocol.pdl` | exists | Add Lynx domain and Debugger.removeScriptsForLynxView here first. |
| P0 | generated_protocol | derived | `packages/devtools-frontend-lynx/front_end/generated/InspectorBackendCommands.js` | `n/a` | derived | Regenerate from protocol sources; do not hand-port. |
| P0 | generated_protocol | derived | `packages/devtools-frontend-lynx/front_end/generated/protocol-proxy-api.d.ts` | `n/a` | derived | Regenerate from protocol sources; do not hand-port. |
| P0 | generated_protocol | derived | `packages/devtools-frontend-lynx/front_end/generated/protocol-mapping.d.ts` | `n/a` | derived | Regenerate from protocol sources; do not hand-port. |
| P0 | generated_protocol | derived | `packages/devtools-frontend-lynx/front_end/generated/protocol.d.ts` | `n/a` | derived | Regenerate from protocol sources; do not hand-port. |
| P0 | debugger | rebase | `packages/devtools-frontend-lynx/front_end/core/sdk/DebuggerModel.ts` | `front_end/core/sdk/DebuggerModel.ts` | exists | Reapply shared-context cleanup and Lynx view teardown hooks. |
| P0 | tracing | moved | `packages/devtools-frontend-lynx/front_end/core/sdk/TracingManager.ts` | `front_end/services/tracing/TracingManager.ts` | exists | Tracing moved out of core/sdk in upstream chromium/7724. |
| P0 | screencast | rebase | `packages/devtools-frontend-lynx/front_end/panels/screencast/ScreencastView.ts` | `front_end/panels/screencast/ScreencastView.ts` | exists | Reapply UI tree plugin bridge and LynxView/fullscreen mode. |
| P1 | settings | rebase | `packages/devtools-frontend-lynx/front_end/core/sdk/sdk-meta.ts` | `front_end/core/sdk/sdk-meta.ts` | exists | Keep screencastFPS and showLynxSharedContextSources or redesign if upstream has better knobs. |
| P1 | entrypoint | rebase | `packages/devtools-frontend-lynx/front_end/entrypoints/main/MainImpl.ts` | `front_end/entrypoints/main/MainImpl.ts` | exists | Keep only essential loading progress instrumentation in the first pass. |
| P1 | custom_panel | custom_only | `packages/devtools-frontend-lynx/front_end/panels/preact_devtools/preact_devtools-meta.ts` | `n/a` | custom_only | No upstream equivalent found in chromium/7724; keep as a custom panel. |
| P1 | custom_panel | custom_only | `packages/devtools-frontend-lynx/front_end/panels/preact_devtools/PreactDevtoolsPanel.ts` | `n/a` | custom_only | No upstream equivalent found in chromium/7724; keep as a custom panel. |
| P1 | plugin_bridge | product_layer | `plugins/devtool/renderer/devtool/index.tsx` | `n/a` | product_layer | Product-side iframe bridge; adapt after transport is stable. |
| P1 | packaging | product_layer | `scripts/build-lynx-devtools.js` | `n/a` | product_layer | Local packaging glue; likely needs rewrite against new upstream output. |
| P1 | packaging | product_layer | `packages/lynx-devtool-cli/src/cli/command/httpServer.ts` | `n/a` | product_layer | Keep static serving route but verify new artifact layout. |

## Notes

- Files marked `derived` should be regenerated, not manually ported.
- Files marked `custom_only` have no direct upstream equivalent in this checkout.
- Files marked `moved` changed location and should be ported onto the new path.
