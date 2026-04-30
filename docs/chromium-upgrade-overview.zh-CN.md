# Lynx DevTool × Chromium 升级综述

最后更新：2026-04-29

## 文档索引

| 文档 | 用途 |
| --- | --- |
| **本文**（`chromium-upgrade-overview.zh-CN.md`） | 背景介绍、架构关系、升级动因、当前进展、快速入门 |
| [`chromium-upgrade-analysis.md`](./chromium-upgrade-analysis.md) | 现有仓库深度技术分析、Lynx 定制清单、升级策略建议（英文，面向 AI/工程师交接） |
| [`chromium-upgrade-plan.zh-CN.md`](./chromium-upgrade-plan.zh-CN.md) | 分阶段升级计划、迁移分层策略、测试手段 |
| [`chromium-upgrade-execution-status.zh-CN.md`](./chromium-upgrade-execution-status.zh-CN.md) | 本轮执行记录、已完成 overlay/patch、已解决运行时兼容问题、下一步行动 |
| [`chromium-upgrade-feature-preservation.zh-CN.md`](./chromium-upgrade-feature-preservation.zh-CN.md) | 特性保全矩阵：按能力列出升级状态、落点、验证方式 |
| [`../tools/chromium-upgrade/README.md`](../tools/chromium-upgrade/README.md) | 升级辅助工具使用说明 |

---

## 1. 背景

### 1.1 Lynx 框架简介

[Lynx](https://lynxjs.org) 是一套面向移动端的跨平台 UI 框架，类似于 React Native。
它允许开发者用前端技术（类 React/Vue 语法）编写移动应用界面，并由专属的 Lynx 渲染引擎
（而非 WebView）负责原生渲染。

Lynx 渲染引擎运行于 iOS/Android 原生进程中，通过自定义的 Bridge 与
JavaScript 业务逻辑保持通信。由于框架行为与纯 Web 有差异，普通的浏览器 DevTools
无法直接用于调试 Lynx 应用，因此需要专属的调试工具。

### 1.2 lynx-devtool 是什么

`lynx-devtool` 是面向 Lynx 框架的官方调试客户端，以
[Electron](https://www.electronjs.org) 桌面应用的形式发布。·

它的主要职责：

- 发现并连接正在运行 Lynx 应用的移动设备（Android/iOS）
- 代理移动端的调试协议流量，中转给前端 UI 展示
- 提供多标签页式的调试工作区：Elements、Console、Sources、Network、Performance、Screencast 等
- 以插件机制支持 Preact Devtools 等 Lynx 专有调试面板

### 1.3 Chrome DevTools Frontend 在项目中的角色

`lynx-devtool` 的调试 UI 并不是从零自研的，而是直接复用了
[Chrome DevTools Frontend](https://chromium.googlesource.com/devtools/devtools-frontend.git)
这个开源项目。Chrome DevTools Frontend 是你在 Chrome 浏览器按 F12 时看到的那套面板 UI，
它完全以前端技术（TypeScript + 自研 UI 框架）实现，可以独立于 Chrome 浏览器部署。

在 `lynx-devtool` 项目中，它以独立包的形式存放于：

```
packages/devtools-frontend-lynx/
```

运行时，这份前端产物会被 Electron 主进程通过 iframe 加载，并由宿主层（`plugins/devtool/renderer/devtool/index.tsx`）
与调试驱动层建立消息桥梁。

### 1.4 lynx-devtool 与 Chromium 关系的全貌

下面这张结构图展示了各层之间的关系：

```
┌────────────────────────────────────────────────────────────────────┐
│  Electron 桌面应用（lynx-devtool）                                   │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Renderer Process                                        │      │
│  │                                                          │      │
│  │  ┌──────────────────────────────────────────────────┐    │      │
│  │  │  devtool plugin renderer (React)                 │    │      │
│  │  │                                                  │    │      │
│  │  │  ┌────────────────────────────────────────────┐  │    │      │
│  │  │  │  <iframe>                                  │  │    │      │
│  │  │  │  Chrome DevTools Frontend                  │  │    │      │
│  │  │  │  (packages/devtools-frontend-lynx)         │  │    │      │
│  │  │  │                                            │  │    │      │
│  │  │  │  Elements / Console / Sources /            │  │    │      │
│  │  │  │  Performance / Screencast /                │  │    │      │
│  │  │  │  Preact Devtools Panels ...                │  │    │      │
│  │  │  └────────────────────────────────────────────┘  │    │      │
│  │  │         ↕  postMessage / LynxConnection          │    │      │
│  │  └──────────────────────────────────────────────────┘    │      │
│  │                 ↕  IPC / WebSocket                       │      │
│  └──────────────────────────────────────────────────────────┘      │
│                   ↕  USB/TCP                                       │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  lynx-devtool-cli(HTTP/WS server)                        │      │
│  │  提供 /localResource/devtool 静态资源                      │      │
│  └──────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────┘
                         ↕  USB/WiFi
┌────────────────────────────────────────────────────────────────────┐
│  移动设备（Android / iOS）                                           │
│                                                                    │
│  Lynx 渲染引擎  ←→  CDP over WebSocket  ←→  devtools_worker         │
└────────────────────────────────────────────────────────────────────┘
```

**关键点：**

1. **Chrome DevTools Frontend 是 UI 层**：所有面板（Elements、Console、Sources 等）均来自上游 DevTools 前端代码，lynx-devtool 在此基础上做定制，而不是重写。

2. **通信通道是定制的**：标准 Chrome DevTools 通过 WebSocket 直连调试目标；lynx-devtool 改为通过 `postMessage` / iframe 桥接，再转发给移动设备的 Lynx 调试端口。核心类为 `LynxConnection`，位于 `front_end/core/sdk/Connections.ts`。

3. **协议是 CDP 超集**：Lynx 在 Chrome DevTools Protocol 基础上扩展了专属 domain 和命令：
   - `Lynx.getComponentId`
   - `Lynx.getProperties`
   - `Lynx.getData`
   - `Lynx.setTraceMode`
   - `Debugger.removeScriptsForLynxView`

4. **Electron 宿主版本固定**：当前宿主 Electron 22 对应 Chromium 108，这意味着加载的 DevTools 前端必须能在 Chromium 108 的渲染环境中正确运行。

5. **fork 而非 submodule**：`packages/devtools-frontend-lynx` 是一个 fork，不是 git submodule，意味着 Lynx 的修改直接散落在上游文件里，升级需要手动迁移所有 diff。

---

## 2. 为什么需要升级 Chromium DevTools

### 2.1 当前基线有多旧？

现有 `packages/devtools-frontend-lynx` 基于以下信号推断基线：

| 信号 | 值 |
| --- | --- |
| `DEPS` 中 Chromium Snapshot | `902866`（约 2021 年 Chrome 92 时代） |
| `package.json` TypeScript | `4.3.2`（2021 年） |
| `devtools-protocol` 包版本 | `0.0.883894` |
| `eslint` | `7.28.0` |

距本次分析（2026-04-07）已落后约 **5 年、55 个 Chrome major 版本**。

### 2.2 旧基线带来的问题

**用户可见的功能缺失：**

- 缺少近几年 Performance 面板的全部改进（Insights、Network dependency tree 等）
- 缺少近几年的 Elements / Styles / Layout 调试增强
- Lighthouse 版本极旧
- 缺少 AI Assistance、Console Insights、DevTools MCP 等现代能力

**工程风险：**

- 上游已大幅重构目录结构（新增 `services/`、`extension-api/`、`mcp/` 等顶层目录），当前 fork 的 diff 越来越难追踪
- 构建工具链（TypeScript、Node、depot_tools）版本过低，随时可能因宿主系统升级而断崖式失效
- 越来越多的安全修复无法回流

**运行时稳定性：**

- 现有前端与 Electron 22（Chromium 108）的兼容是"凑合能跑"状态，缺乏系统性测试保障

### 2.3 升级带来的收益

- 继承近几年上游所有面板和调试能力
- 代码基线对齐社区，Lynx 定制 diff 更易审查和维护
- 构建工具链恢复到支持维护的版本
- 天然获得 AI Assistance、MCP 等上游新能力的代码骨架

---

## 3. 升级工作概览

### 3.1 目标版本

| 项 | 值 |
| --- | --- |
| 目标上游分支 | `chromium/7724` |
| 对应 commit | `a429d5a8b2e78b92dc99ef220ca67c402cbe1a67` |
| 上游 checkout 目录 | `/Users/bytedance/workspace/codes/devtools-frontend-upstream-7724` |
| 选择原因 | 截至分析日（2026-04-07）最接近 Chrome 147 stable 的可用稳定分支 |

### 3.2 升级采用的方法论

由于 fork 与上游相差多年，不能做普通的 diff/merge，而是采用**"干净上游 + 分层重放 Lynx patch"**的策略：

1. 独立 checkout 纯净上游基线
2. 验证纯净上游可独立构建
3. 按能力层（连接层 → 协议层 → UI 层 → 产品增强层）逐层向上游 overlay/patch Lynx 定制
4. 每层补完后重新构建验证
5. 最终打包接入 CLI 分发链路

这套方法的关键资产沉淀在 `tools/chromium-upgrade/`，包含可重复执行的脚本，防止升级变成一次性手工操作。

### 3.3 当前进展（截至 2026-04-29）

**已完成：**

| 阶段 | 状态 |
| --- | --- |
| 上游 `chromium/7724` 独立构建验证 | ✅ 完成 |
| Lynx 连接层（`LynxConnection`）overlay | ✅ 已入 overlay，上游构建通过 |
| 宿主桥（`InspectorFrontendHost`）overlay | ✅ 已入 overlay，上游构建通过 |
| Lynx 协议扩展（`Lynx.*`, `Debugger.removeScriptsForLynxView`）repeatable patch | ✅ 已入 patch 脚本，上游构建通过 |
| 调试器核心（`DebuggerModel`, `RuntimeModel`, `ResourceScriptMapping`）patch | ✅ 已入 patch 脚本，上游构建通过 |
| Screencast 能力（HD/fps/lynxview/Preact 联动）patch | ✅ 已入 patch 脚本，上游构建通过 |
| TracingManager Lynx trace mode + proto stream 转换 | ✅ 已入 patch 脚本，上游构建通过 |
| Preact Devtools 自定义面板 | ✅ overlay 复制 + 面板注册，上游构建通过 |
| MainImpl loading progress 埋点 | ✅ 已入 patch 脚本，上游构建通过 |
| 打包链路（新 upstream → CLI tarball）验证 | ✅ `build-lynx-devtools.js` 已支持，CLI 分发验证通过 |
| Electron 22 运行时兼容层 | ✅ `devtools_compatibility.js` + `compare-versions.js` 补齐 |
| CSS nesting 转译（PostCSS） | ✅ 接入两条打包链路 |
| Elements 面板树展开箭头 `-webkit-mask-*` fallback | ✅ patch 脚本已补入，真机验证通过 |

**进行中 / 待验收：**

- 真实设备完整 smoke test（Elements / Console / Sources / Trace / Screencast 全链路）
- 非 `Elements` 面板的完整协议能力缺口排查
- 部分 legacy sprite 图标/按钮细节

详见 [`chromium-upgrade-execution-status.zh-CN.md`](./chromium-upgrade-execution-status.zh-CN.md)。

---

## 4. 核心技术挑战

### 4.1 深度 fork，diff 高度分散

Lynx 的定制不局限于外层集成文件，而是散落在 DevTools 核心模块（`front_end/core`、`front_end/panels`、`front_end/entrypoints`）中。这意味着升级时无法做简单的文件替换，需要逐文件精确迁移。

### 4.2 连接层架构已变

当前 fork 里的 `LynxConnection` 直接实现旧的 `InspectorBackend.Connection` 接口。
上游 `chromium/7724` 已重构为 `ConnectionTransport` + `DevToolsCDPConnection` + `SessionRouter`
模型，旧实现不能照搬，需要适配新接口。

### 4.3 宿主 Electron 22 与新前端的兼容缺口

新前端（`chromium/7724`）假设运行在接近 Chrome 122+ 的现代浏览器环境，
但宿主 Electron 22 只对应 Chromium 108，缺失以下运行时能力：

- `Promise.withResolvers`
- `URL.canParse`
- `Array.prototype.toSorted`
- `Map.groupBy` / `Object.groupBy`
- Iterator helpers 及全局 `Iterator`
- Popover API / `:popover-open`
- CSS nesting 语法
- `-webkit-mask-*` 前缀缺失导致的图标渲染问题

这些兼容缺口必须在打包阶段逐一修补，而不能等 Electron 升级。

### 4.4 协议 source of truth 不一致

升级前已发现：`Lynx.setTraceMode` 曾只存在于 `front_end/generated/*`，但不在
`v8/include/js_protocol.pdl` 和 `browser_protocol.json` 协议源文件中，
说明 generated 文件曾被手工修改。本轮已修复这一问题并新增
`tools/chromium-upgrade/check-protocol-consistency.sh` 防止回归。

---

## 5. 快速入门（继续执行升级）

### 5.1 环境准备

```bash
# 上游 checkout（已克隆）
ls /Users/bytedance/workspace/codes/devtools-frontend-upstream-7724

# depot_tools（已克隆）
ls /Users/bytedance/workspace/codes/depot_tools
```

### 5.2 重新应用所有 Lynx overlay/patch 并构建

```bash
# 在 lynx-devtool 仓库根目录执行：
tools/chromium-upgrade/apply-upstream-overlay.sh \
  /Users/bytedance/workspace/codes/devtools-frontend-upstream-7724

node tools/chromium-upgrade/patch-upstream-lynx-features.js \
  /Users/bytedance/workspace/codes/devtools-frontend-upstream-7724

cd /Users/bytedance/workspace/codes/devtools-frontend-upstream-7724
DEPOT_TOOLS_UPDATE=0 \
  PATH=/Users/bytedance/workspace/codes/depot_tools:$PATH \
  npm run build -- --target=Default
```

### 5.3 打包并同步到 CLI

```bash
cd /Users/bytedance/workspace/codes/lynx-devtool

node scripts/build-lynx-devtools.js \
  --frontend-dir /Users/bytedance/workspace/codes/devtools-frontend-upstream-7724 \
  --skip-build

node scripts/sync-devtools-output.js

pnpm --filter @lynx-js/devtool-plugin-core run build
pnpm --filter @lynx-js/lynx-devtool-utils run build
pnpm --filter @lynx-js/lynx-devtool-cli run build
```

### 5.4 本地验证

```bash
pnpm run dev
```

连接真机后，按以下顺序验证：

1. 设备/页面选择器可切换，主区域不黑屏
2. Elements 面板可加载 DOM 树，展开箭头可见
3. Console 面板可正常输出
4. Sources 面板可打断点
5. Performance / Trace 可启停
6. Screencast 可显示画面

### 5.5 工具链说明

| 工具 | 说明 |
| --- | --- |
| `tools/chromium-upgrade/apply-upstream-overlay.sh` | 将 overlay 源文件复制到上游 checkout，并执行兼容性 patch |
| `tools/chromium-upgrade/patch-upstream-lynx-features.js` | 将所有 Lynx repeatable patch 应用到上游 checkout |
| `tools/chromium-upgrade/check-protocol-consistency.sh` | 检查 Lynx 协议命令在 `pdl` / `json` / `generated` 三者间是否一致 |
| `tools/chromium-upgrade/generate-migration-report.sh` | 生成迁移进度报告 |
| `tools/chromium-upgrade/generate-custom-surface-report.sh` | 生成本地定制点索引报告 |
| `scripts/build-lynx-devtools.js` | 将上游构建产物打包为 CLI 可消费的 tarball |
| `scripts/patch-devtools-runtime-compat.js` | 对打包产物执行 Electron 22 运行时兼容补丁 |
| `scripts/transpile-devtools-css.js` | 对打包产物中的 CSS nesting 执行 PostCSS 转译 |
