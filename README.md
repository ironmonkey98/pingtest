# 多视图 WebRTC 播放与监控（HTTP/WHIP 默认）

本项目提供多宫格（1/4/9）实时监控方案，内置网络监测、WebRTC 统计聚合、智能画质建议与“主视图（⭐）优先”策略。默认使用 HTTP/WHIP 信令播放器，可选 SRS Simulcast 内核。

## 🎯 核心功能

- ✅ 多宫格布局：单视图/四宫格/九宫格快速切换
- ✅ 主视图（⭐）：一键设为主视图，高亮显示且优先保证画质
- ✅ 网络与统计：聚合多路码率/帧率/丢包/抖动，总带宽与推荐布局
- ✅ 智能建议：紧急降级/保守优化/质量提升/平衡优化，可手动或自动应用
- ✅ 双内核：HTTP/WHIP（默认）；SRS Simulcast（可选）

## 📦 项目结构

```
.
├── index.html                 # 多视图主页面（多宫格方案）
├── css/
│   └── style.css              # 样式（设计系统）
├── js/
│   ├── network-monitor.js     # 网络监测
│   ├── webrtc-player-http.js  # HTTP/WHIP 播放器（默认）
│   ├── webrtc-simulcast-player.js # 可选 Simulcast 播放器
│   ├── stats-collector.js     # WebRTC 统计采集
│   ├── multi-stream-stats.js  # 多流统计聚合与建议
│   ├── smart-quality-controller.js # 智能画质控制
│   ├── multi-view-manager.js  # 多视图管理与主视图(⭐)
│   └── multi-view-app.js      # 应用编排与 UI 交互
├── CODE_GUIDE.md              # 代码说明与集成指引
└── README.md                  # 本文档
```

> 📁 **关于 `_archive/` 目录**：存放开发过程中的历史文档、实验性功能和临时文件，详见 `_archive/README.md`。该目录已加入 `.gitignore`，不会提交到版本库。

## 🚀 快速开始

### 1. 配置（HTTP/WHIP）

修改 `js/multi-view-app.js` 中 `playerConfig.http`：

```js
playerConfig: {
  http: {
    apiBaseUrl: 'https://glythgb.xmrbi.com/index/api/webrtc',
    streamApp: 'live',
    streamPrefix: 'stream/wrj/pri/8UUXN4E00A05CU_165-0-7',
    streamType: 'play',
    qualitySuffix: '' // 服务端未区分画质流名时留空
  }
},
streamConfig: { provider: 'http' }
```

### 2. 启动 Web 服务器

由于浏览器安全限制，需要通过 HTTP 服务器访问。可以使用以下任一方式：

**方式 1：Python 简易服务器**
```bash
# Python 3
cd /Users/hongye/Desktop/pingtest
python3 -m http.server 8000

# 访问 http://localhost:8000
```

**方式 2：Node.js http-server**
```bash
npm install -g http-server
cd /Users/hongye/Desktop/pingtest
http-server -p 8000

# 访问 http://localhost:8000
```

**方式 3：VS Code Live Server**
- 安装 Live Server 扩展
- 右键 `index.html` → "Open with Live Server"

### 3. 使用多视图

1. 访问首页（index.html）
2. 选择布局（单视图/四宫格/九宫格）
3. 点击各视图“连接”开始播放；可点击“⭐”设为主视图
4. 查看“多流统计/智能建议/切换记录”，按需手动或自动应用建议

## 🔌 HTTP/WHIP 接口说明（摘要）

通过 `POST ${apiBaseUrl}?app=${app}&stream=${streamPrefix}${qualitySuffix}&type=${type}` 提交 SDP Offer（Content-Type: application/sdp），返回 Answer（SDP 文本或 JSON 包含 sdp 字段）。

## ⚙️ 高级配置

### 策略与主视图
- 智能建议由 `js/smart-quality-controller.js` 负责，可按布局与主视图调整优先级与建议强度。

### 统计采集频率
- `js/stats-collector.js` 中构造时的第二个参数为采集间隔（默认 1000ms）。

## 🏗️ 架构设计与原则

### 模块职责（单一职责原则）

| 模块 | 职责 | 文件 |
|------|------|------|
| **网络监测** | 监测网络类型、带宽、RTT | `network-monitor.js` |
| **HTTP 播放器** | HTTP/WHIP SDP 交换 | `webrtc-player-http.js` |
| **Simulcast 播放器** | SRS + RID 切换 | `webrtc-simulcast-player.js` |
| **统计采集** | 采集 WebRTC 统计数据 | `stats-collector.js` |
| **多流聚合** | 聚合/建议/网络评估 | `multi-stream-stats.js` |
| **智能控制** | 建议与策略 | `smart-quality-controller.js` |
| **多视图管理** | 视图/连接/主视图⭐ | `multi-view-manager.js` |
| **应用编排** | UI/事件/弹窗 | `multi-view-app.js` |

### 设计原则应用

- ✅ **KISS（简单至上）**：每个模块功能单一、代码清晰
- ✅ **YAGNI（精益求精）**：仅实现当前明确需求，无过度设计
- ✅ **SOLID**：
  - 单一职责：每个类只负责一个功能
  - 开放封闭：可通过配置扩展，无需修改核心代码
  - 依赖倒置：模块间通过事件系统解耦
- ✅ **DRY（杜绝重复）**：统一的事件系统、配置管理

## 🎨 UI 设计系统

本项目严格遵循统一的 UI 设计系统，所有颜色、字体、间距均使用 CSS 变量定义。

详细规范见 `css/style.css` 文件开头的变量定义区域。

## 🔧 浏览器兼容性

| 浏览器 | 最低版本 | Network API | WebRTC |
|--------|----------|-------------|--------|
| Chrome | 79+ | ✅ 完全支持 | ✅ 完全支持 |
| Edge | 79+ | ✅ 完全支持 | ✅ 完全支持 |
| Firefox | 68+ | ⚠️ 部分支持 | ✅ 完全支持 |
| Safari | 14+ | ⚠️ 部分支持 | ✅ 完全支持 |

**注意**：Network Information API 在 Safari 和 Firefox 上支持有限，系统会自动降级使用备选方案。

## 📊 监控指标说明

### 网络状态指标

- **网络类型**：当前网络的有效类型（4G/3G/2G 等）
- **有效带宽**：估计的下行带宽（Mbps）
- **往返延迟（RTT）**：网络往返时间（毫秒）
- **下行速度**：当前下行速度（Mbps）

### 码流统计指标

- **视频码率**：当前视频的实时码率（kbps）
- **视频帧率**：每秒接收的视频帧数（fps）
- **分辨率**：当前视频的宽x高（像素）
- **丢包率**：数据包丢失的百分比（%）
- **抖动（Jitter）**：数据包到达时间的波动（毫秒）
- **已接收帧数**：累计接收的视频帧总数

## 🐛 常见问题

### 1. HTTP/WHIP 接口连接失败

**原因**：接口不可达、参数错误或 CORS 限制

**解决**：
- 检查 `js/multi-view-app.js` 中 `playerConfig.http` 的 `apiBaseUrl/app/streamPrefix/type`
- 确认服务端允许 `POST application/sdp` 且返回 Answer（文本或 JSON.sdp）
- 检查浏览器控制台错误与网络面板请求/响应

### 2. Network Information API 不可用

**现象**：Safari/Firefox 对该 API 支持有限

**解决**：系统自动降级，仍可使用；建议 Chrome/Edge 以获得完整功能

### 3. 多视图无法全部连接

**原因**：服务端限制同一路流并发拉取

**解决**：
- 为每个视图提供独立 `streamPrefix[]` 或开启“质量映射”指向不同流
- 仅连接主视图与少量辅视图，降低带宽与连接数

### 4. 智能建议未自动应用

**原因**：未开启“自动优化”或建议置信度不足

**解决**：
- 点击“🤖 自动优化”开启；或在弹窗中手动“应用建议”
- 可在 `smart-quality-controller.js` 调整置信度阈值

## 📝 开发日志（摘要）

- ✅ 完成网络监测模块（Network Information API）
- ✅ 完成 WebRTC 播放器模块（PeerConnection 管理）
- ✅ 完成统计采集模块（getStats API）
- ✅ 完成自适应控制器（切换策略）
- ✅ 完成 UI 界面（遵循设计系统）
- ✅ 完成主控制逻辑（模块整合）

## 🔮 未来优化方向

1. **历史数据图表**：添加实时数据曲线图（可选 Chart.js）
2. **带宽探测**：增加主动带宽测试功能
3. **预测模型**：基于历史数据预测网络趋势
4. **多源切换**：支持多个备用流媒体源

## 📄 许可证

MIT License

## 💬 技术支持

如有问题，请查看浏览器控制台的日志信息，或联系开发团队。
