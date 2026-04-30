# Chromium Upgrade Analysis For `lynx-devtool`

Last updated: 2026-04-29

> **中文读者提示**
> 如需了解 lynx-devtool 与 Chromium 的关系、升级动因和整体进展，请先阅读：
> **[chromium-upgrade-overview.zh-CN.md](./chromium-upgrade-overview.zh-CN.md)**（综述文档）
>
> 本文档定位为技术深度分析，是面向工程师和 AI Agent 的交接参考，保留英文写作以便工具链处理。
> 相关中文执行记录参见：
> - [chromium-upgrade-plan.zh-CN.md](./chromium-upgrade-plan.zh-CN.md)
> - [chromium-upgrade-execution-status.zh-CN.md](./chromium-upgrade-execution-status.zh-CN.md)
> - [chromium-upgrade-feature-preservation.zh-CN.md](./chromium-upgrade-feature-preservation.zh-CN.md)

## Goal

This document captures the current repository knowledge needed to upgrade
`packages/devtools-frontend-lynx` toward a newer Chrome DevTools frontend while
preserving Lynx-specific debugging capabilities.

It is written as a handoff note for future engineers and AI agents.

## Snapshot

- Repository: `lynx-devtool`
- Branch: `main`
- Commit analyzed: `dfe310fafc67454f65322fcf0c95b884aa2ebcdd`
- Worktree status during analysis: clean
- Main Chromium-derived package: `packages/devtools-frontend-lynx`
- Main runtime path: CLI static server -> Electron plugin iframe ->
  DevTools frontend -> Lynx/CDP bridge

## Repository Map Relevant To The Upgrade

### 1. Chromium/DevTools fork

- `packages/devtools-frontend-lynx`
  - Standalone fork/copy of Chrome DevTools frontend.
  - Has its own `.gclient`, `DEPS`, GN files, generated protocol files, and
    build scripts.

### 2. Build and packaging glue

- Root `package.json`
  - Entry scripts:
    - `build:devtools-frontend-lynx`
    - `fetch:depot_tools`
    - `sync:devtools-gn`
    - `build:devtools`
    - `sync:devtools-dist`
- `scripts/fetch-depot-tools.js`
  - Downloads `depot_tools`.
  - Also installs `ninja` via `cipd`.
- `scripts/build-lynx-devtools.js`
  - Runs GN/Ninja in `packages/devtools-frontend-lynx`.
  - Copies `static/plugin` and `static/trace` into generated frontend output.
  - Produces packaged artifacts under
    `packages/devtools-frontend-lynx/output`.
- `scripts/download-devtools-frontend.js`
  - Downloads a previously built frontend tarball from GitHub releases.

### 3. Runtime serving and embedding

- `packages/lynx-devtool-cli/src/cli/command/httpServer.ts`
  - Serves the packaged frontend at `/localResource/devtool`.
- `plugins/devtool/main/index.ts`
  - Chooses which frontend HTML to load:
    - `inspector.html`
    - `devtools_app.html`
- `plugins/devtool/renderer/devtool/index.tsx`
  - Embeds the frontend in an iframe.
  - Bridges iframe `postMessage` traffic to the local debug driver.

### 4. Frontend transport and host bridge

- `packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts`
  - Replaces the usual DevTools transport path with `LynxConnection`.
  - Converts window messages into CDP traffic and product telemetry.
- `packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHost.ts`
  - Adds Lynx-specific host reporting and message helpers.
- `packages/devtools-frontend-lynx/front_end/devtools_compatibility.js`
  - Compatibility/embedder bridge used by the hosted frontend.
- `packages/devtools-frontend-lynx/front_end/core/protocol_client/InspectorBackend.ts`
  - Adds plugin bridge helpers and environment logging helpers.

## Current Baseline

### DevTools/Chromium signals from the local fork

The current fork is clearly on an old DevTools baseline.

Key signals:

- `packages/devtools-frontend-lynx/DEPS`
  - `chromium_linux = 902866`
  - `chromium_mac = 902866`
  - `chromium_win = 902866`
  - Node bucket version: `chromium-nodejs/14.15.4`
- `packages/devtools-frontend-lynx/package.json`
  - `typescript = 4.3.2`
  - `eslint = 7.28.0`
  - `rollup = 2.42.3`
  - `@types/node = 15.6.2`
  - `devtools-protocol = 0.0.883894`

### Baseline inference

Inference: this fork is roughly in the Chrome 92 era, or at least in that
timeframe.

Reason:

- Chromium snapshot `902866` is very old.
- Toolchain choices align with 2021-era DevTools frontend.
- Multiple files still carry upstream 2021 copyrights.

This is an inference from local repository signals, not a directly declared
version tag inside the repo.

### Gap versus current upstream

As of 2026-04-07, Chrome 147 is on the stable channel.

Recent upstream DevTools frontend signals from official sources:

- Recent upstream `package.json` builds via
  `vpython3 third_party/node/node.py --output scripts/run_build.mjs`
  instead of the older GN/Ninja-only shell used here.
- Recent upstream repository branches and trees show additional top-level
  surfaces such as `build`, `buildtools`, `extension-api`, `extensions`, and
  `mcp`, which means the repository shape has evolved materially.

Conclusion: this repo is not one or two milestones behind. It is multiple years
behind and should be treated as a rebase/migration project, not a normal patch
upgrade.

## Lynx-Specific Surfaces That Must Survive

The upgrade is not only about replacing upstream frontend code. The Lynx
product has added protocol, host, transport, UI, telemetry, and packaging
layers.

### 1. Protocol extensions

Source of truth:

- `packages/devtools-frontend-lynx/v8/include/js_protocol.pdl`
- `packages/devtools-frontend-lynx/third_party/blink/public/devtools_protocol/browser_protocol.json`

Observed custom protocol additions:

- `Debugger.removeScriptsForLynxView`
- `Lynx.getComponentId`
- `Lynx.getProperties`
- `Lynx.getData`
- `Lynx.setTraceMode`

Generated files impacted:

- `packages/devtools-frontend-lynx/front_end/generated/InspectorBackendCommands.js`
- `packages/devtools-frontend-lynx/front_end/generated/protocol-proxy-api.d.ts`
- `packages/devtools-frontend-lynx/front_end/generated/protocol-mapping.d.ts`
- `packages/devtools-frontend-lynx/front_end/generated/protocol.d.ts`

Important rule:

- Treat generated files as derived artifacts.
- Do not make them the primary merge target.
- Reapply protocol changes to the protocol source, then regenerate.

### 2. Frontend transport and host embedding

Files:

- `packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts`
- `packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHost.ts`
- `packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHostAPI.ts`
- `packages/devtools-frontend-lynx/front_end/devtools_compatibility.js`
- `plugins/devtool/renderer/devtool/index.tsx`

What is custom here:

- Frontend is hosted in an iframe, not just connected to a normal DevTools
  WebSocket.
- `LynxConnection` consumes window messages like:
  - `lynx_open`
  - `lynx_message`
  - `devtool_stats`
  - `a11y_mark_lynx`
- Host events include Lynx-specific paths like:
  - `dispatchMessageChunk`
  - `reattachMainTarget`
  - product-side status and loading messages

This layer is one of the highest upgrade risks because upstream transport and
embedder assumptions change over time.

### 3. Product-specific UI and behavior

Files with clear Lynx additions:

- `packages/devtools-frontend-lynx/front_end/core/sdk/DebuggerModel.ts`
  - reacts to `removeScriptsForLynxView`
- `packages/devtools-frontend-lynx/front_end/core/sdk/TracingManager.ts`
  - toggles `Lynx.setTraceMode`
- `packages/devtools-frontend-lynx/front_end/panels/screencast/ScreencastView.ts`
  - Lynx-specific screencast handling and plugin messaging
- `packages/devtools-frontend-lynx/front_end/panels/preact_devtools/*`
  - custom panel
- `packages/devtools-frontend-lynx/front_end/core/sdk/sdk-meta.ts`
  - custom settings such as `screencastFPS` and
    `showLynxSharedContextSources`
- `packages/devtools-frontend-lynx/front_end/core/common/SettingRegistration.ts`
  - custom `SCREENCAST` settings category
- `packages/devtools-frontend-lynx/front_end/entrypoints/main/MainImpl.ts`
  - loading progress and statistics instrumentation

Keyword scans show the custom surface is concentrated primarily in:

- `front_end/core`
- `front_end/panels`
- `front_end/generated`
- `front_end/entrypoints`

That is a warning sign: the fork is deep inside DevTools internals, not only at
the outer integration layer.

### 4. Plugin bridge and product telemetry

Files:

- `packages/devtools-frontend-lynx/front_end/core/protocol_client/InspectorBackend.ts`
- `plugins/devtool/renderer/index.tsx`
- `src/renderer/utils/context.ts`
- `packages/lynx-devtool-cli/src/cli/command/handler.ts`

What this layer does:

- Forwards plugin events such as `uitree-panel` and `uitree-drawer`.
- Emits product statistics and environment logs.
- Bridges messages like `send_message`, `statistics`, `addEnvLog`, and
  `update_session_target`.

This is another area where "frontend opens successfully" is not enough. The UI
can appear healthy while telemetry, plugin sync, or target session state is
silently broken.

### 5. Packaging and distribution

Files:

- `scripts/build-lynx-devtools.js`
- `scripts/download-devtools-frontend.js`
- `packages/lynx-devtool-cli/src/cli/command/httpServer.ts`

Current behavior:

- Builds a standalone frontend bundle.
- Copies static plugin and trace assets into the generated frontend.
- Rewrites `inspector.html` paths during packaging.
- Serves the bundle from CLI static routes.

If upstream output paths or HTML entrypoint behavior change, packaging will
break even if the frontend itself still compiles.

## Recommended Upgrade Strategy

### Recommendation

Use a recent stable Chromium DevTools branch as the target, not tip-of-tree
`main`.

Recommended overall approach:

1. Import a clean upstream snapshot from a recent stable
   `refs/heads/chromium/*` branch.
2. Reapply the Lynx-specific layers in a controlled order.
3. Shrink the long-term fork surface while reapplying.

Why this is the best path:

- The current fork is too old for a low-conflict in-place merge.
- The custom code touches many internal DevTools files.
- Replaying focused Lynx layers onto a clean upstream baseline is easier to
  reason about than trying to preserve every old local implementation.

## Suggested execution phases

### Phase 0: Freeze current behavior

Before any upstream import:

- Save a known-good build artifact of the current frontend.
- Record at least one real Lynx debugging session per major feature area.
- Save representative CDP logs and session lifecycle logs.
- Preserve screenshots or short videos for:
  - Elements tree
  - Console
  - Sources
  - Performance/trace
  - Screencast
  - Preact Devtools

Deliverable:

- A pass/fail baseline that future validation can compare against.

### Phase 1: Choose target branch

Prefer:

- A recent stable Chromium milestone branch under
  `https://chromium.googlesource.com/devtools/devtools-frontend/+/refs/heads/chromium/*`

Avoid starting with:

- `main`, unless the team explicitly wants to absorb ongoing upstream churn.

Reason:

- Stable milestone branches reduce moving-target risk while still giving a large
  modernization jump.

### Phase 2: Import upstream cleanly

Do this in an isolated branch or temporary sibling directory first.

Success criteria for this phase:

- Stock upstream frontend builds successfully.
- `devtools_app.html` and `inspector.html` can be produced or adapted to the new
  upstream output structure.
- No Lynx custom behavior is required yet.

Important:

- Do not begin by copying old local files over upstream.
- First confirm that the chosen upstream target builds in isolation.

### Phase 3: Reapply Lynx layers in this order

Recommended order:

1. Protocol source changes
2. Protocol regeneration
3. Host/embedder bridge
4. Transport bridge
5. Product UI features
6. Packaging and release scripts

Why this order works:

- Protocol and host layers define the contract.
- UI and product features depend on those contracts.
- Packaging should be adapted last, after output shape stabilizes.

### Phase 4: Shrink fork surface while replaying

Do not blindly preserve every old patch.

Prefer these refactors while replaying:

- Move product-only behavior out of core DevTools code where possible.
- Keep protocol additions in a small, explicit patch set.
- Keep generated files derived from protocol source, not hand-maintained.
- Wrap host/plugin bridge behavior behind narrow helper APIs instead of
  scattering window message assumptions.

The long-term goal should be:

- small local protocol patch
- small local embedder bridge patch
- product UI mostly outside upstream core

### Phase 5: Validate against real Lynx workflows

Build success is not enough.

Minimum validation matrix:

- Frontend loads from the CLI static server.
- `plugins/devtool/main/index.ts` still resolves the correct frontend HTML.
- Session attach/detach works.
- Elements panel renders and node selection works.
- UI tree plugin sync works.
- Console output works.
- Sources panel works.
- Shared-context source cleanup works after `removeScriptsForLynxView`.
- Performance trace works with `Lynx.setTraceMode`.
- Screencast frames arrive and render.
- `LynxView` / fullscreen toggles still behave correctly.
- Preact Devtools panel still loads.
- Statistics and environment log uploads still work.
- Reattach/reconnect flows still work.

### Phase 6: Harden the upgrade path

After the first successful jump, add process so the next jump is cheaper.

Recommended hardening tasks:

- Maintain a patch inventory by category.
- Add a small "upstream import" playbook.
- Add automated smoke tests for:
  - frontend boot
  - attach session
  - elements selection
  - trace start/stop
  - screencast frame receive

## Upgrade Options And Tradeoffs

### Option A: Rebase directly onto a recent stable branch

Pros:

- Best long-term maintainability.
- One clear migration target.
- Makes future upgrades more repeatable.

Cons:

- Highest initial conflict volume.
- Requires good validation discipline.

Recommendation:

- Recommended.

### Option B: Two-hop migration

Example:

- old fork -> mid-era branch -> recent stable branch

Pros:

- Can reduce conflict density in each hop.

Cons:

- Duplicates merge and validation effort.
- Often slower overall.

Recommendation:

- Use only if a direct stable-branch rebase proves unmanageable.

### Option C: Stay on old fork and cherry-pick selected features

Pros:

- Lowest short-term disruption.

Cons:

- Worst long-term maintenance cost.
- Security, protocol, tooling, and panel drift keep compounding.
- Hard to reason about correctness when mixing old core with new feature slices.

Recommendation:

- Not recommended.

## Highest-Risk Files During The Upgrade

If merge capacity is limited, inspect these first:

- `packages/devtools-frontend-lynx/front_end/core/sdk/Connections.ts`
- `packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHost.ts`
- `packages/devtools-frontend-lynx/front_end/core/host/InspectorFrontendHostAPI.ts`
- `packages/devtools-frontend-lynx/front_end/devtools_compatibility.js`
- `packages/devtools-frontend-lynx/v8/include/js_protocol.pdl`
- `packages/devtools-frontend-lynx/front_end/generated/*`
- `packages/devtools-frontend-lynx/front_end/core/sdk/DebuggerModel.ts`
- `packages/devtools-frontend-lynx/front_end/core/sdk/TracingManager.ts`
- `packages/devtools-frontend-lynx/front_end/panels/screencast/ScreencastView.ts`
- `packages/devtools-frontend-lynx/front_end/core/sdk/sdk-meta.ts`
- `scripts/build-lynx-devtools.js`
- `plugins/devtool/renderer/devtool/index.tsx`

## Advice For Future AI Handoffs

When a future AI or engineer continues this work, start in this order:

1. Read this document.
2. Read root `package.json`.
3. Read `packages/devtools-frontend-lynx/DEPS` and `.gclient`.
4. Read `scripts/fetch-depot-tools.js` and `scripts/build-lynx-devtools.js`.
5. Read `plugins/devtool/main/index.ts`.
6. Read `plugins/devtool/renderer/devtool/index.tsx`.
7. Read `front_end/core/sdk/Connections.ts`.
8. Read protocol source and generated protocol files.

Working rules:

- Assume upstream DevTools is the source of truth.
- Avoid editing generated protocol files first.
- Rebuild/re-generate derived files whenever possible.
- Prefer adapting Lynx integration to upstream abstractions instead of copying
  old implementations forward unchanged.
- Update this document after each major milestone.

## External References

Official sources used during this analysis:

- Chrome 147 stable release notes:
  `https://developer.chrome.com/release-notes/147`
- DevTools frontend repository:
  `https://chromium.googlesource.com/devtools/devtools-frontend/`
- Example recent upstream `package.json` showing `scripts/run_build.mjs`:
  `https://chromium.googlesource.com/devtools/devtools-frontend/+/486e333e12805b53a9c38857c6ce4b082d0ad042/package.json`
- Example recent upstream Chromium milestone branch:
  `https://chromium.googlesource.com/devtools/devtools-frontend/+/refs/heads/chromium/7724`
- Historical DevTools update reference near the inferred current baseline:
  `https://developer.chrome.com/blog/new-in-devtools-92`
