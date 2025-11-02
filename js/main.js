/**
 * 主控制模块
 * 职责：整合各模块、处理 UI 交互、更新界面显示
 * 原则：
 * - 单一职责（SOLID-S）：只负责协调和 UI 更新
 * - 依赖倒置（SOLID-D）：通过事件系统解耦模块间依赖
 */
class Application {
    constructor() {
        // DOM 元素
        this.elements = {
            // 视频元素
            videoPlayer: document.getElementById('videoPlayer'),
            // 状态指示器
            connectionStatus: document.getElementById('connectionStatus'),
            // 按钮
            btnConnect: document.getElementById('btnConnect'),
            btnDisconnect: document.getElementById('btnDisconnect'),
            btnAuto: document.getElementById('btnAuto'),
            btn1080p: document.getElementById('btn1080p'),
            btn720p: document.getElementById('btn720p'),
            btn480p: document.getElementById('btn480p'),
            btnClearLog: document.getElementById('btnClearLog'),
            // 显示元素
            qualityBadge: document.getElementById('qualityBadge'),
            loadingSpinner: document.getElementById('loadingSpinner'),
            // 网络信息
            networkType: document.getElementById('networkType'),
            bandwidth: document.getElementById('bandwidth'),
            rtt: document.getElementById('rtt'),
            downlink: document.getElementById('downlink'),
            networkLevel: document.getElementById('networkLevel'),
            // WebRTC 统计
            videoBitrate: document.getElementById('videoBitrate'),
            videoFps: document.getElementById('videoFps'),
            resolution: document.getElementById('resolution'),
            packetLoss: document.getElementById('packetLoss'),
            jitter: document.getElementById('jitter'),
            framesReceived: document.getElementById('framesReceived'),
            streamStatus: document.getElementById('streamStatus'),
            // 日志容器
            logContainer: document.getElementById('logContainer')
        };

        // 核心模块
        this.networkMonitor = null;
        this.player = null;
        this.statsCollector = null;
        this.adaptiveController = null;

        // 状态
        this.isAutoMode = true;
        this.isConnected = false;

        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        console.log('应用初始化...');

        // 初始化网络监测
        this.networkMonitor = new NetworkMonitor();

        // 初始化 WebRTC 播放器（HTTP 版本）
        this.player = new WebRTCPlayerHTTP(this.elements.videoPlayer, {
            // HTTP 信令 API 基础 URL
            apiBaseUrl: 'https://glythgb.xmrbi.com/index/api/webrtc',
            // 流参数配置
            streamApp: 'live',
            streamPrefix: 'stream/wrj/pri/8UUXN4R00A06RS_165-0-7',
            streamType: 'play',
            // 质量后缀模板（根据你的服务器配置修改）
            // 例如: '_${quality}' 表示流名称变为 8UUXN4R00A06RS_165-0-7_1080p
            //      '-${quality}' 表示流名称变为 8UUXN4R00A06RS_165-0-7-1080p
            //      '' (空字符串) 表示所有质量使用同一个流
            // 【重要】你的服务器使用同一个流提供所有分辨率，因此使用空字符串
            qualitySuffix: '',
            // 配置 ICE 服务器
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        // 绑定事件监听
        this.bindEvents();

        // 启动网络监测
        this.startNetworkMonitoring();

        console.log('应用初始化完成');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 连接按钮
        this.elements.btnConnect.addEventListener('click', () => {
            this.handleConnect();
        });

        // 断开按钮
        this.elements.btnDisconnect.addEventListener('click', () => {
            this.handleDisconnect();
        });

        // 质量选择按钮
        this.elements.btnAuto.addEventListener('click', () => {
            this.handleQualitySelect('auto');
        });

        this.elements.btn1080p.addEventListener('click', () => {
            this.handleQualitySelect('1080p');
        });

        this.elements.btn720p.addEventListener('click', () => {
            this.handleQualitySelect('720p');
        });

        this.elements.btn480p.addEventListener('click', () => {
            this.handleQualitySelect('480p');
        });

        // 清空日志按钮
        this.elements.btnClearLog.addEventListener('click', () => {
            this.clearLog();
        });

        // 播放器状态变化
        this.player.on('stateChange', (event) => {
            this.handlePlayerStateChange(event);
        });

        // 播放器错误
        this.player.on('error', (event) => {
            this.handlePlayerError(event);
        });

        // 播放器统计就绪
        this.player.on('statsReady', (peerConnection) => {
            this.handleStatsReady(peerConnection);
        });
    }

    /**
     * 启动网络监测
     */
    startNetworkMonitoring() {
        this.networkMonitor.addListener((data) => {
            this.updateNetworkUI(data);
        });
    }

    /**
     * 处理连接
     */
    async handleConnect() {
        if (this.isConnected) {
            return;
        }

        try {
            this.showLoading(true);
            this.updateConnectionStatus('connecting');

            // 获取推荐质量
            const recommendedQuality = this.networkMonitor.recommendQuality();
            console.log(`推荐质量: ${recommendedQuality}`);

            // 连接播放器
            await this.player.connect(recommendedQuality);

            this.isConnected = true;
            this.updateButtons(true);
            this.addLog(`连接成功 (${recommendedQuality})`, 'success');

        } catch (error) {
            console.error('连接失败:', error);
            this.updateConnectionStatus('error');
            this.addLog('连接失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 处理断开连接
     */
    handleDisconnect() {
        if (!this.isConnected) {
            return;
        }

        // 停止自适应控制
        if (this.adaptiveController) {
            this.adaptiveController.stop();
            this.adaptiveController.destroy();
            this.adaptiveController = null;
        }

        // 停止统计采集
        if (this.statsCollector) {
            this.statsCollector.stop();
            this.statsCollector.destroy();
            this.statsCollector = null;
        }

        // 断开播放器
        this.player.disconnect();

        this.isConnected = false;
        this.updateButtons(false);
        this.updateConnectionStatus('disconnected');
        this.addLog('已断开连接', 'info');
    }

    /**
     * 处理质量选择
     * @param {string} quality - 质量档位或 'auto'
     */
    async handleQualitySelect(quality) {
        if (!this.isConnected) {
            alert('请先连接播放器');
            return;
        }

        // 更新按钮状态
        this.updateQualityButtons(quality);

        if (quality === 'auto') {
            // 启用自动模式
            this.isAutoMode = true;
            if (this.adaptiveController) {
                this.adaptiveController.enableAutoSwitch();
            }
            this.addLog('切换到自动模式', 'info');
        } else {
            // 手动切换模式
            this.isAutoMode = false;
            if (this.adaptiveController) {
                await this.adaptiveController.manualSwitch(quality);
            }
        }
    }

    /**
     * 处理播放器状态变化
     * @param {Object} event - 状态事件
     */
    handlePlayerStateChange(event) {
        const { state, quality } = event;

        switch (state) {
            case 'connecting':
                this.updateConnectionStatus('connecting');
                break;
            case 'connected':
                this.updateConnectionStatus('connected');
                this.updateQualityBadge(quality);
                break;
            case 'disconnected':
                this.updateConnectionStatus('disconnected');
                break;
            case 'error':
                this.updateConnectionStatus('error');
                break;
        }
    }

    /**
     * 处理播放器错误
     * @param {Object} event - 错误事件
     */
    handlePlayerError(event) {
        console.error('播放器错误:', event);
        this.addLog(`错误: ${event.message}`, 'error');
        alert(`播放器错误: ${event.message}`);
    }

    /**
     * 处理统计就绪
     * @param {RTCPeerConnection} peerConnection - PeerConnection 实例
     */
    handleStatsReady(peerConnection) {
        console.log('统计采集就绪');

        // 创建统计采集器
        this.statsCollector = new WebRTCStatsCollector(peerConnection, 1000);
        this.statsCollector.addListener((data) => {
            this.updateWebRTCUI(data);
        });
        this.statsCollector.start();

        // 创建自适应控制器
        this.adaptiveController = new AdaptiveController(
            this.player,
            this.networkMonitor,
            this.statsCollector
        );

        this.adaptiveController.addListener((event) => {
            this.handleAdaptiveEvent(event);
        });

        // 启动自适应控制
        const currentQuality = this.player.getCurrentQuality();
        this.adaptiveController.start(currentQuality);
    }

    /**
     * 处理自适应事件
     * @param {Object} event - 事件对象
     */
    handleAdaptiveEvent(event) {
        if (event.type === 'switched') {
            this.updateQualityBadge(event.newQuality);
            this.addLog(
                `${event.oldQuality} → ${event.newQuality} (${event.reason})`,
                'switch'
            );
        }
    }

    /**
     * 更新网络 UI
     * @param {Object} data - 网络数据
     */
    updateNetworkUI(data) {
        const { networkInfo, quality } = data;

        // 更新网络类型
        this.elements.networkType.textContent = networkInfo.effectiveType.toUpperCase();

        // 更新带宽
        this.elements.bandwidth.textContent = `${networkInfo.downlink.toFixed(1)} Mbps`;

        // 更新 RTT
        this.elements.rtt.textContent = `${networkInfo.rtt} ms`;

        // 更新下行速度
        this.elements.downlink.textContent = `${networkInfo.downlink.toFixed(2)} Mbps`;

        // 更新网络等级
        const levelText = {
            'excellent': '优秀',
            'good': '良好',
            'fair': '一般',
            'poor': '较差'
        };
        this.elements.networkLevel.textContent = levelText[quality.level] || '未知';
        this.elements.networkLevel.className = `network-level ${quality.level}`;
    }

    /**
     * 更新 WebRTC UI
     * @param {Object} data - WebRTC 数据
     */
    updateWebRTCUI(data) {
        const { stats, quality } = data;

        // 更新视频码率
        this.elements.videoBitrate.textContent = `${stats.videoBitrate} kbps`;

        // 更新帧率
        this.elements.videoFps.textContent = `${stats.videoFps} fps`;

        // 更新分辨率
        this.elements.resolution.textContent =
            `${stats.resolution.width}x${stats.resolution.height}`;

        // 更新丢包率
        this.elements.packetLoss.textContent = `${stats.packetLossRate}%`;

        // 更新抖动
        this.elements.jitter.textContent = `${stats.jitter} ms`;

        // 更新已接收帧数
        this.elements.framesReceived.textContent = stats.framesReceived;

        // 更新流状态
        const statusText = {
            'excellent': '优秀',
            'good': '良好',
            'fair': '一般',
            'poor': '较差'
        };
        this.elements.streamStatus.textContent = statusText[quality.status] || '正常';
        this.elements.streamStatus.className = `status-tag status-${
            quality.status === 'excellent' || quality.status === 'good' ? 'success' :
            quality.status === 'fair' ? 'warning' : 'error'
        }`;
    }

    /**
     * 更新连接状态
     * @param {string} status - 状态
     */
    updateConnectionStatus(status) {
        const statusMap = {
            'disconnected': { text: '未连接', class: '' },
            'connecting': { text: '连接中...', class: 'connecting' },
            'connected': { text: '已连接', class: 'connected' },
            'error': { text: '连接失败', class: 'error' }
        };

        const config = statusMap[status] || statusMap.disconnected;
        this.elements.connectionStatus.className = `status-indicator ${config.class}`;
        this.elements.connectionStatus.querySelector('.status-text').textContent = config.text;
    }

    /**
     * 更新质量徽章
     * @param {string} quality - 质量档位
     */
    updateQualityBadge(quality) {
        this.elements.qualityBadge.textContent = this.isAutoMode ? `自动 (${quality})` : quality;
    }

    /**
     * 更新按钮状态
     * @param {boolean} isConnected - 是否已连接
     */
    updateButtons(isConnected) {
        this.elements.btnConnect.style.display = isConnected ? 'none' : 'inline-flex';
        this.elements.btnDisconnect.style.display = isConnected ? 'inline-flex' : 'none';
    }

    /**
     * 更新质量选择按钮
     * @param {string} selectedQuality - 选中的质量
     */
    updateQualityButtons(selectedQuality) {
        const buttons = [
            { btn: this.elements.btnAuto, quality: 'auto' },
            { btn: this.elements.btn1080p, quality: '1080p' },
            { btn: this.elements.btn720p, quality: '720p' },
            { btn: this.elements.btn480p, quality: '480p' }
        ];

        buttons.forEach(({ btn, quality }) => {
            if (quality === selectedQuality) {
                btn.className = 'btn btn-secondary';
            } else {
                btn.className = 'btn btn-default';
            }
        });
    }

    /**
     * 显示/隐藏加载动画
     * @param {boolean} show - 是否显示
     */
    showLoading(show) {
        this.elements.loadingSpinner.style.display = show ? 'flex' : 'none';
    }

    /**
     * 添加日志
     * @param {string} message - 日志消息
     * @param {string} type - 日志类型
     */
    addLog(message, type = 'info') {
        // 移除空提示
        const emptyDiv = this.elements.logContainer.querySelector('.log-empty');
        if (emptyDiv) {
            emptyDiv.remove();
        }

        const logItem = document.createElement('div');
        logItem.className = 'log-item';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = new Date().toLocaleTimeString('zh-CN');

        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = message;

        logItem.appendChild(timeSpan);
        logItem.appendChild(messageSpan);

        // 插入到顶部
        this.elements.logContainer.insertBefore(logItem, this.elements.logContainer.firstChild);

        // 限制日志数量
        const logs = this.elements.logContainer.querySelectorAll('.log-item');
        if (logs.length > 20) {
            logs[logs.length - 1].remove();
        }
    }

    /**
     * 清空日志
     */
    clearLog() {
        this.elements.logContainer.innerHTML = '<div class="log-empty">暂无切换记录</div>';
        if (this.adaptiveController) {
            this.adaptiveController.clearSwitchHistory();
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new Application();
        console.log('应用启动成功');
    } catch (error) {
        console.error('应用启动失败:', error);
        alert('应用启动失败，请刷新页面重试');
    }
});
