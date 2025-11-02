# 无人机 WebRTC 自适应码流播放器

这是一个基于 WebRTC 的自适应码流播放器，能够根据网络状况自动切换 1080p、720p、480p 三种不同分辨率的视频流。

## 🎯 核心功能

- ✅ **网络质量监测**：实时监测网络类型、带宽、延迟等指标
- ✅ **WebRTC 统计采集**：采集视频码率、帧率、丢包率、抖动等数据
- ✅ **自适应码流切换**：根据网络和播放质量自动切换分辨率
- ✅ **手动切换模式**：支持手动选择指定分辨率
- ✅ **实时监控面板**：可视化展示所有关键指标
- ✅ **切换历史记录**：记录每次码流切换的时间和原因

## 📦 项目结构

```
pingtest/
├── index.html                 # 主页面
├── css/
│   └── style.css             # 样式文件（遵循 UI 设计系统）
├── js/
│   ├── network-monitor.js     # 网络监测模块
│   ├── webrtc-player.js       # WebRTC 播放器模块
│   ├── stats-collector.js     # 统计采集模块
│   ├── adaptive-controller.js # 自适应控制器
│   └── main.js               # 主控制逻辑
└── README.md                 # 本文档
```

## 🚀 快速开始

### 1. 配置信令服务器

打开 `js/main.js`，找到第 72-82 行，修改配置：

```javascript
this.player = new WebRTCPlayer(this.elements.videoPlayer, {
    // 【重要】修改为你的信令服务器地址
    signalingUrl: 'ws://your-server.com:8080/signal',

    // 【重要】修改流 ID 模板（${quality} 会被替换为 1080p/720p/480p）
    streamUrlTemplate: 'drone_${quality}',

    // ICE 服务器配置（可选，默认使用 Google STUN）
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
});
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

### 3. 使用播放器

1. 打开浏览器访问页面
2. 点击"开始播放"按钮
3. 系统会自动根据当前网络推荐合适的分辨率
4. 连接成功后，可以看到实时的网络和码流统计
5. 可以手动切换分辨率，或保持自动模式

## 🔌 信令服务器接口

你的信令服务器需要支持以下 WebSocket 消息格式：

### 客户端 → 服务器

#### 1. Offer（播放请求）
```json
{
  "type": "offer",
  "sdp": "v=0\r\no=...",
  "streamId": "drone_1080p"
}
```

#### 2. ICE Candidate
```json
{
  "type": "candidate",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  }
}
```

### 服务器 → 客户端

#### 1. Answer（应答）
```json
{
  "type": "answer",
  "sdp": "v=0\r\no=..."
}
```

#### 2. ICE Candidate
```json
{
  "type": "candidate",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  }
}
```

#### 3. Error（错误）
```json
{
  "type": "error",
  "message": "流不存在或无法连接"
}
```

## ⚙️ 高级配置

### 自适应策略调整

在 `js/main.js` 第 253 行，可以调整自适应控制器的参数：

```javascript
this.adaptiveController = new AdaptiveController(
    this.player,
    this.networkMonitor,
    this.statsCollector,
    {
        // 是否启用自动切换
        autoSwitch: true,

        // 切换冷却时间（毫秒）- 避免频繁切换
        switchCooldown: 10000,

        // 检查间隔（毫秒）
        checkInterval: 3000,

        // 质量档位定义
        qualityLevels: ['1080p', '720p', '480p'],

        // 质量要求阈值
        qualityThresholds: {
            '1080p': {
                minBandwidth: 3.0,    // 最小带宽 3Mbps
                maxRTT: 100,          // 最大延迟 100ms
                maxPacketLoss: 2      // 最大丢包率 2%
            },
            '720p': {
                minBandwidth: 1.5,    // 最小带宽 1.5Mbps
                maxRTT: 150,          // 最大延迟 150ms
                maxPacketLoss: 3      // 最大丢包率 3%
            },
            '480p': {
                minBandwidth: 0.8,    // 最小带宽 0.8Mbps
                maxRTT: 250,          // 最大延迟 250ms
                maxPacketLoss: 5      // 最大丢包率 5%
            }
        }
    }
);
```

### 统计采集频率调整

在 `js/main.js` 第 243 行，可以修改统计采集间隔：

```javascript
// 第二个参数是采集间隔（毫秒），默认 1000ms
this.statsCollector = new WebRTCStatsCollector(peerConnection, 1000);
```

## 🏗️ 架构设计

本项目严格遵循 SOLID 原则和工程最佳实践：

### 模块职责（单一职责原则）

| 模块 | 职责 | 文件 |
|------|------|------|
| **网络监测** | 监测网络类型、带宽、RTT | `network-monitor.js` |
| **WebRTC 播放器** | 管理 WebRTC 连接、信令交互 | `webrtc-player.js` |
| **统计采集** | 采集 WebRTC 统计数据 | `stats-collector.js` |
| **自适应控制** | 决策码流切换策略 | `adaptive-controller.js` |
| **主控制器** | 协调各模块、更新 UI | `main.js` |

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

### 1. 信令服务器连接失败

**原因**：信令服务器地址未配置或无法访问

**解决**：
- 检查 `js/main.js` 中的 `signalingUrl` 配置
- 确保信令服务器正常运行
- 检查浏览器控制台的错误信息

### 2. Network Information API 不可用

**原因**：浏览器不支持该 API

**解决**：系统会自动降级，使用默认值。建议使用 Chrome 或 Edge 浏览器以获得完整功能。

### 3. 视频无法播放

**原因**：
- WebRTC 连接失败
- 流不存在
- ICE 候选交换失败

**解决**：
- 检查浏览器控制台的详细错误日志
- 确认流媒体服务器已推送三路流（1080p/720p/480p）
- 检查 STUN/TURN 服务器配置

### 4. 自动切换不生效

**原因**：
- 自动模式未启用
- 在切换冷却期内

**解决**：
- 点击"自动"按钮启用自动模式
- 等待冷却时间结束（默认 10 秒）
- 检查控制台是否有错误日志

## 📝 开发日志

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
