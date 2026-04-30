# Lynx DevTool Chromium 升级执行状态

更新时间：2026-04-28

配套文档：

- [chromium-upgrade-overview.zh-CN.md](./chromium-upgrade-overview.zh-CN.md)（**综述入口，含背景介绍，建议先读**）
- [chromium-upgrade-analysis.md](./chromium-upgrade-analysis.md)
- [chromium-upgrade-plan.zh-CN.md](./chromium-upgrade-plan.zh-CN.md)
- [chromium-upgrade-feature-preservation.zh-CN.md](./chromium-upgrade-feature-preservation.zh-CN.md)

## 1. 本轮已经执行完成的动作

### 1.1 拉取并准备上游基线

已在 `lynx-devtool` 同级目录准备好新的上游 checkout：

- 上游目录：`/Users/bytedance/workspace/codes/devtools-frontend-upstream-7724`
- `depot_tools` 目录：`/Users/bytedance/workspace/codes/depot_tools`
- 上游分支：`chromium/7724`
- 上游 commit：`a429d5a8b2e78b92dc99ef220ca67c402cbe1a67`

本轮实际执行过的关键命令：

1. `git clone --branch chromium/7724 --depth=1 https://chromium.googlesource.com/devtools/devtools-frontend.git /Users/bytedance/workspace/codes/devtools-frontend-upstream-7724`
2. `git clone --depth=1 https://chromium.googlesource.com/chromium/tools/depot_tools.git /Users/bytedance/workspace/codes/depot_tools`
3. `DEPOT_TOOLS_UPDATE=0 PATH=/Users/bytedance/workspace/codes/depot_tools:$PATH gclient config --spec='solutions = [{"name": ".", "url": None, "deps_file": "DEPS", "managed": False, "custom_deps": {},}]'`
4. `DEPOT_TOOLS_UPDATE=0 PATH=/Users/bytedance/workspace/codes/depot_tools:$PATH gclient sync -D --jobs=16`
5. `DEPOT_TOOLS_UPDATE=0 PATH=/Users/bytedance/workspace/codes/depot_tools:$PATH npm run build -- --target=Default`

### 1.2 已验证的结果

上游基线已独立构建成功：

- 构建输出：`✔ Build ready (174.42s)`
- 产物目录：`/Users/bytedance/workspace/codes/devtools-frontend-upstream-7724/out/Default/gen/front_end`
- 已确认产物：
  - `inspector.html`
  - `devtools_app.html`
  - `devtools_compatibility.js`
  - `services/`
  - `generated/`

这说明当前建议目标分支 `chromium/7724` 至少已经具备：

- 可独立 checkout
- 可独立同步依赖
- 可独立构建
- 可作为 Lynx 定制迁移的干净上游底座

### 1.3 本轮已落地并验证的 `chromium/7724` overlay

本轮已经新增并验证的 overlay 资产：

- `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/host/InspectorFrontendHostAPI.ts`
- `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/host/InspectorFrontendHost.ts`
- `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/protocol_client/InspectorBackend.ts`
- `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/sdk/Connections.ts`
- `tools/chromium-upgrade/apply-upstream-overlay.sh`
- `tools/chromium-upgrade/patch-devtools-compatibility.js`
- `tools/chromium-upgrade/patch-upstream-lynx-features.js`

已实际应用到上游 checkout：

- 目标目录：`/Users/bytedance/workspace/codes/devtools-frontend-upstream-7724`

已实际验证结果：

1. 应用连接层 + 宿主桥 overlay 后，上游重新构建成功
2. 补入 `InspectorBackend.ts` 中的插件桥 helper 后，上游再次重新构建成功
3. 补入 `services/tracing/TracingManager.ts` 的 Lynx trace mode / proto stream 转换后，上游再次重新构建成功
4. 补入 trace runtime asset 复制后，上游再次重新构建成功，且 `out/Default/gen/front_end/trace/` 中保留 `worker.js`、`trace_to_text.js`、`trace_to_text.wasm`
5. 补入 Preact Devtools 自定义面板、React/static runtime 入口和 `devtools_app` meta 注册后，上游重新构建成功
6. 补入 `MainImpl` loading progress 与 `devtool_firstLoad` 四段耗时统计后，上游重新构建成功

最近一次验证命令：

- `tools/chromium-upgrade/apply-upstream-overlay.sh /Users/bytedance/workspace/codes/devtools-frontend-upstream-7724`
- `node tools/chromium-upgrade/patch-upstream-lynx-features.js /Users/bytedance/workspace/codes/devtools-frontend-upstream-7724`
- `DEPOT_TOOLS_UPDATE=0 PATH=/Users/bytedance/workspace/codes/depot_tools:$PATH npm run build -- --target=Default`

最近一次构建结果：

- `✔ Build ready (9.66s)`

### 1.4 本轮新增并已通过构建的 repeatable patch 能力

本轮不再只靠“整文件 overlay”，而是新增了可重复重放的 Lynx patch 脚本：

- `tools/chromium-upgrade/patch-upstream-lynx-features.js`

这批 patch 已在 `chromium/7724` 实际应用并重新构建通过，当前已覆盖：

- `generated/InspectorBackendCommands.ts`
  - 补入 `Debugger.removeScriptsForLynxView`
  - 补入 `Lynx.getComponentId`
  - 补入 `Lynx.getProperties`
  - 补入 `Lynx.getData`
  - 补入 `Lynx.setTraceMode`
- `core/protocol_client/InspectorBackend.ts`
  - 补入 `LynxAgentApi`
  - 补入 `lynxAgent()` frontend agent 出口
- `core/sdk/RuntimeModel.ts`
  - 补入 `LynxViewDestroyed` runtime event
- `core/sdk/DebuggerModel.ts`
  - 补入 `scriptsForLynxView()`
  - 补入 `removeScriptsForLynxView()`
  - 补入 `show-lynx-shared-context-sources` 过滤逻辑
- `models/bindings/ResourceScriptMapping.ts`
  - 补入 `LynxViewDestroyed` 对应的 script 清理
- `core/sdk/sdk-meta.ts`
  - 补入 `screencast-fps`
  - 补入 `show-lynx-shared-context-sources`
- `core/sdk/ScreenCaptureModel.ts`
  - 补入 `pageScreencastMode`
  - 补入 cached frame 恢复
  - 补入按 `screencast-fps` 延迟 ack
- `core/sdk/OverlayModel.ts`
  - 补入 plugin event listener
  - 补入 Preact 面板选中消息消费
- `panels/screencast/ScreencastView.ts`
  - 补入 UI tree / drawer / Preact message 联动
  - 补入 HD 质量切换
  - 补入 fullscreen / lynxview 模式切换
  - 补入 reload 时 `a11y_mark_lynx`
- `services/tracing/TracingManager.ts`
  - 补入 `Lynx.setTraceMode` 启停
  - 补入 `ReturnAsStream` + `Proto` trace 读取
  - 补入 `IO.read` stream 聚合
  - 补入 `static/trace/worker.js` wasm trace 转换链路
  - 补入 trace 传输/转换统计
  - 补入 tracing 完成后恢复 screencast setting 并 reload page
- `apply-upstream-overlay.sh`
  - 补入 `static/trace/*` runtime asset 复制
  - 对已有 `out/Default/gen/front_end` 同步补入 `trace/` 目录，便于构建后 smoke
  - 补入顶层 static runtime 复制：`apexcharts.js`、`base64js.min.js`、`inflate.min.js`、`compare-versions.js`
  - 补入 `panels/preact_devtools/` 自定义面板复制
- `panels/preact_devtools/*`
  - 已通过 overlay 复制到 `chromium/7724`
  - 已转换为 7724 可构建的 `devtools_ui_module`
  - 已移除旧 `Root.Runtime.loadModulePromise()` 依赖
  - 已通过 `entrypoint_template.html` 注入 React/ReactDOM 与本地 static runtime
- `entrypoints/main/MainImpl.ts`
  - 补入 `start_progress`、`loadEnv`、`create_appUI`、`show_appUI`、`initialize_target`
  - 补入 `devtool_firstLoad` 中 `loadEnv`、`createAppUI`、`showAppUI`、`initializeTarget` 耗时统计

### 1.5 新 upstream 产物打包与 CLI 分发验证

已把现有打包链路扩展到可消费外部 `chromium/7724` checkout：

- `scripts/build-lynx-devtools.js`
  - 支持 `--frontend-dir` / `--upstream-dir` 指向外部 DevTools checkout
  - 支持 `--skip-build` 直接打包已构建的 `out/Default/gen/front_end`
  - 打包根目录同时生成 `inspector.html` 与 `devtools_app.html`
  - 保持 tarball 输出在 `packages/devtools-frontend-lynx/output`
- `scripts/sync-devtools-output.js`
  - 继续复用既有同步逻辑，把最新 `devtool.frontend.lynx_*.tar.gz` 放入 CLI resources
- `packages/lynx-devtool-cli/scripts/unzip-resources.js`
  - 同一份 DevTools tarball 同时解压到 `dist/static/devtool/lynx` 和 `dist/static/devtool/web`
- `packages/lynx-devtool-cli/src/cli/command/httpServer.ts`
  - `/localResource/devtool` 继续服务 CLI 静态目录，并增加 source/build 目录 fallback

已实际验证：

1. `node scripts/build-lynx-devtools.js --frontend-dir /Users/bytedance/workspace/codes/devtools-frontend-upstream-7724 --skip-build`
2. `node scripts/sync-devtools-output.js`
3. `pnpm --filter @lynx-js/devtool-plugin-core run build`
4. `pnpm --filter @lynx-js/lynx-devtool-utils run build`
5. `pnpm --filter @lynx-js/lynx-devtool-cli run build`

验证结果：

- 生成并同步 `devtool.frontend.lynx_1.0.1776741503.tar.gz`
- tarball 根目录包含 `inspector.html` 和 `devtools_app.html`
- CLI 解压后，以下入口均存在：
  - `dist/static/devtool/lynx/inspector.html`
  - `dist/static/devtool/lynx/devtools_app.html`
  - `dist/static/devtool/web/inspector.html`
  - `dist/static/devtool/web/devtools_app.html`
- 解压后的 `lynx` 与 `web` 产物中均包含：
  - `front_end_1776741503/trace/worker.js`
  - `front_end_1776741503/panels/preact_devtools/preact_devtools.js`
  - `front_end_1776741503/base64js.min.js`

### 1.6 已确认解决的运行时兼容问题

说明：

- 本节只记录“现象、根因、修复和验证都已经坐实”的问题。
- 仍在继续排查的事项，例如部分 legacy sprite 图标/按钮细节和非 `Elements` 面板的协议能力缺口，不写进本节，避免误记为已完成。

#### 问题 A：真机连接后主区域黑屏

- 问题现象：
  - 打开 `LynxDevTool.app` 并连接真机后，顶部设备和页面选择器可切换，但主内容区域为黑屏。
  - 切换手机调试页面时黑屏区域会闪动，说明宿主已经感知到页面切换，但前端 UI 没有完成正常启动。
- 根因：
  - 升级后的 `chromium/7724` 前端默认假设运行环境接近新版本 Chromium。
  - 当前宿主 Electron 22 对应 Chromium 108，缺失多组运行时能力，导致前端启动阶段直接抛错并中断渲染。
  - 已坐实的缺口包括：
    - `Promise.withResolvers`
    - `URL.canParse`
    - `Array.prototype.toSorted`
    - `Map.groupBy` / `Object.groupBy`
    - iterator helpers 以及全局 `Iterator`
- 解决办法：
  - 在 `front_end/devtools_compatibility.js` 中补齐 Electron 22 运行所需的兼容层。
  - 在 `static/compare-versions.js` 中补齐 iterator helpers，并显式定义全局 `Iterator`，避免首屏运行时异常。
  - 在宿主 renderer 入口继续显式加载这层 compatibility runtime，确保打包后的 app 与 dev 模式行为一致。
- 测试方法：
  1. 启动本地 dev app 或重建后的 `LynxDevTool.app`
  2. 连接真机并选择任意 Lynx 页面
  3. 确认主区域不再黑屏，`Elements` 面板能够正常展示 DOM 树
  4. 检查运行日志，确认不再出现以下错误：
     - `Promise.withResolvers is not a function`
     - `Iterator is not defined`
     - `URL.canParse is not a function`

#### 问题 B：`:popover-open` 选择器和 Popover API 不兼容，导致 UI 逻辑异常

- 问题现象：
  - 升级后部分菜单、弹层和相关样式逻辑在 Electron 22 下异常。
  - 运行时日志会出现 `:popover-open is not a valid selector`，并进一步干扰面板初始化。
- 根因：
  - 上游前端已经开始依赖 Popover API 和 `:popover-open` 选择器。
  - Electron 22 对应的 Chromium 108 既不完整支持这组 API，也不能正确解析该伪类选择器。
- 解决办法：
  - 在 compatibility 层中补入轻量的 popover 状态兼容逻辑。
  - 使用 `data-ldt-popover-open` 维护打开态，并在 selector 匹配路径上把 `:popover-open` 兜底为兼容实现。
- 测试方法：
  1. 启动 app 并连接真机页面
  2. 打开包含弹层、菜单或相关交互的面板路径
  3. 确认运行日志中不再出现 `:popover-open is not a valid selector`
  4. 确认对应 UI 不再因为该异常中断初始化

#### 问题 C：打包后的 CSS nesting 未转译，导致大面积样式错乱

- 问题现象：
  - 升级后的 app 虽然不再黑屏，但 toolbar、输入框、checkbox、icon button 等基础 UI 出现大面积样式错乱。
  - 典型表现包括：按钮只有轮廓、布局错位、图标旁边的文字间距异常、局部 hover/focus 样式失效。
- 根因：
  - `chromium/7724` 产物中的一部分 CSS 仍保留了 nesting 语法，例如：
    - `& > devtools-checkbox`
    - `&.focused`
    - `+ devtools-icon`
  - Electron 22 对应的 Chromium 108 不支持这类 nesting 语法，浏览器会直接丢弃整条规则，导致大量基础样式失效。
- 解决办法：
  - 新增 `scripts/transpile-devtools-css.js`，对打包产物中的 `.css` 和 `.css.js` 统一执行 PostCSS nesting 转译。
  - 将该步骤接入两条可重复链路：
    - `scripts/build-lynx-devtools.js`
    - `packages/devtools-frontend-lynx/scripts/build-lynx-devtools.sh`
- 测试方法：
  1. 重新执行前端打包
  2. 确认日志中出现类似 `Transpiled CSS nesting in ... files` 的输出
  3. 抽查生成产物，确认关键 CSS 不再保留 `& >`、`&.`、`+ devtools-icon` 等未转译 nesting 规则
  4. 启动 app 后确认 toolbar、input、button 的整体布局恢复，不再出现首轮那种大面积样式塌陷

#### 问题 D：`Elements` 面板树展开箭头缺失

- 问题现象：
  - 大部分图标和按钮恢复后，`Elements` 面板里的 DOM 树展开箭头仍然不显示。
  - 具体表现为节点仍可展开/收起，但左侧 disclosure arrow 不可见，影响结构浏览。
- 根因：
  - `chromium/7724` 上游在树组件相关样式里使用了标准 `mask-*` 属性：
    - `front_end/panels/elements/elementsTreeOutline.css`
    - `front_end/ui/legacy/treeoutline.css`
    - `front_end/ui/components/tree_outline/treeOutline.css`
  - 当前宿主 Electron 22 对应 Chromium 108，在这几处箭头样式上实际仍依赖 `-webkit-mask-*` 前缀；只有标准 `mask-*` 时，箭头资源不会被正确绘制。
- 解决办法：
  - 在 `tools/chromium-upgrade/patch-upstream-lynx-features.js` 中补入 repeatable patch，为上述 3 个 source file 的箭头样式追加：
    - `-webkit-mask-image`
    - `-webkit-mask-position`
    - `-webkit-mask-size`
  - 在 `scripts/patch-devtools-runtime-compat.js` 中加入同类 runtime patch，确保打包产物也会自动补齐这些前缀。
- 测试方法：
  1. 运行 `tools/chromium-upgrade/apply-upstream-overlay.sh` 到 `chromium/7724` checkout
  2. 重新构建 upstream frontend，并执行 `node scripts/build-lynx-devtools.js --frontend-dir <upstream-dir> --skip-build`
  3. 同步资源后启动 dev app，连接真机并打开 `Elements` 面板
  4. 确认 DOM 树左侧展开箭头可见，截图中能看到节点 disclosure arrow
  5. 抽查最终产物，确认以下文件已包含 `-webkit-mask-*` fallback：
     - `panels/elements/elementsTreeOutline.css.js`
     - `ui/legacy/treeoutline.css.js`
     - `ui/components/tree_outline/treeOutline.css.js`

## 2. 本轮确认的关键上游变化

这些变化会直接影响迁移方式，因此在执行阶段已经优先确认。

### 2.1 连接层已经不是旧的 `Connection` 模型

上游 `chromium/7724` 中：

- `front_end/core/sdk/Connections.ts` 现在通过 `ConnectionTransport.setFactory(...)` 注册传输工厂
- `front_end/core/protocol_client/InspectorBackend.ts` 已切到 `ConnectionTransport` + `DevToolsCDPConnection` + `SessionRouter`
- 旧仓库里的 `LynxConnection implements ProtocolClient.InspectorBackend.Connection` 不能直接照搬

迁移含义：

- 应该把 Lynx 通道实现成新的 transport adapter
- 再让上游 `CDPConnection` / `SessionRouter` 接管 session 路由
- 不建议继续把大量产品逻辑塞在旧连接类里

### 2.2 Tracing 已经迁移到 `services/tracing`

本地旧路径：

- `packages/devtools-frontend-lynx/front_end/core/sdk/TracingManager.ts`

上游新路径：

- `front_end/services/tracing/TracingManager.ts`

迁移含义：

- `Lynx.setTraceMode`
- trace 数据读取/转换
- screencast 与 trace 的联动

这些逻辑不能继续按旧路径 patch，需要改挂到新的 tracing service 上。

当前状态：

- 已完成第一版 `services/tracing/TracingManager.ts` repeatable patch
- 已在 `chromium/7724` 上游 checkout 应用并构建通过
- `apply-upstream-overlay.sh` 已同步复制 `static/trace/*` 到上游 `front_end/trace/` 和已有的 `out/Default/gen/front_end/trace/`
- P0-4 打包阶段已把 trace runtime asset 正式纳入新 upstream tarball 输出，CLI 解压后 `lynx` / `web` 两套资源下均可找到 `front_end_*/trace/worker.js`

### 2.3 AI 相关代码入口确实已经存在于上游 checkout

本轮在上游代码里已直接确认到这些入口：

- AI assistance / Gemini 按钮与面板
  - `front_end/entrypoints/main/GlobalAiButton.ts`
  - `front_end/panels/ai_assistance/*`
- Console Insights
  - `front_end/panels/console/ConsoleViewMessage.ts`
  - `front_end/panels/explain/*`
- AI 设置页
  - `front_end/panels/settings/AISettingsTab.ts`
  - 测试里已出现 `Console Insights`、`AI assistance`、`Auto annotations`、`Code suggestions`
- DevTools MCP 相关代码
  - `mcp/*`
  - `front_end/entrypoints/main/MainImpl.ts` 中的 `chrome-devtools-mcp` 菜单入口

迁移含义：

- 升级后的代码基线会天然携带这些 AI 代码路径
- 但在 Lynx 产品里是否真正可用，还取决于 embedder、登录态、host config、地区限制、开关策略和产品侧接入方式

### 2.4 协议 source 与 generated 不一致问题已被定位并完成首个修复

在 2026-04-11 本轮执行中，初次检查时确认到：

- `removeScriptsForLynxView`、`getComponentId`、`getProperties`、`getData`
  同时存在于：
  - `v8/include/js_protocol.pdl`
  - `third_party/blink/public/devtools_protocol/browser_protocol.json`
  - `front_end/generated/*`
- `Lynx.setTraceMode`
  当时只存在于：
  - `front_end/generated/InspectorBackendCommands.js`
  - `front_end/generated/protocol-proxy-api.d.ts`
  - `front_end/generated/protocol-mapping.d.ts`
  - `front_end/core/sdk/TracingManager.ts`
  但不在协议源文件里

本轮已经完成的修复：

- 已把 `Lynx.setTraceMode(enableTraceMode: boolean)` 补回：
  - `packages/devtools-frontend-lynx/v8/include/js_protocol.pdl`
  - `packages/devtools-frontend-lynx/third_party/blink/public/devtools_protocol/browser_protocol.json`
- 已新增检查脚本：
  - `tools/chromium-upgrade/check-protocol-consistency.sh`
- 已重新生成一致性报告：
  - `tools/chromium-upgrade/reports/local-protocol-consistency.md`

当前状态：

- `js_protocol.pdl`
- `browser_protocol.json`
- `front_end/generated/InspectorBackendCommands.js`

三者中的 Lynx commands 已重新对齐，当前报告中不再有差异项。

### 2.5 已完成首批“可编译 overlay”的能力范围

截至本轮结束，已经进入 `chromium/7724` overlay 并通过上游构建验证的能力包括：

- Lynx hosted-mode 连接建立
- `lynx_open`
- `lynx_message`
- `send_message`
- `devtool_stats` recording 开关
- `a11y_mark_lynx`
- `reattachMainTarget`
- `sendWindowMessage`
- `reportToStatistics`
- `reportMetricToStatistics`
- `postPluginMessage`
- `addPluginEventListener`
- `envLogger`
- Lynx tracing start/stop
- Lynx proto trace stream 读取与 wasm 转换

注意：

- 这里的“已完成”指 overlay 层已经实现且能编译
- 这里的“打包验证”指新 upstream 产物已经能进入 CLI 静态资源目录
- 真实设备连接、面板交互、统计上报的产品级 smoke test 仍建议作为后续验收继续执行

## 3. 已沉淀的迁移资产

### 3.1 文档

- `docs/chromium-upgrade-analysis.md`
- `docs/chromium-upgrade-plan.zh-CN.md`
- `docs/chromium-upgrade-execution-status.zh-CN.md`

### 3.2 工具

- `tools/chromium-upgrade/migration-map.tsv`
- `tools/chromium-upgrade/generate-migration-report.sh`
- `tools/chromium-upgrade/custom-surface-patterns.tsv`
- `tools/chromium-upgrade/generate-custom-surface-report.sh`
- `tools/chromium-upgrade/check-protocol-consistency.sh`
- `tools/chromium-upgrade/patch-devtools-compatibility.js`
- `tools/chromium-upgrade/patch-upstream-lynx-features.js`
- `tools/chromium-upgrade/apply-upstream-overlay.sh`

### 3.3 已生成报告

- `tools/chromium-upgrade/reports/devtools-frontend-upstream-7724.md`
- `tools/chromium-upgrade/reports/local-custom-surface.md`
- `tools/chromium-upgrade/reports/local-protocol-consistency.md`

### 3.4 已落地 overlay 源文件

- `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/host/InspectorFrontendHostAPI.ts`
- `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/host/InspectorFrontendHost.ts`
- `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/protocol_client/InspectorBackend.ts`
- `tools/chromium-upgrade/upstream-overlays/chromium-7724/front_end/core/sdk/Connections.ts`

## 4. 下一步 P0 迁移包

建议严格按下面顺序推进，避免同时改太多层导致无法定位问题。

### P0-1 协议 source of truth

目标：

- 补齐 Lynx 扩展协议的真正源头
- 重新生成 `front_end/generated/*`

重点文件：

- `packages/devtools-frontend-lynx/v8/include/js_protocol.pdl`
- `packages/devtools-frontend-lynx/third_party/blink/public/devtools_protocol/browser_protocol.json`

风险提示：

- `Lynx.setTraceMode` 当前在 generated 文件中存在，但协议源文件链路并不完全清晰
- 这一步不补齐，后面所有类型和调用迁移都会持续不稳定

### P0-2 传输层与宿主桥

目标：

- 用新的 `ConnectionTransport` / `CDPConnection` 体系承接 Lynx transport

重点文件：

- 上游 `front_end/core/sdk/Connections.ts`
- 上游 `front_end/core/protocol_client/InspectorBackend.ts`
- 上游 `front_end/core/host/InspectorFrontendHost.ts`
- 上游 `front_end/core/host/InspectorFrontendHostAPI.ts`
- 上游 `front_end/devtools_compatibility.js`
- 产品侧 `plugins/devtool/renderer/devtool/index.tsx`

先迁移的消息契约：

- `lynx_open`
- `lynx_message`
- `send_message`
- `dispatchMessageChunk`
- `reattachMainTarget`

当前状态：

- 已完成第一版 overlay 并通过上游编译
- 下一步从“编译通过”推进到“真实会话可用”

### P0-3 调试核心能力

目标：

- 保住会话建立后的主调试闭环

重点文件：

- `DebuggerModel.ts`
- `TracingManager.ts` 新路径
- `ScreencastView.ts`

先验收能力：

- 元素树/源码树能加载
- 断点能命中
- `removeScriptsForLynxView` 能清理脚本和 source map
- trace 可开启/停止/读取
- screencast 仍可工作

当前建议优先级：

1. `DebuggerModel.ts`：已完成第一版 repeatable patch 并构建通过
2. `services/tracing/TracingManager.ts`：已完成第一版 repeatable patch 并构建通过
3. `panels/screencast/ScreencastView.ts`：已完成第一版 repeatable patch 并构建通过
4. `Preact Devtools`、`MainImpl` loading progress、P0-4 打包分发链路：已完成第一版迁移并构建/打包验证通过

### P0-4 打包与分发

目标：

- 让新的 frontend 产物能被 CLI / Electron 正确加载

重点文件：

- `scripts/build-lynx-devtools.js`
- `packages/lynx-devtool-cli/scripts/unzip-resources.js`
- `packages/lynx-devtool-cli/src/cli/command/httpServer.ts`

当前状态：

- 已支持外部 upstream checkout 打包
- 已同时产出根级 `inspector.html` / `devtools_app.html`
- 已验证 CLI resources 同步和 `lynx` / `web` 双目录解压

## 5. 升级过程中的验证手段

建议按四层验证，不要只盯“页面能打开”。

### 5.1 构建与静态检查

- 当前 fork：
  - `pnpm run build:devtools-frontend-lynx`
  - `cd packages/devtools-frontend-lynx && npm run check`
- 上游基线：
  - `DEPOT_TOOLS_UPDATE=0 PATH=/Users/bytedance/workspace/codes/depot_tools:$PATH npm run build -- --target=Default`
  - `DEPOT_TOOLS_UPDATE=0 PATH=/Users/bytedance/workspace/codes/depot_tools:$PATH npm run lint`

### 5.2 DevTools 自带测试资产

当前本地 fork 已有可复用入口：

- `cd packages/devtools-frontend-lynx && npm run interactionstest`
- `cd packages/devtools-frontend-lynx && npm run test-local`

迁移建议：

- 优先把被修改模块附近的 unit / interaction / webtest 跑通
- 尤其关注 `DebuggerModel`、`TracingManager`、`ScreencastView`、连接层

### 5.3 产品链路 smoke test

至少覆盖这些场景：

1. Electron/CLI 能加载升级后的 `inspector.html`
2. 能建立 Lynx 调试会话
3. Elements / Console / Sources / Network / Performance 基本可用
4. screencast 与 UI tree 联动正常
5. Preact Devtools 面板正常显示或被明确降级

### 5.4 契约与回归测试

建议补两类自动化：

- `window.postMessage` 契约测试
  - 固定消息名、方向、payload shape
- 协议扩展契约测试
  - `Debugger.removeScriptsForLynxView`
  - `Lynx.getComponentId`
  - `Lynx.getProperties`
  - `Lynx.getData`
  - `Lynx.setTraceMode`

## 6. 接手建议

如果后续由新的 AI 或工程师接手，建议从以下顺序进入：

1. 先阅读 `docs/chromium-upgrade-analysis.md`
2. 再阅读 `docs/chromium-upgrade-plan.zh-CN.md`
3. 查看本文件确认已经执行到哪一步
4. 运行 `tools/chromium-upgrade/generate-migration-report.sh`
5. 运行 `tools/chromium-upgrade/generate-custom-surface-report.sh`
6. 从 `P0-1 协议 source of truth` 开始推进
