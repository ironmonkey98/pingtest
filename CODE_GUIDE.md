# 代码说明与集成指引（HTTP/WHIP 与多视图主视图增强版）

本文件面向有经验的工程师，概述“多宫格方案”的项目结构、配置要点、事件流、以及如何嵌入到既有系统。同时给出下一步可实现的增量特性与落地建议。

---

## 1. 总览
- 本项目以“多视图监控（多宫格）”为唯一入口：`index.html + js/multi-view-app.js + js/multi-view-manager.js`
- 播放内核可拔插：
  - HTTP/WHIP 风格（默认）：`js/webrtc-player-http.js`
  - SRS Simulcast（可选）：`js/webrtc-simulcast-player.js`
- 配合统计与网络模块：
  - WebRTC 统计：`js/stats-collector.js`
  - 多流聚合：`js/multi-stream-stats.js`
  - 网络监测：`js/network-monitor.js`
- 智能画质控制：`js/smart-quality-controller.js`（提供批量/单流建议、主视图优先策略）
- UI 与交互：`css/style.css`（内置设计系统变量与控件样式）

架构遵循 SOLID/KISS/DRY/YAGNI：模块职责单一、通过事件解耦，对外暴露统一接口与配置点。

---

## 2. 运行与依赖
- 纯前端静态资源，无需构建即可运行。建议通过本地 HTTP 服务器打开以避免浏览器安全限制：

```bash
python3 -m http.server 8000
# 访问 http://localhost:8000
```

- 入口页面：`index.html`（多宫格）

---

## 3. 播放器配置（HTTP/WHIP）
- 默认使用 HTTP/WHIP 播放器（见下“多视图配置”）。

- 多视图（js/multi-view-app.js）默认 provider=HTTP，`MultiViewManager` 将按 `provider` 选择 HTTP/Simulcast 内核：

```js
streamConfig: { provider: 'http' },
playerConfig: {
  http: {
    apiBaseUrl: 'https://glythgb.xmrbi.com/index/api/webrtc',
    streamApp: 'live',
    streamPrefix: 'stream/wrj/pri/8UUXN4E00A05CU_165-0-7',
    streamType: 'play',
    qualitySuffix: ''
  }
}
```

- 若服务端按画质后缀区分流名（例如 `-1080p/-720p/-480p`），可将 `qualitySuffix` 设置为 `'-${quality}'`。

---

## 4. 模块职责
- WebRTCPlayerHTTP：完成 HTTP/WHIP SDP 交换，触发 `stateChange` 与 `statsReady(peerConnection)`。
- WebRTCSimulcastPlayer：连接 SRS，支持不重连切换 `rid`，可选 `start/stopAdaptiveControl`。
- WebRTCStatsCollector：从 `RTCPeerConnection` 周期采集码率/帧率/丢包/抖动/分辨率等。
- MultiStreamStatsCollector：聚合多路统计，输出 `aggregated`、`network`、`recommendations`；支持 `updateStreamMetadata` 更新优先级等元数据。
- SmartQualityController：结合网络与聚合统计生成画质建议，支持主视图优先（`setPrimaryIndex`）。
- MultiViewManager：管理布局/视图/播放器实例，新增“⭐ 设为主视图”（触发 `primaryChange`）。
- MultiViewApplication：应用编排、UI 交互、建议弹窗与自动化执行。

---

## 5. 事件与数据流（简述）
1) 播放连接（HTTP/WHIP）
- UI → `WebRTCPlayerHTTP.connect(quality)` → `stateChange: connecting`
- `statsReady(peerConnection)` → `WebRTCStatsCollector.start()` → 数据回推 UI 与聚合器
- `stateChange: connected` → UI“已连接”

2) 多视图（provider 决定内核）
- `MultiViewManager.connectView(i)` → 构造播放器（HTTP/Simulcast）→ 同上事件流
- `WebRTCStatsCollector` → `MultiStreamStatsCollector.addStream(id, collector, metadata)`
- `MultiStreamStatsCollector` → 定时 `statsUpdate` / `networkChange` / `recommendation`

3) 主视图（⭐）
- 点击 ⭐ → `MultiViewManager.setPrimaryView(i)` → 更新 UI 高亮、更新流元数据 `priority=high`、发出 `primaryChange`
- `MultiViewApplication.handlePrimaryChange` → `SmartQualityController.setPrimaryIndex(i)`

---

## 6. UI 要点
- 视图卡片：连接/断开、质量下拉（自动/1080P/720P/480P）、⭐ 主视图；叠层展示码率/帧率/分辨率/丢包。
- 悬浮统计面板：总带宽、活跃流、推荐布局、网络质量。
- 智能建议弹窗：按照“立即/渐进/备选”分组呈现，支持手动/自动应用。

---

## 7. Playwright MCP 回归要点（多宫格）
- 切到四宫格 → 点击第 3 个视图 ⭐ → 验证 `.primary`、日志“主视图切换：#1 → #3”、控制器主索引=2 → 切回单视图，回退为索引 0。

---

## 8. 下一步可实现的功能（按价值优先）
1) 质量后缀与流名映射
- 将 UI 档位（1080P/720P/480P）映射到服务端真实流名（如 `-hd/-sd/-ld`）。
- 提供 `qualityMap` 配置，优先于通用 `qualitySuffix`。

2) 多视图多前缀支持
- 为每个视图配置独立 `streamPrefix[]`（或回调 `getStreamByIndex(i)`），规避同流多连限制。

3) Programmatic Mount API（建议）
- 提供 `createMultiViewApp({ mount, provider, http/simulcast, initialLayout })` 与 `destroy()`，用代码生成所需 DOM，降低集成成本。

4) 状态持久化
- 使用 `localStorage` 记忆：布局、主视图索引、自动优化开关、质量选择。

5) 异常与重连策略
- 指数退避重连、服务端错误码分类、用户提示与灰度降级（仅保留主视图等）。

6) 权限与鉴权
- 支持在 HTTP POST 中注入 `Authorization`/Token，或在 `app/stream` 中拼接签名参数。

7) TURN/ICE 配置下沉
- 从配置中心/环境变量下发 `iceServers`（含 TURN 凭据），并动态热更新。

8) 外部事件总线
- 暴露 `on(event, handler)` 给宿主应用：如 `layoutChange`、`primaryChange`、`recommendation`、`error`；并支持 `off` 与一次性监听。

9) 主题定制
- 以 CSS 变量为入口提供主题切换与品牌化能力文档（已具雏形，可完善示例）。

---

## 9. 在既有系统中的嵌入方式
以下给出三种可选集成路径，按工程投入递增排序。

### 方式 A：DOM 片段直嵌（最快落地）
- 将 `index.html` 中的“多视图播放区域 + 控制面板 + 监控面板 + 弹窗”片段拷贝到你的页面容器中（保持元素 `id` 不变）。
- 在页面底部引入以下脚本（顺序重要）：

```html
<link rel="stylesheet" href="/css/style.css" />
<script src="/js/network-monitor.js"></script>
<script src="/js/webrtc-player-http.js"></script>
<script src="/js/stats-collector.js"></script>
<!-- 可选 Simulcast 内核：需要时引入 -->
<script src="/js/webrtc-simulcast-player.js"></script>
<script src="/js/multi-view-manager.js"></script>
<script src="/js/multi-stream-stats.js"></script>
<script src="/js/smart-quality-controller.js"></script>
<script src="/js/multi-view-app.js"></script>
```

- 如需覆盖默认流配置，修改 `js/multi-view-app.js` 中 `playerConfig.http` 与 `streamConfig.provider`。
- 优点：0 改造；缺点：与宿主 DOM 有一定耦合（依赖固定 id）。

### 方式 B：Programmatic Mount（推荐，下一步实现项 3）
- 新增工厂函数（建议后续提交）：

```js
// 目标API示例（计划实现）
import { createMultiViewApp } from '/js/entry-multi-view.js';

const app = createMultiViewApp({
  mount: '#container',
  initialLayout: 'grid4',
  provider: 'http',
  http: {
    apiBaseUrl: 'https://glythgb.xmrbi.com/index/api/webrtc',
    streamApp: 'live',
    streamPrefix: 'stream/wrj/pri/8UUXN4E00A05CU_165-0-7',
    streamType: 'play',
    qualitySuffix: ''
  },
  on: {
    primaryChange: ({ previousIndex, newIndex }) => console.log('primary', previousIndex, newIndex)
  }
});

// 卸载
app.destroy();
```

- 优点：宿主仅提供一个容器，完全由代码生成所需 DOM，API 清晰；缺点：需要一次性补齐该入口实现。

### 方式 C：微前端 / Web Component 包装
- 将多视图能力打包成自定义元素 `<webrtc-multiview ...props />`，对外仅暴露属性与事件。
- 或以 iframe 微前端形式集成，采用 postMessage 通信；优点是隔离度高，缺点是样式/通信开销更大。

---

## 10. 稳定性与安全建议
- 建议启用 TURN（在复杂网络/NAT 下极其重要），并通过配置中心下发。
- 为 HTTP/WHIP 接口增加鉴权（Token/签名/Referer 限制），避免滥用。
- 注意跨域：若部署位置不同域名，需要服务端允许相应 CORS/SDP 请求策略。
- 若需 CSP，请列出允许的 `connect-src` 到推拉流域名与 STUN/TURN。

---

## 11. 现状与已知限制
- 多视图“连接”时，若服务端限制同流并发拉取，建议使用“多前缀”或按质量区分独立流名；相关能力在“下一步（2）”中规划。
- Simulcast ABR 仅对 `WebRTCSimulcastPlayer` 有效；HTTP/WHIP 播放器无 ABR（可通过多流策略与全局建议模拟）。

---

## 12. 变更摘要（本轮）
- 新增主视图（⭐）选择与联动：UI 高亮、统计优先级、智能策略同步。
- 默认切换为 HTTP/WHIP 播放（使用你提供的流地址），多视图与单视图均已适配。
- 统一质量与统计读取：兼容 `currentRid` 与 `getCurrentQuality()`，降低内核差异。

---

## 13. 你可以立刻做什么？（动作清单）
- 验证你的服务端是否区分质量流名：若区分，请提供 1080p/720p/480p 的真实映射，我将落地“质量后缀与流名映射（下一步 1）”。
- 若需同时观看多路：提供每路设备/编码通道对应的 `streamPrefix` 列表，我将落地“多视图多前缀（下一步 2）”。
- 若你希望“代码插拔式嵌入”：确认是否采用“方式 B Programmatic Mount”，我将补齐该入口文件与 API（下一步 3）。

---

如需我先实现“Programmatic Mount API”与“质量映射”，请告知你期望的参数与流命名规范（例如 `-1080p/-720p/-480p` 或映射表）。
