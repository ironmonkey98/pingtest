# JavaScript 模块文档

**导航**: [← 返回项目根目录](../CLAUDE.md) / js模块

## 📁 模块架构

本目录包含所有JavaScript模块，采用ES6类和模块化设计：

```
js/
├── main.js                     # 🎯 主控制器（入口模块）
├── network-monitor.js          # 🌐 网络监测模块
├── webrtc-player-http.js       # 📡 HTTP信令WebRTC播放器（主要）
├── webrtc-player.js            # 📡 WebSocket信令播放器（备用）
├── stats-collector.js          # 📊 WebRTC统计采集器
└── adaptive-controller.js      # 🤖 自适应控制器
```

## 🎯 主控制器 (main.js)

### 职责
- 整合所有模块
- 处理UI交互事件
- 更新界面显示
- 协调模块间通信

### 关键接口
```javascript
class Application {
    constructor()                    // 初始化应用
    init()                          // 初始化各模块
    handleConnect()                 // 处理连接请求
    handleDisconnect()              // 处理断开请求
    handleQualitySelect(quality)    // 处理质量选择
}
```

### 依赖关系
- ✅ NetworkMonitor: 网络状态监测
- ✅ WebRTCPlayerHTTP: 视频播放
- ✅ StatsCollector: 统计数据采集
- ✅ AdaptiveController: 自适应控制

### 配置要点
```javascript
// 第68-84行：WebRTC播放器配置
this.player = new WebRTCPlayerHTTP(this.elements.videoPlayer, {
    apiBaseUrl: 'https://glythgb.xmrbi.com/index/api/webrtc',
    streamApp: 'live',
    streamPrefix: 'stream/wrj/pri/8UUXN4R00A06RS_165-0-7',
    streamType: 'play',
    qualitySuffix: '',  // 🔑 关键：空字符串适配单流架构
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});
```

## 🌐 网络监测模块 (network-monitor.js)

### 职责
- 检测网络类型和有效带宽
- 测量网络延迟(RTT)
- 评估网络质量等级
- 推荐合适的播放质量

### 关键接口
```javascript
class NetworkMonitor {
    getNetworkInfo()                // 获取当前网络信息
    evaluateNetworkQuality()        // 评估网络质量
    recommendQuality()              // 推荐播放质量
    addListener(callback)           // 添加状态变化监听器
}
```

### 质量评估算法
```javascript
// 质量等级映射
const qualityMap = {
    'slow-2g': 'poor',    // 较差
    '2g': 'poor',         // 较差  
    '3g': 'fair',         // 一般
    '4g': 'good',         // 良好
    'wifi': 'excellent'   // 优秀
};
```

### 降级兼容性
- ✅ Chrome/Edge: 完全支持Network Information API
- ⚠️ Firefox/Safari: 自动降级使用默认值

## 📡 WebRTC播放器 (webrtc-player-http.js)

### 职责
- 管理WebRTC PeerConnection
- 处理HTTP信令交互
- 支持多质量码流切换
- 维护连接状态

### 关键接口
```javascript
class WebRTCPlayerHTTP {
    connect(quality)                // 连接指定质量的流
    switchQuality(newQuality)       // 切换到新质量
    disconnect()                    // 断开连接
    getCurrentQuality()             // 获取当前质量
    getStreamId(quality)            // 生成流ID
    on(event, callback)             // 事件监听
}
```

### HTTP信令协议
```javascript
// POST请求格式
const url = `${apiBaseUrl}?app=${app}&stream=${streamId}&type=${type}`;
const headers = { 'Content-Type': 'application/sdp' };
const body = offer.sdp;

// 期望响应
{ 
    code: 0,
    sdp: "v=0\r\no=..." 
}
```

### 流ID生成规则
```javascript
// 当前配置：qualitySuffix = ''
getStreamId(quality) {
    // 结果：stream/wrj/pri/8UUXN4R00A06RS_165-0-7（所有质量相同）
    return this.config.streamPrefix + this.config.qualitySuffix.replace('${quality}', quality);
}
```

## 📊 统计采集器 (stats-collector.js)

### 职责
- 定期采集WebRTC统计数据
- 计算码率、帧率、丢包率等指标
- 评估播放质量状态
- 提供性能监控数据

### 关键接口
```javascript
class WebRTCStatsCollector {
    start()                         // 开始采集
    stop()                          // 停止采集
    getLatestStats()                // 获取最新统计
    addListener(callback)           // 添加数据监听器
}
```

### 采集指标
```javascript
const stats = {
    videoBitrate: 0,        // 视频码率 (kbps)
    videoFps: 0,            // 视频帧率 (fps)
    resolution: {           // 分辨率
        width: 0, 
        height: 0
    },
    packetLossRate: 0,      // 丢包率 (%)
    jitter: 0,              // 抖动 (ms)
    framesReceived: 0       // 接收帧数
};
```

### 质量评估标准
```javascript
const qualityThresholds = {
    excellent: { minBitrate: 2000, maxPacketLoss: 1, maxJitter: 30 },
    good: { minBitrate: 1000, maxPacketLoss: 2, maxJitter: 50 },
    fair: { minBitrate: 500, maxPacketLoss: 5, maxJitter: 100 },
    poor: { minBitrate: 0, maxPacketLoss: 100, maxJitter: 1000 }
};
```

## 🤖 自适应控制器 (adaptive-controller.js)

### 职责
- 整合网络和WebRTC统计数据
- 实施自适应切换策略
- 管理切换冷却和历史记录
- 支持手动和自动模式

### 关键接口
```javascript
class AdaptiveController {
    start(initialQuality)           // 启动自适应控制
    stop()                          // 停止控制
    enableAutoSwitch()              // 启用自动切换
    manualSwitch(quality)           // 手动切换
    addListener(callback)           // 添加事件监听器
}
```

### 切换策略算法
```javascript
// 综合评分计算
function calculateQualityScore(networkQuality, webrtcQuality) {
    return {
        network: networkQuality.score,    // 网络评分
        webrtc: webrtcQuality.score,      // WebRTC评分
        combined: (networkQuality.score + webrtcQuality.score) / 2
    };
}

// 切换决策
function shouldSwitch(currentQuality, targetQuality, scores) {
    // 降级：连续3次质量不佳
    // 升级：连续5次质量良好
    // 冷却时间：10秒内不重复切换
}
```

### 配置参数
```javascript
const defaultOptions = {
    switchCooldown: 10000,      // 切换冷却时间(ms)
    checkInterval: 3000,        // 检查间隔(ms)
    qualityLevels: ['1080p', '720p', '480p'],
    qualityThresholds: {
        '1080p': { minBandwidth: 3.0, maxRTT: 100, maxPacketLoss: 2 },
        '720p': { minBandwidth: 1.5, maxRTT: 150, maxPacketLoss: 3 },
        '480p': { minBandwidth: 0.8, maxRTT: 250, maxPacketLoss: 5 }
    }
};
```

## 📡 WebSocket播放器 (webrtc-player.js) - 备用

### 状态
⚠️ **备用模块** - 当前使用HTTP信令版本

### 用途
- WebSocket信令协议支持
- 实时双向通信
- ICE候选实时交换

### 何时使用
- 服务器支持WebSocket信令时
- 需要实时信令交互时
- HTTP信令不可用时

## 🔄 模块间通信

### 事件系统架构
```javascript
// 播放器状态事件
player.on('stateChange', (event) => {
    // event: { state, quality }
});

// 网络状态变化
networkMonitor.addListener((data) => {
    // data: { networkInfo, quality }
});

// 统计数据更新
statsCollector.addListener((data) => {
    // data: { stats, quality }
});

// 自适应切换事件
adaptiveController.addListener((event) => {
    // event: { type: 'switched', oldQuality, newQuality, reason }
});
```

## 🛠️ 调试和测试

### 浏览器控制台调试
```javascript
// 访问全局应用实例
const app = window.app;

// 检查模块状态
console.log('网络信息:', app.networkMonitor.getNetworkInfo());
console.log('播放器状态:', app.player.isConnected);
console.log('统计数据:', app.statsCollector?.getLatestStats());

// 手动触发操作
app.handleConnect();                    // 手动连接
app.handleQualitySelect('720p');        // 手动切换质量
```

### 性能监控
```javascript
// 监控性能指标
setInterval(() => {
    const stats = app.statsCollector?.getLatestStats();
    if (stats) {
        console.log(`码率: ${stats.videoBitrate}kbps, 帧率: ${stats.videoFps}fps, 丢包: ${stats.packetLossRate}%`);
    }
}, 5000);
```

## ⚠️ 已知问题

### 1. 单流架构限制
- **问题**: 服务器使用单流，手动切换无效
- **影响**: 所有质量按钮指向同一流
- **解决**: 使用 `qualitySuffix: ''` 配置

### 2. Network API兼容性
- **问题**: Safari/Firefox部分支持
- **影响**: 网络检测可能不准确
- **解决**: 自动降级到默认参数

### 3. ICE连接失败
- **问题**: 内网环境可能需要TURN服务器
- **解决**: 配置自定义TURN服务器

## 🔧 配置修改指南

### 更换流媒体服务器
```javascript
// 修改 main.js 第68-84行
const config = {
    apiBaseUrl: 'https://your-server.com/api/webrtc',
    streamPrefix: 'your-stream-id',
    qualitySuffix: '_${quality}',  // 根据服务器调整
};
```

### 调整自适应策略
```javascript
// 修改 main.js 第253行
const adaptiveConfig = {
    switchCooldown: 5000,    // 更快切换
    checkInterval: 2000,     // 更频繁检查
    qualityThresholds: {     // 调整阈值
        '1080p': { minBandwidth: 4.0, maxRTT: 80 }
    }
};
```

---

**模块总数**: 6个  
**核心模块**: 5个  
**备用模块**: 1个  
**最后更新**: 2025-11-02T09:59:05.000Z