# Local Custom Surface Report

- Generated at: 2026-04-11 21:12:10 +0800
- Repository root: `/Users/bytedance/workspace/codes/lynx-devtool`
- Pattern file: `/Users/bytedance/workspace/codes/lynx-devtool/tools/chromium-upgrade/custom-surface-patterns.tsv`

This report is a grep-based index of Lynx-specific protocol, transport,
bridge, panel, and packaging markers in the current repository.

## `removeScriptsForLynxView`

Debugger lifecycle cleanup for per-view script and source map teardown.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/v8/include/js_protocol.pdl:480:  event removeScriptsForLynxView
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/third_party/blink/public/devtools_protocol/browser_protocol.json:21661:                    "name": "removeScriptsForLynxView",
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/DebuggerModel.ts:550:  _removeScriptsForLynxView(viewId: number): void {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/DebuggerModel.ts:1180:  removeScriptsForLynxView({viewId}: Protocol.Debugger.RemoveScriptsForLynxViewEvent): void {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/DebuggerModel.ts:1184:    this._debuggerModel._removeScriptsForLynxView(viewId);
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/protocol-proxy-api.d.ts:3682:    removeScriptsForLynxView(params: Protocol.Debugger.RemoveScriptsForLynxViewEvent): void;
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/InspectorBackendCommands.js:2877:  inspectorBackend.registerEvent('Debugger.removeScriptsForLynxView', ['viewId']);
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/protocol-mapping.d.ts:604:    'Debugger.removeScriptsForLynxView': [Protocol.Debugger.RemoveScriptsForLynxViewEvent];
```

## `Lynx\.getComponentId`

Custom Lynx protocol method used by the frontend.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/protocol-mapping.d.ts:3062:    'Lynx.getComponentId':
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/InspectorBackendCommands.js:3358:      'Lynx.getComponentId', [{'name': 'nodeId', 'type': 'number', 'optional': false}], ['componentId']);
```

## `Lynx\.getProperties`

Custom Lynx protocol method used by the frontend.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/protocol-mapping.d.ts:3064:    'Lynx.getProperties':
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/InspectorBackendCommands.js:3360:      'Lynx.getProperties', [{'name': 'nodeId', 'type': 'number', 'optional': false}], ['properties']);
```

## `Lynx\.getData`

Custom Lynx protocol method used by the frontend.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/InspectorBackendCommands.js:3361:  inspectorBackend.registerCommand('Lynx.getData', [{'name': 'nodeId', 'type': 'number', 'optional': false}], ['data']);
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/protocol-mapping.d.ts:3066:    'Lynx.getData': {paramsType: [Protocol.Lynx.GetDataRequest]; returnType: Protocol.Lynx.GetDataResponse;};
```

## `Lynx\.setTraceMode`

Custom Lynx protocol method for trace mode switching.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/protocol-mapping.d.ts:3067:    'Lynx.setTraceMode': {paramsType: [Protocol.Lynx.SetTraceModeRequest]; returnType: void;}
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/generated/InspectorBackendCommands.js:3363:      'Lynx.setTraceMode', [{'name': 'enableTraceMode', 'type': 'boolean', 'optional': false}], []);
```

## `LynxConnection`

Custom transport implementation in the current fork.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:260:export class LynxConnection implements ProtocolClient.InspectorBackend.Connection {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:517:  return new LynxConnection(websocketConnectionLost);
```

## `postPluginMessage`

Custom plugin bridge from DevTools frontend into product-side extensions.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/protocol_client/InspectorBackend.ts:112:export const postPluginMessage = (name: string, msg: string | Record<string, any>) => {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/protocol_client/InspectorBackend.ts:114:  window.postPluginMessage?.(name)(`Extensions.${name}`, msg);
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/panels/screencast/ScreencastView.ts:43:import { postPluginMessage } from '../../core/protocol_client/InspectorBackend.js';
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/panels/screencast/ScreencastView.ts:355:    postPluginMessage("uitree-panel", { UINodeId: node.id });
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/panels/screencast/ScreencastView.ts:356:    postPluginMessage("uitree-drawer", { UINodeId: node.id });
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/panels/screencast/ScreencastView.ts:376:        postPluginMessage("uitree-drawer", { UINodeId: node.id });
```

## `addPluginEventListener`

Custom plugin event listener bridge from product-side events into DevTools frontend.

```text
/Users/bytedance/workspace/codes/lynx-devtool/src/renderer/utils/context.ts:129:  addPluginEventListener(eventName: string, listener: (event: PluginEvent) => void) {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/protocol_client/InspectorBackend.ts:116:export const addPluginEventListener = (name: string, listener: (msg: any) => void) => {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/protocol_client/InspectorBackend.ts:118:  window.addPluginEventListener?.(name)(`Extensions.${name}`, listener);
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/OverlayModel.ts:26:import {addPluginEventListener} from '../protocol_client/InspectorBackend.js';
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/OverlayModel.ts:144:    addPluginEventListener("uitree-panel", (msg: any) => {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/OverlayModel.ts:150:    addPluginEventListener("uitree-drawer", (msg: any) => {
```

## `dispatchMessageChunk`

Custom host event used for chunked backend message delivery.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/devtools_compatibility.js:155:    dispatchMessageChunk(messageChunk, messageSize) {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/devtools_compatibility.js:156:      this._dispatchOnInspectorFrontendAPI('dispatchMessageChunk', [messageChunk, messageSize]);
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:33:          Host.InspectorFrontendHostAPI.Events.DispatchMessageChunk, this._dispatchMessageChunk, this),
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:57:  _dispatchMessageChunk(event: Common.EventTarget.EventTargetEvent): void {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHostAPI.ts:19:  DispatchMessageChunk = 'dispatchMessageChunk',
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHostAPI.ts:52:  [Events.DispatchMessageChunk, 'dispatchMessageChunk', ['messageChunk', 'messageSize']],
```

## `reattachMainTarget`

Custom host event used to rebuild the main target.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/devtools_compatibility.js:253:    reattachMainTarget() {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/devtools_compatibility.js:254:      this._dispatchOnInspectorFrontendAPI('reattachMainTarget', []);
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHostAPI.ts:30:  ReattachMainTarget = 'reattachMainTarget',
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHostAPI.ts:63:  [Events.ReattachMainTarget, 'reattachMainTarget', []],
```

## `showLynxSharedContextSources`

Custom debugger/source visibility setting.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/sdk-meta.ts:1023:  settingName: 'showLynxSharedContextSources',
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/DebuggerModel.ts:210:    this._showSharedContextSources = Common.Settings.Settings.instance().moduleSetting('showLynxSharedContextSources').get();
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/DebuggerModel.ts:211:    Common.Settings.Settings.instance().moduleSetting<string>('showLynxSharedContextSources').addChangeListener(event => {
```

## `screencastFPS`

Custom screencast setting.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/sdk-meta.ts:320:  screencastFPS: 'Screencast FPS',
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/sdk-meta.ts:992:  title: i18nLazyString(UIStrings.screencastFPS),
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/sdk-meta.ts:993:  settingName: 'screencastFPS',
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/ScreenCaptureModel.ts:110:    const FPS = parseInt(Common.Settings.Settings.instance().moduleSetting<string>('screencastFPS').get());
```

## `lynx_open`

Product-to-frontend bootstrap message for a Lynx session.

```text
/Users/bytedance/workspace/codes/lynx-devtool/plugins/devtool/renderer/devtool/types/devtool.ts:52:  lynxOpen = 'lynx_open',
/Users/bytedance/workspace/codes/lynx-devtool/plugins/devtool/renderer/devtool/index.tsx:62:    sendGenericMessageToIframe('lynx_open', data);
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:281:        case 'lynx_open':
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:288:              type: 'lynx_open',
```

## `lynx_message`

Product-to-frontend message envelope carrying CDP and plugin traffic.

```text
/Users/bytedance/workspace/codes/lynx-devtool/plugins/devtool/renderer/devtool/index.tsx:48:    sendGenericMessageToIframe('lynx_message', {
/Users/bytedance/workspace/codes/lynx-devtool/plugins/devtool/renderer/devtool/index.tsx:68:        sendGenericMessageToIframe('lynx_message', {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:269:    window.document.addEventListener('lynx_message', messageEvent => {
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:294:        case 'lynx_message':
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/static/plugin/pluginLoader.js:72:    case "lynx_message":
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/panels/preact_devtools/PreactDevtoolsPanel.ts:97:        case "lynx_message":
```

## `send_message`

Frontend-to-product outbound message envelope.

```text
/Users/bytedance/workspace/codes/lynx-devtool/plugins/devtool/renderer/index.tsx:212:      devtoolActionHandler.registerHandler('send_message', devtoolWSMsgMonitor);
/Users/bytedance/workspace/codes/lynx-devtool/plugins/devtool/renderer/index.tsx:219:        devtoolActionHandler.removeHandler('send_message', devtoolWSMsgMonitor);
/Users/bytedance/workspace/codes/lynx-devtool/plugins/devtool/renderer/devtool/index.tsx:120:        case 'send_message':
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/static/plugin/pluginLoader.js:139:      { type: "send_message", content: { type: domains[2], message } },
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/panels/preact_devtools/PreactDevtoolsPanel.ts:49:      { type: "send_message", content: { type: domains[2], message } },
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:418:        type: 'send_message',
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:470:        type: 'send_message',
```

## `devtool_stats`

Product statistics bridge.

```text
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:300:              type: 'devtool_stats',
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:351:        case 'devtool_stats':
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:356:              type: 'devtool_stats',
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/protocol_client/InspectorBackend.ts:446:        type: 'devtool_stats',
```

## `a11y_mark_lynx`

Accessibility or overlay side channel for Lynx-specific actions.

```text
/Users/bytedance/workspace/codes/lynx-devtool/plugins/devtool/renderer/devtool/index.tsx:147:      if (type === 'a11y_mark_lynx') {
/Users/bytedance/workspace/codes/lynx-devtool/plugins/devtool/renderer/devtool/index.tsx:148:        sendGenericMessageToIframe('a11y_mark_lynx', content);
/Users/bytedance/workspace/codes/lynx-devtool/src/renderer/hooks/connection.ts:491:          type: 'a11y_mark_lynx',
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/panels/screencast/ScreencastView.ts:786:      type: 'a11y_mark_lynx',
/Users/bytedance/workspace/codes/lynx-devtool/packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts:364:        case 'a11y_mark_lynx':
```

