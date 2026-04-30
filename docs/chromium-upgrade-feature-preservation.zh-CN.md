# Lynx DevTool 升级特性保全矩阵

更新时间：2026-04-29

配套文档：

- [chromium-upgrade-overview.zh-CN.md](./chromium-upgrade-overview.zh-CN.md)（**综述入口，含背景介绍，建议先读**）
- [chromium-upgrade-analysis.md](./chromium-upgrade-analysis.md)
- [chromium-upgrade-plan.zh-CN.md](./chromium-upgrade-plan.zh-CN.md)
- [chromium-upgrade-execution-status.zh-CN.md](./chromium-upgrade-execution-status.zh-CN.md)

这份矩阵用于避免升级过程中“能跑起来，但老能力悄悄丢了”。

## 1. 已进入升级实现的能力

| 能力 | 当前状态 | 升级落点 | 验证方式 |
| --- | --- | --- | --- |
| `Lynx.setTraceMode` 协议源文件 | 已补回 source-of-truth | `js_protocol.pdl` / `browser_protocol.json` | `tools/chromium-upgrade/check-protocol-consistency.sh` |
| `lynx_open` 会话打开 | 已进入 `chromium/7724` overlay | `front_end/core/sdk/Connections.ts` | 真实会话 smoke test |
| `lynx_message` CDP 转发 | 已进入 `chromium/7724` overlay | `front_end/core/sdk/Connections.ts` | Console / Elements / Sources 基本链路 |
| `send_message` 前端回传 | 已进入 `chromium/7724` overlay | `front_end/core/sdk/Connections.ts` | 断点、命令收发 |
| `devtool_stats` recording 开关 | 已进入 `chromium/7724` overlay | `front_end/core/sdk/Connections.ts` | 统计链路 smoke test |
| `a11y_mark_lynx` console log 转发 | 已进入 `chromium/7724` overlay | `front_end/core/sdk/Connections.ts` | a11y/overlay 场景 |
| `reattachMainTarget` | 已进入 `chromium/7724` overlay | `InspectorFrontendHostAPI.ts` / `Connections.ts` / `devtools_compatibility.js` | 重连场景 |
| `sendWindowMessage` | 已进入 `chromium/7724` overlay | `front_end/core/host/InspectorFrontendHost.ts` | iframe 到宿主消息转发 |
| `reportToStatistics` / `reportMetricToStatistics` | 已进入 `chromium/7724` overlay | `front_end/core/host/InspectorFrontendHost.ts` | 统计上报链路 |
| `postPluginMessage` / `addPluginEventListener` helper | 已进入 `chromium/7724` overlay | `front_end/core/protocol_client/InspectorBackend.ts` | 插件桥 helper 可用性 |
| `envLogger` helper | 已进入 `chromium/7724` overlay | `front_end/core/protocol_client/InspectorBackend.ts` | 环境日志链路 |
| `Lynx` domain frontend command 注册 | 已进入 repeatable patch 且构建通过 | `generated/InspectorBackendCommands.ts` / `InspectorBackend.ts` | Elements / Tracing 调用链 smoke test |
| `Debugger.removeScriptsForLynxView` | 已进入 repeatable patch 且构建通过 | `DebuggerModel.ts` / `RuntimeModel.ts` / `ResourceScriptMapping.ts` | 切卡/销毁 view 场景 |
| `showLynxSharedContextSources` | 已进入 repeatable patch 且构建通过 | `sdk-meta.ts` / `DebuggerModel.ts` | Sources 共享上下文脚本显示 |
| `OverlayModel` plugin listener 消费方 | 已进入 repeatable patch 且构建通过 | `OverlayModel.ts` | UI tree / Preact 选中联动 |
| `ScreencastView` UI tree / Preact message bridge | 已进入 repeatable patch 且构建通过 | `ScreencastView.ts` | Screencast inspect 场景 |
| `screencast-fps` / `pageScreencastMode` / HD 质量切换 | 已进入 repeatable patch 且构建通过 | `ScreenCaptureModel.ts` / `ScreencastView.ts` / `sdk-meta.ts` | Screencast 交互链路 |
| `TracingManager` Lynx trace mode/trace convert | 已进入 repeatable patch 且构建通过 | `services/tracing/TracingManager.ts` | Performance trace start/stop + proto stream conversion |
| `static/trace/*` runtime assets | 已进入 overlay 应用脚本且构建后保留 | `front_end/trace/` / `out/Default/gen/front_end/trace/` | wasm trace conversion worker 可加载 |
| `Preact Devtools` 自定义面板 | 已进入 overlay/patch 且构建通过 | `panels/preact_devtools/*` / `entrypoint_template.html` / `devtools_app/BUILD.gn` | 面板 bundle 产出，React/static runtime 可加载 |
| `MainImpl` loading progress 埋点 | 已进入 repeatable patch 且构建通过 | `entrypoints/main/MainImpl.ts` | `update_loading_progress` 与 `devtool_firstLoad` 四段统计 |
| CLI 打包与 `/localResource/devtool` 分发 | 已接入新 upstream 产物链路并验证 | `scripts/build-lynx-devtools.js` / `unzip-resources.js` / `httpServer.ts` | `lynx`/`web` 下 `inspector.html` 与 `devtools_app.html` 可解压分发 |
| Electron 22 runtime compatibility layer | 已进入 static/runtime patch 且真机连接后不再黑屏 | `front_end/devtools_compatibility.js` / `static/compare-versions.js` / `plugins/devtool/renderer/devtool/index.tsx` | 真机连接后 Elements 首屏可见，日志中不再出现 `Promise.withResolvers`、`Iterator is not defined`、`URL.canParse` 错误 |
| 打包产物 CSS nesting 转译 | 已接入两条打包链路且大面积样式错乱已消失 | `scripts/transpile-devtools-css.js` / `scripts/build-lynx-devtools.js` / `packages/devtools-frontend-lynx/scripts/build-lynx-devtools.sh` | 产物 CSS 中不再残留关键 nesting 规则，toolbar/input/button 布局恢复 |
| `Elements` 树展开箭头 `-webkit-mask-*` fallback | 已进入 overlay/runtime patch 且真机 `Elements` 面板可见展开箭头 | `patch-upstream-lynx-features.js` / `patch-devtools-runtime-compat.js` | 连接真机后打开 `Elements`，确认 DOM 树 disclosure arrow 可见 |

## 2. 后续跟踪项

截至 2026-04-29，本轮矩阵中列出的 P0/P1 保全项都已经进入可重复脚本或 overlay，并完成构建/打包验证。后续若发现真实设备 smoke test 中的新差异，应继续在本节追加新行，而不是覆盖上面的已完成记录。

## 3. 本轮新增的升级实现资产

- Overlay 源文件：
  - `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/host/InspectorFrontendHostAPI.ts`
  - `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/host/InspectorFrontendHost.ts`
  - `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/protocol_client/InspectorBackend.ts`
  - `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/sdk/Connections.ts`
- Overlay 应用脚本：
  - `tools/chromium-upgrade/apply-upstream-overlay.sh`
- `devtools_compatibility.js` patch 脚本：
  - `tools/chromium-upgrade/patch-devtools-compatibility.js`
- Lynx repeatable patch 脚本：
  - `tools/chromium-upgrade/patch-upstream-lynx-features.js`
- 新 upstream 产物打包/分发脚本：
  - `scripts/build-lynx-devtools.js`
  - `packages/lynx-devtool-cli/scripts/unzip-resources.js`
  - `packages/lynx-devtool-cli/src/cli/command/httpServer.ts`

## 4. 使用建议

建议每次继续升级时都按下面顺序执行：

1. 先阅读这份矩阵，确认这轮要覆盖哪些特性
2. 运行 `tools/chromium-upgrade/apply-upstream-overlay.sh`
3. 在上游 checkout 上跑构建
4. 按矩阵逐项补剩余特性
5. 每补完一类能力，就更新本文件状态
