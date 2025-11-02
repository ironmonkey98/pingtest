# WebRTC 播放器配置指南

## 🎯 适配你的流媒体服务器

本播放器已适配基于 **HTTP POST** 的 WebRTC 信令协议（类似 WHIP）。

---

## 📝 配置步骤

### 1. 确认你的流地址格式

你当前的流地址示例：
```
https://glythgb.xmrbi.com/index/api/webrtc?app=live&stream=stream/wrj/pri/8UUXN4R00A06RS_165-0-7&type=play
```

**URL 结构分析：**
- **基础 URL**: `https://glythgb.xmrbi.com/index/api/webrtc`
- **参数**:
  - `app=live` - 应用名称
  - `stream=stream/wrj/pri/8UUXN4R00A06RS_165-0-7` - 流标识
  - `type=play` - 操作类型（播放）

### 2. 确定不同分辨率的流命名规则

你需要确认服务器上三路流的命名方式，常见格式有：

#### 方案 A：下划线后缀（推荐）
```
1080p: stream/wrj/pri/8UUXN4R00A06RS_165-0-7_1080p
720p:  stream/wrj/pri/8UUXN4R00A06RS_165-0-7_720p
480p:  stream/wrj/pri/8UUXN4R00A06RS_165-0-7_480p
```
**配置**: `qualitySuffix: '_${quality}'`

#### 方案 B：连字符后缀
```
1080p: stream/wrj/pri/8UUXN4R00A06RS_165-0-7-1080p
720p:  stream/wrj/pri/8UUXN4R00A06RS_165-0-7-720p
480p:  stream/wrj/pri/8UUXN4R00A06RS_165-0-7-480p
```
**配置**: `qualitySuffix: '-${quality}'`

#### 方案 C：不同的流 ID
```
1080p: stream/wrj/pri/8UUXN4R00A06RS_165-0-7/1080p
720p:  stream/wrj/pri/8UUXN4R00A06RS_165-0-7/720p
480p:  stream/wrj/pri/8UUXN4R00A06RS_165-0-7/480p
```
**配置**: `qualitySuffix: '/${quality}'`

#### 方案 D：所有质量使用同一个流（服务器端自适应）
```
所有质量: stream/wrj/pri/8UUXN4R00A06RS_165-0-7
```
**配置**: `qualitySuffix: ''` （空字符串）

---

## ⚙️ 修改配置文件

打开 `js/main.js` 文件，找到第 68-84 行，修改配置：

```javascript
this.player = new WebRTCPlayerHTTP(this.elements.videoPlayer, {
    // 【必填】HTTP 信令 API 基础 URL
    apiBaseUrl: 'https://glythgb.xmrbi.com/index/api/webrtc',

    // 【必填】流参数配置
    streamApp: 'live',  // app 参数值

    // 【必填】流前缀（不包含质量后缀）
    streamPrefix: 'stream/wrj/pri/8UUXN4R00A06RS_165-0-7',

    streamType: 'play',  // type 参数值

    // 【重要】质量后缀模板（根据你的服务器配置修改）
    // 选择上面方案 A/B/C/D 对应的配置
    qualitySuffix: '_${quality}',  // 这里使用方案 A

    // 【可选】ICE 服务器配置
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
});
```

---

## 🧪 测试配置

### 测试 1：验证流地址

使用浏览器开发者工具验证生成的 URL 是否正确：

```javascript
// 打开浏览器控制台，运行：
const player = window.app.player;

// 查看不同质量的流 ID
console.log('1080p 流:', player.getStreamId('1080p'));
console.log('720p 流:', player.getStreamId('720p'));
console.log('480p 流:', player.getStreamId('480p'));
```

**期望输出（方案 A）：**
```
1080p 流: stream/wrj/pri/8UUXN4R00A06RS_165-0-7_1080p
720p 流: stream/wrj/pri/8UUXN4R00A06RS_165-0-7_720p
480p 流: stream/wrj/pri/8UUXN4R00A06RS_165-0-7_480p
```

### 测试 2：手动测试 HTTP 请求

使用 `curl` 或 Postman 测试 API：

```bash
# 测试 720p 流
curl -X POST \
  'https://glythgb.xmrbi.com/index/api/webrtc?app=live&stream=stream/wrj/pri/8UUXN4R00A06RS_165-0-7_720p&type=play' \
  -H 'Content-Type: application/sdp' \
  -d 'v=0
o=- 123456789 1 IN IP4 127.0.0.1
s=WebRTC Session
t=0 0
...'
```

**期望响应：**
- 状态码：200
- Content-Type：`application/sdp` 或 `application/json`
- 包含 Answer SDP

---

## 🔍 常见问题排查

### 问题 1：连接失败，控制台显示 "webrtc offer sdp is empty"

**原因**：Offer SDP 未正确发送

**解决**：
1. 检查浏览器是否支持 WebRTC（Chrome/Edge 79+）
2. 检查 HTTPS 证书是否有效
3. 打开开发者工具 > Network，查看 HTTP POST 请求的 Request Payload

### 问题 2：视频无法播放，连接状态一直是 "connecting"

**原因**：
- 流不存在或未推送
- ICE 连接失败
- STUN 服务器不可达

**解决**：
1. 确认流媒体服务器已推送三路流
2. 检查 ICE 连接状态：
   ```javascript
   window.app.player.peerConnection.iceConnectionState
   ```
3. 如果是内网环境，可能需要配置 TURN 服务器

### 问题 3：只能播放一个质量的流，切换无效

**原因**：`qualitySuffix` 配置错误，所有质量都指向同一个流

**解决**：
1. 确认服务器上存在不同分辨率的流
2. 修改 `qualitySuffix` 配置
3. 重新加载页面并测试

### 问题 4：自动切换不生效

**原因**：
- 冷却时间未到（默认 10 秒）
- 网络质量评估未达到切换阈值

**解决**：
1. 检查浏览器控制台是否有切换日志
2. 查看"切换记录"面板
3. 调整 `adaptive-controller.js` 中的阈值参数

---

## 📊 验证网络监测功能

### 检查 Network Information API 是否可用

```javascript
// 浏览器控制台运行：
navigator.connection || navigator.mozConnection || navigator.webkitConnection
```

**如果返回 `undefined`**：
- Firefox/Safari：部分支持，系统会使用降级方案
- Chrome/Edge：完全支持

### 手动触发网络检测

```javascript
// 获取当前网络信息
const networkInfo = window.app.networkMonitor.getNetworkInfo();
console.log('网络信息:', networkInfo);

// 获取网络质量评估
const quality = window.app.networkMonitor.evaluateNetworkQuality();
console.log('网络质量:', quality);

// 获取推荐质量
const recommended = window.app.networkMonitor.recommendQuality();
console.log('推荐质量:', recommended);
```

---

## 🎬 完整使用流程

1. **启动 Web 服务器**
   ```bash
   cd /Users/hongye/Desktop/pingtest
   python3 -m http.server 8001
   ```

2. **打开浏览器访问**
   ```
   http://localhost:8001/index.html
   ```

3. **查看网络状态**
   - 页面加载后，左侧"网络状态"卡片会实时显示网络信息
   - 网络等级会自动评估（优秀/良好/一般/较差）

4. **开始播放**
   - 点击"开始播放"按钮
   - 系统会根据当前网络推荐合适的分辨率
   - 等待连接建立（通常 2-3 秒）

5. **观察自适应切换**
   - 系统会每 3 秒检查一次网络和播放质量
   - 如果质量不佳，会自动降级（需连续 3 次检测不佳）
   - 如果网络恢复，会自动升级（需连续 5 次检测良好）
   - 切换记录会显示在"切换记录"面板

6. **手动切换**
   - 点击"1080P/720P/480P"按钮可手动切换
   - 手动切换后，自动模式会暂停 5 秒
   - 5 秒后恢复自动切换（如果"自动"按钮未禁用）

---

## 🔧 高级配置

### 调整自适应策略

编辑 `js/main.js` 第 253 行，修改自适应控制器参数：

```javascript
this.adaptiveController = new AdaptiveController(
    this.player,
    this.networkMonitor,
    this.statsCollector,
    {
        // 切换冷却时间（毫秒）
        switchCooldown: 10000,  // 建议 5000-15000

        // 检查间隔（毫秒）
        checkInterval: 3000,    // 建议 2000-5000

        // 质量要求阈值
        qualityThresholds: {
            '1080p': {
                minBandwidth: 3.0,   // 最小带宽 (Mbps)
                maxRTT: 100,         // 最大延迟 (ms)
                maxPacketLoss: 2     // 最大丢包率 (%)
            },
            '720p': {
                minBandwidth: 1.5,
                maxRTT: 150,
                maxPacketLoss: 3
            },
            '480p': {
                minBandwidth: 0.8,
                maxRTT: 250,
                maxPacketLoss: 5
            }
        }
    }
);
```

### 添加自定义 TURN 服务器（内网环境）

如果在内网环境使用，可能需要配置 TURN 服务器：

```javascript
iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
        urls: 'turn:your-turn-server.com:3478',
        username: 'your-username',
        credential: 'your-password'
    }
]
```

---

## 📞 技术支持

如果遇到问题，请提供以下信息：

1. **浏览器版本**：在控制台运行 `navigator.userAgent`
2. **错误日志**：完整的浏览器控制台日志
3. **网络请求**：开发者工具 > Network 中的 WebRTC API 请求详情
4. **流地址**：你配置的完整流地址（去除敏感信息）

---

## 🎉 配置完成检查清单

- [ ] 确认 `apiBaseUrl` 正确
- [ ] 确认 `streamPrefix` 与实际流 ID 匹配
- [ ] 确认 `qualitySuffix` 符合服务器命名规则
- [ ] 测试过浏览器控制台中的流 ID 生成
- [ ] 成功播放至少一个质量的流
- [ ] 验证手动切换功能
- [ ] 观察到自动切换行为

完成所有步骤后，系统应该可以正常工作了！🚀
