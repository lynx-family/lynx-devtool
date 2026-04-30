# Lynx DevTool 升级到较新 Chrome DevTools 的计划

更新时间：2026-04-11

配套背景文档：

- [chromium-upgrade-overview.zh-CN.md](./chromium-upgrade-overview.zh-CN.md)（**综述入口，含背景介绍，建议先读**）
- [chromium-upgrade-analysis.md](./chromium-upgrade-analysis.md)
- [chromium-upgrade-execution-status.zh-CN.md](./chromium-upgrade-execution-status.zh-CN.md)
- [chromium-upgrade-feature-preservation.zh-CN.md](./chromium-upgrade-feature-preservation.zh-CN.md)

## 1. 目标与范围

目标不是做一次“小补丁式升级”，而是把
`packages/devtools-frontend-lynx` 从当前推测约 Chrome 92 时代的基线，
迁移到一个较新的稳定 Chromium DevTools 分支，并保留 Lynx 调试能力。

推荐目标：

- 以“执行升级当日对应的最新 stable milestone 分支”为首选目标。
- 以本次分析日为准，Chrome 147 stable 发布于 2026-04-07，可作为参考上限。

推荐分支策略：

1. 不直接追 `devtools-frontend` `main`
2. 优先选 `refs/heads/chromium/<milestone>`
3. 先完成一次“稳定分支迁移”，再评估是否继续追更高版本

原因：

- 当前 fork 与上游相差多年，直接追主干会同时吃下“架构变化 + 日常 churn”
- 稳定分支更适合第一次大迁移

## 2. 升级会继承哪些 Chrome DevTools 特性和变更

这里不建议追求“从 Chrome 92 到目标版本的完整逐条 changelog”，而建议做
“能力分组 + 关键特性盘点”。

### 2.1 会整体继承的能力大类

升级到较新的上游后，原则上会继承这些大类能力：

- 更近几年的 Performance 面板改进
- 更近几年的 Elements / Styles / Layout 调试能力
- 更近几年的 Network 面板过滤、摘要、依赖分析能力
- 更近几年的 Sources / Workspace / Source Map 调试能力
- 更新版本的 Lighthouse
- 更新版本的隐私、安全、Cookie、第三方资源问题展示
- 近年的 AI Assistance / Console Insights / DevTools MCP 相关代码和入口

### 2.2 建议重点验收的“上游收益”

如果目标选择到最近的稳定分支，建议把下面这些能力列为“升级收益清单”，逐项确认：

#### Performance

- Performance Insights 持续增强
- `Network dependency tree` insight
- 更完整的 trace 分析、过滤和分享能力
- 更完整的字段数据与 insight 联动
- 更成熟的 LCP、布局偏移、阻塞请求等诊断

#### Elements / Styles / Layout

- 对更新 CSS 语法和 layout 能力的支持更完整
- Layout 面板能力更强，例如 masonry 支持
- 样式调试、复杂 CSS 值解析、属性提示与可视化更完善
- 无障碍树与 DOM / Layout 相关体验更好

#### Network / Privacy / Security

- 更强的请求过滤与条件面板
- 更好的请求摘要、重定向、响应时间、依赖关系展示
- Privacy and security 相关面板与问题提示
- 第三方请求、Cookie、请求头等调试能力增强

#### Sources / Workspace

- 更好的 source map 支持
- Workspace 连接与保存回源码能力更强
- 与 AI 修改代码/样式联动的基础能力更成熟

#### Tooling / Infra

- 更新版本的 Lighthouse
- 更近年的 DevTools 构建方式和目录布局
- 更近年的 DevTools MCP server 能力

### 2.3 最近几年与 AI 相关、较值得关注的上游特性

如果目标分支足够新，代码层面通常会带来这些 AI 相关能力：

- AI assistance 面板，可在 DevTools 中直接与 Gemini 对话
- Console Insights，用 AI 解释 Console 错误与警告
- 针对 Performance insight、整份 trace、Network dependency tree 的 AI 调试入口
- 在 Elements / Styles 中借助 Gemini 修改 CSS
- 把截图或图片作为上下文提交给 AI 聊天
- 在 Console 和 Sources 中提供 AI code suggestions
- DevTools MCP server，供 AI agent 驱动 Chrome 调试网页

## 3. Lynx DevTool 之前做了哪些修改，这些内容升级后是否还需要，如何迁移

建议把本仓库的改动拆成 5 层，而不是逐个文件硬搬。

### 3.1 协议层扩展

当前已确认的定制：

- `Debugger.removeScriptsForLynxView`
- `Lynx.getComponentId`
- `Lynx.getProperties`
- `Lynx.getData`
- `Lynx.setTraceMode`

相关文件：

- `packages/devtools-frontend-lynx/v8/include/js_protocol.pdl`
- `packages/devtools-frontend-lynx/third_party/blink/public/devtools_protocol/browser_protocol.json`
- `packages/devtools-frontend-lynx/front_end/generated/*`

是否还需要：

- 需要

迁移建议：

1. 先确定这些协议是否仍由 Lynx 运行时真实提供
2. 先迁移协议“源文件”，再重新生成 `front_end/generated/*`
3. 不要先手改 generated 文件

额外风险：

- 当前仓库中 `Lynx.setTraceMode` 出现在 generated 文件和调用代码里，但本地协议源文件检索结果并不完整对应，说明“协议源 -> generated”的链路可能已经失真
- 升级前必须先补齐“哪个文件才是协议真正 source of truth”

### 3.2 宿主桥与传输层

当前已确认的定制：

- 自定义 `LynxConnection`
- iframe + `postMessage` 通道
- `InspectorFrontendHost` / `devtools_compatibility.js` 的宿主适配
- `plugins/devtool/renderer/devtool/index.tsx` 的消息转发

核心文件：

- `packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts`
- `packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHost.ts`
- `packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHostAPI.ts`
- `packages/devtools-frontend-lynx/front_end/devtools_compatibility.js`
- `plugins/devtool/renderer/devtool/index.tsx`

是否还需要：

- 需要，而且是升级成功的核心前提

迁移建议：

1. 先让新上游在 hosted 模式下能正常启动
2. 再迁移 Lynx 的 transport bridge
3. 把 `window message` 事件名、方向、payload 先整理成一份契约表
4. 优先迁移“会影响连接成败”的消息
   - `lynx_open`
   - `lynx_message`
   - `send_message`
   - `dispatchMessageChunk`
   - `reattachMainTarget`
5. 把统计和加载进度类消息放到第二阶段

### 3.3 UI / 面板 / 产品能力

当前已确认的定制：

- Screencast 的 Lynx 适配
- `Preact Devtools` 自定义面板
- Lynx shared-context 相关设置
- 主入口加载进度、埋点

核心文件：

- `packages/devtools-frontend-lynx/front_end/panels/screencast/ScreencastView.ts`
- `packages/devtools-frontend-lynx/front_end/panels/preact_devtools/*`
- `packages/devtools-frontend-lynx/front_end/core/sdk/DebuggerModel.ts`
- `packages/devtools-frontend-lynx/front_end/core/sdk/TracingManager.ts`
- `packages/devtools-frontend-lynx/front_end/core/sdk/sdk-meta.ts`
- `packages/devtools-frontend-lynx/front_end/entrypoints/main/MainImpl.ts`

是否还需要：

- Screencast：需要
- Shared-context source 清理：需要
- Trace mode 切换：需要
- Preact Devtools 面板：大概率需要，但建议和业务 owner 再确认
- 加载进度埋点：不一定阻塞首版升级，可分阶段回补

迁移建议：

1. 先迁移“没有它就不能调试”的能力
   - 会话建立
   - 页面树/元素树
   - 源码与断点
   - trace
   - screencast
2. 再迁移“提升体验但不阻塞调试闭环”的能力
   - 埋点
   - loading progress
   - 一些设置项文案
3. 对 Preact Devtools 这类自定义面板，优先尝试做成“局部增量面板”，不要深改上游核心入口

### 3.4 插件桥与产品日志

当前已确认的定制：

- `postPluginMessage`
- `addPluginEventListener`
- env log 上报
- statistics 上报
- UI tree 同步

核心文件：

- `packages/devtools-frontend-lynx/front_end/core/protocol_client/InspectorBackend.ts`
- `plugins/devtool/renderer/index.tsx`
- `src/renderer/utils/context.ts`
- `packages/lynx-devtool-cli/src/cli/command/handler.ts`

是否还需要：

- 大部分需要

迁移建议：

- 第一阶段只保“功能必须”的插件桥
- 第二阶段补全统计、日志和非阻塞型插件事件
- 把这些行为尽可能收口到少数 helper 中，避免继续散落进 DevTools 核心模块

### 3.5 构建与分发

当前已确认的定制：

- 自定义 `depot_tools` 拉取脚本
- 自定义 GN/Ninja 构建封装
- `inspector.html` 打包改写
- CLI 静态资源分发 `/localResource/devtool`

核心文件：

- `scripts/fetch-depot-tools.js`
- `scripts/build-lynx-devtools.js`
- `scripts/download-devtools-frontend.js`
- `packages/lynx-devtool-cli/src/cli/command/httpServer.ts`

是否还需要：

- 需要结果，但未必要保留原实现

迁移建议：

- 不要假设上游仍沿用当前目录结构和产物布局
- 允许重写本仓库的 build glue，但不要强行保持旧脚本
- 只保留两个目标：
  - 能稳定生成 Lynx 需要的 frontend artifact
  - 能被 CLI / Electron 正确分发和加载

## 4. 建议的升级步骤

### 阶段 A：冻结现状

目标：

- 得到“升级前基线”

动作：

1. 保存当前可运行产物
2. 录制至少一组真实 Lynx 调试流程
3. 保存一份典型 CDP/消息流日志
4. 记录关键页面截图

输出物：

- 基线运行录像
- 协议日志
- 功能清单

### 阶段 B：导入干净上游

目标：

- 在独立分支或临时目录导入新的 upstream `devtools-frontend`

动作：

1. 选定目标 milestone
2. 验证纯上游可构建
3. 验证上游产物结构
4. 确认 `devtools_app.html` / `inspector.html` 或其等价入口

输出物：

- 一份能独立构建的纯上游基线

### 阶段 C：先迁协议和连接

目标：

- 让新的 frontend 能连上 Lynx 调试会话

动作：

1. 迁协议扩展
2. 重新生成 generated 协议文件
3. 迁宿主桥
4. 迁 `LynxConnection`
5. 验证 attach / detach / reconnect

输出物：

- 能打开页面并建立会话的新前端

### 阶段 D：迁核心调试闭环

目标：

- 恢复最关键用户路径

动作：

1. Elements
2. Console
3. Sources / breakpoint / source map
4. shared-context 脚本清理
5. Performance trace
6. Screencast

输出物：

- 可以替代旧版进行日常调试的 alpha 版本

### 阶段 E：迁产品增强层

目标：

- 回补体验与增值能力

动作：

1. Preact Devtools 面板
2. 插件桥
3. telemetry / env log
4. loading progress
5. 其他自定义设置项

输出物：

- 功能基本对齐旧版的 beta 版本

## 5. 怎样保证升级前后的功能可用性？有哪些测试手段？

建议采用“基线对比 + 自动化 + 真机 smoke”的组合。

### 5.1 仓库里已经存在、可以直接利用的测试能力

在 `packages/devtools-frontend-lynx/package.json` 里已经有：

- `npm run unittest`
- `npm run e2etest`
- `npm run interactionstest`
- `npm run perf`
- `npm run test-local`

现有测试目录包括：

- `test/unittests`
- `test/e2e`
- `test/interactions`
- `test/screenshots`
- `test/perf`
- `test/webtests`

此外还有：

- `packages/devtools-web-simulator`
  - 适合做宿主消息链路和 CDP 桥的轻量模拟验证

### 5.2 建议的测试分层

#### 第 1 层：构建与产物测试

- `gclient sync` / 依赖同步成功
- 新前端可构建
- 打包产物结构符合 CLI/Electron 预期
- `inspector.html` / `devtools_app.html` 可加载

#### 第 2 层：协议契约测试

建议新增最小契约测试，覆盖：

- `Debugger.removeScriptsForLynxView`
- `Lynx.getComponentId`
- `Lynx.getProperties`
- `Lynx.getData`
- `Lynx.setTraceMode`
- attach / detach / reattach

做法：

- 用模拟 driver 或 web simulator 注入消息
- 验证前端是否正确收发、状态是否正确变化

#### 第 3 层：前端集成测试

重点场景：

- 打开调试页
- 建立会话
- 选中元素
- Console 输出
- Sources 打断点
- 共享上下文脚本销毁清理
- Trace 启停
- 首帧 screencast

做法：

- 复用 e2e / interaction 测试框架
- 优先写“用户路径式”测试，不直接调用内部 model

#### 第 4 层：视觉回归测试

重点对象：

- Screencast
- Elements 面板关键区域
- Preact Devtools 面板
- 自定义 drawer/panel

做法：

- 复用 `test/screenshots`
- 保留升级前后基准图

#### 第 5 层：真机或真实 Lynx 应用 smoke 测试

至少覆盖：

- Android / iOS 或实际使用中的主要平台
- 一个包含 shared-context 的真实页面
- 一个能触发 trace 的真实页面
- 一个含复杂样式/元素树的真实页面

### 5.3 建议的“前后对比”机制

最推荐的方式：

1. 旧版本和新版本都跑同一组用例
2. 对比结果分为三类
   - 功能正确
   - 体验差异但可接受
   - 回归缺陷

建议维护一份回归清单，至少包含：

- 是否能进入调试页
- 是否能连接会话
- 是否能正确显示元素树
- 是否能点选并联动 UI tree
- 是否能看到 Console
- 是否能设置/命中断点
- 是否能查看 source map 映射
- 是否能正确清理 shared-context 脚本
- 是否能开始/结束 tracing
- 是否能收到并展示 screencast 帧
- 是否能切换全屏 / LynxView 模式
- 是否能使用 Preact Devtools
- 是否能 reconnect / reattach

## 6. 升级后能否用到 Chrome DevTools 的 AI 特性？

结论分两层：

### 6.1 代码层面：可以继承

如果目标分支足够新，代码层面通常会继承这些 AI 相关入口或能力：

- AI assistance 面板
- Console Insights
- `Debug with AI` 上下文入口
- Performance insight 与 full trace 的 AI 调试
- Network dependency tree 的 AI 调试
- CSS 修改建议与保存到 workspace
- 图片 / 截图作为 AI 上下文
- Console / Sources 的 code suggestions
- DevTools MCP server 相关能力

### 6.2 产品层面：大概率不能“直接可用”

对 `lynx-devtool` 来说，升级后不能假设这些官方 AI 能力会自动可用。

原因有两个：

#### 原因 A：官方功能有明确运行前提

Chrome 官方文档要求 AI assistance / Console Insights 至少满足：

- 使用最新版 Chrome
- 登录 Google Account
- 位于支持地区
- DevTools 语言为 English (US)
- 打开 `Settings > AI Innovations`

而 `lynx-devtool` 是 Electron + 自定义 embedder，不是标准 Chrome DevTools 运行环境。

#### 原因 B：Lynx DevTool 的宿主链路是自定义的

本仓库使用的是：

- 自定义 `InspectorFrontendHost`
- 自定义 `LynxConnection`
- 自定义 iframe / `postMessage` 链路

因此即使新上游代码里带有 AI 面板入口，通常也需要额外适配：

- 账号与身份态
- feature flag / setting
- 法务与 ToS
- 数据上送与隐私合规
- embedder API
- 可能的后端服务依赖

### 6.3 哪些 AI 能力最有希望被“产品化引入”

如果团队后续想在 Lynx DevTool 中真正提供 AI 能力，建议按下面优先级评估：

#### 可优先评估

- 类似 Console Insights 的错误解释
- 面向 Styles / Layout 的解释和修复建议
- 面向 Performance trace 的总结与建议
- 面向 Network / dependency tree 的上下文分析

这些能力与 Lynx 调试场景高度相关，用户价值也最直接。

#### 需要单独产品化，不应假设自动可用

- 官方 Gemini 后端直连能力
- 官方 Chrome 登录态相关能力
- DevTools MCP server 直接复用到 Lynx 调试

特别是 MCP server：

- 它是“让 AI agent 调试 Chrome 页面”的能力
- 不是“让 Lynx DevTool 自动拥有 AI”
- 如果要给 Lynx 用，通常需要另做 Lynx 场景的 MCP server 或 agent bridge

### 6.4 推荐处理方式

建议把 AI 相关能力分成两期：

#### 一期

- 升级时先把 AI UI 视为“可选能力”
- 若运行条件不满足，则在 Lynx DevTool 中默认关闭或隐藏
- 避免升级阶段因为 AI 能力不可用而阻塞主线

#### 二期

- 单独立项评估“Lynx 版 AI 调试能力”
- 以 Lynx 协议、Lynx trace、Lynx 树结构为上下文做产品化设计
- 评估是否需要 MCP / agent / 自定义 LLM backend

## 7. 最终建议

这次升级最稳妥的路线是：

1. 先选一个较新的 stable Chromium DevTools 分支
2. 先恢复协议与连接
3. 再恢复核心调试闭环
4. 最后回补插件、埋点和 AI 等增强层

不建议：

- 在旧 fork 上零散 cherry-pick 新功能
- 先迁 UI 再迁协议和连接
- 把 generated 协议文件当成主要迁移入口
- 把官方 AI 能力是否可用当作这次升级的 blocking 条件
