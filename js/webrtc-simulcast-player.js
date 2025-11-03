/**
 * WebRTC Simulcast 播放器模块
 * 职责：封装 SRS Simulcast 连接流程、质量切换与自适应控制
 * 原则：
 * - 单一职责（SOLID-S）：聚焦播放与质量管理
 * - 开放封闭（SOLID-O）：通过配置扩展质量层与 ABR 策略
 * - 依赖倒置（SOLID-D）：对外暴露事件接口，依赖抽象统计数据
 *
 * 该实现基于方案A (SRS + Simulcast) 设计，可在不重连的前提下无缝切换 RID。
 */

// 简易事件发射器，确保浏览器环境无外部依赖
class SimpleEventEmitter {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!event || typeof callback !== 'function') {
            return;
        }
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (!this.listeners.has(event)) {
            return;
        }
        this.listeners.get(event).delete(callback);
        if (this.listeners.get(event).size === 0) {
            this.listeners.delete(event);
        }
    }

    emit(event, payload) {
        if (!this.listeners.has(event)) {
            return;
        }
        this.listeners.get(event).forEach(listener => {
            try {
                listener(payload);
            } catch (error) {
                console.error(`事件监听器执行失败: ${event}`, error);
            }
        });
    }

    removeAllListeners() {
        this.listeners.clear();
    }
}

class WebRTCSimulcastPlayer extends SimpleEventEmitter {
    constructor(videoElement, config = {}) {
        super();

        if (!videoElement) {
            throw new Error('WebRTCSimulcastPlayer 需要有效的视频元素');
        }

        const defaultLayers = {
            high: { rid: 'high', label: '1080p', minBandwidth: 4.0 },
            medium: { rid: 'medium', label: '720p', minBandwidth: 2.5 },
            low: { rid: 'low', label: '480p', minBandwidth: 1.0 }
        };

        this.videoElement = videoElement;
        this.config = {
            apiBaseUrl: config.apiBaseUrl || '',
            streamId: config.streamId || '',
            iceServers: config.iceServers || [
                { urls: 'stun:stun.l.google.com:19302' }
            ],
            qualityLayers: {
                ...defaultLayers,
                ...(config.qualityLayers || {})
            },
            abr: {
                intervalMs: 3000,
                switchCooldownMs: 5000,
                historySize: 8,
                ...(config.abr || {})
            }
        };

        if (!this.config.apiBaseUrl) {
            throw new Error('WebRTCSimulcastPlayer 缺少 apiBaseUrl 配置');
        }

        if (!this.config.streamId) {
            throw new Error('WebRTCSimulcastPlayer 缺少 streamId 配置');
        }

        this.peerConnection = null;
        this.videoTransceiver = null;
        this.currentRid = this.resolveRid(config.initialQuality || 'medium') || 'medium';
        this.isConnecting = false;
        this.isConnected = false;
        this.previousInboundStats = null;

        this.abrController = new SimulcastABRController(this, this.config.abr);
    }

    async connect(initialQuality) {
        if (this.isConnecting) {
            console.warn('Simulcast 播放器正在连接中，忽略重复请求');
            return;
        }

        if (this.peerConnection) {
            this.disconnect();
        }

        this.isConnecting = true;

        const targetRid = this.resolveRid(initialQuality) || this.currentRid || 'medium';
        this.currentRid = targetRid;

        this.emit('stateChange', { state: 'connecting', rid: targetRid });

        try {
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.config.iceServers
            });

            this.attachPeerConnectionEvents();

            // 启用 Simulcast 的视频 transceiver
            this.videoTransceiver = this.peerConnection.addTransceiver('video', {
                direction: 'recvonly',
                sendEncodings: this.buildEncodingPreferences(targetRid)
            });

            // 如果存在音频流，保持兼容
            this.peerConnection.addTransceiver('audio', {
                direction: 'recvonly'
            });

            const offer = await this.peerConnection.createOffer();
            const offerWithSimulcast = {
                type: 'offer',
                sdp: this.enableSimulcastInSDP(offer.sdp)
            };

            await this.peerConnection.setLocalDescription(offerWithSimulcast);

            const answer = await this.sendOfferToSRS(offerWithSimulcast.sdp);

            await this.peerConnection.setRemoteDescription({
                type: 'answer',
                sdp: answer.sdp
            });

            console.log('Simulcast 播放器连接成功');

        } catch (error) {
            console.error('Simulcast 连接失败:', error);
            this.emit('error', { message: '连接失败', error });
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    attachPeerConnectionEvents() {
        if (!this.peerConnection) {
            return;
        }

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.debug('ICE 候选:', event.candidate.candidate);
            }
        };

        this.peerConnection.ontrack = (event) => {
            if (!event.streams || event.streams.length === 0) {
                return;
            }

            console.log('接收到远端媒体流');
            this.videoElement.srcObject = event.streams[0];
            this.emit('track', event.streams[0]);
        };

        this.peerConnection.onconnectionstatechange = () => {
            const { connectionState } = this.peerConnection;
            console.log('PeerConnection 状态:', connectionState);

            if (connectionState === 'connected') {
                this.isConnected = true;
                this.emit('stateChange', { state: 'connected', rid: this.currentRid });
                this.startAdaptiveControl();
            } else if (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') {
                this.isConnected = false;
                this.emit('stateChange', { state: 'disconnected', rid: this.currentRid });
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.debug('ICE 连接状态:', this.peerConnection.iceConnectionState);
        };
    }

    buildEncodingPreferences(activeRid) {
        const layers = this.config.qualityLayers;
        return Object.keys(layers).map(key => ({
            rid: layers[key].rid,
            active: layers[key].rid === activeRid
        }));
    }

    enableSimulcastInSDP(sdp) {
        const lines = sdp.split('\r\n');
        const videoIndex = lines.findIndex(line => line.startsWith('m=video'));

        if (videoIndex !== -1) {
            const ridLines = ['a=rid:high recv', 'a=rid:medium recv', 'a=rid:low recv', 'a=simulcast:recv high;medium;low'];

            ridLines.reverse().forEach(ridLine => {
                if (!lines.includes(ridLine)) {
                    lines.splice(videoIndex + 1, 0, ridLine);
                }
            });
        }

        return lines.join('\r\n');
    }

    async sendOfferToSRS(sdp) {
        const base = this.config.apiBaseUrl.replace(/\/$/, '');
        const url = `${base}/rtc/v1/play/`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api: url,
                streamurl: this.config.streamId,
                sdp
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`SRS 返回异常: ${response.status} ${text}`);
        }

        const data = await response.json();

        if (data.code !== 0 || !data.sdp) {
            throw new Error(`SRS 响应错误: ${data.code ?? '未知错误'}`);
        }

        return data;
    }

    async switchQuality(targetQuality) {
        if (!this.peerConnection || !this.isConnected) {
            console.warn('尚未连接，无法切换质量');
            return;
        }

        const rid = this.resolveRid(targetQuality);
        if (!rid) {
            console.warn('无效的质量标识:', targetQuality);
            return;
        }

        if (rid === this.currentRid) {
            console.log('已处于目标质量，无需切换');
            return;
        }

        const videoSender = this.peerConnection.getSenders().find(sender => sender.track && sender.track.kind === 'video');

        if (!videoSender) {
            console.warn('未找到视频 sender，无法切换质量');
            return;
        }

        try {
            const parameters = videoSender.getParameters();
            if (!parameters.encodings || parameters.encodings.length === 0) {
                parameters.encodings = this.buildEncodingPreferences(rid);
            } else {
                parameters.encodings.forEach(encoding => {
                    encoding.active = encoding.rid === rid;
                });
            }

            await videoSender.setParameters(parameters);

            const oldRid = this.currentRid;
            this.currentRid = rid;

            this.emit('qualityChanged', {
                oldRid,
                newRid: rid,
                label: this.getQualityLabel(rid),
                timestamp: Date.now()
            });

            console.log(`Simulcast 质量切换成功: ${oldRid} -> ${rid}`);

        } catch (error) {
            console.error('Simulcast 质量切换失败:', error);
            this.emit('error', { message: '质量切换失败', error });
        }
    }

    startAdaptiveControl() {
        this.abrController.start();
    }

    stopAdaptiveControl() {
        this.abrController.stop();
    }

    async getStats() {
        if (!this.peerConnection) {
            return null;
        }

        const stats = await this.peerConnection.getStats();
        let inboundVideo = null;
        let videoTrack = null;

        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
                inboundVideo = report;
            } else if (report.type === 'track' && report.kind === 'video') {
                videoTrack = report;
            }
        });

        if (!inboundVideo) {
            return null;
        }

        const now = inboundVideo.timestamp;
        const bytesReceived = inboundVideo.bytesReceived || 0;
        let bitrateKbps = 0;

        if (this.previousInboundStats) {
            const bytesDelta = bytesReceived - this.previousInboundStats.bytesReceived;
            const timeDelta = (now - this.previousInboundStats.timestamp) / 1000; // ms -> s
            if (bytesDelta > 0 && timeDelta > 0) {
                bitrateKbps = (bytesDelta * 8) / 1000 / timeDelta;
            }
        }

        this.previousInboundStats = {
            timestamp: now,
            bytesReceived
        };

        const packetLoss = inboundVideo.packetsLost || 0;
        const packetsReceived = inboundVideo.packetsReceived || 1;
        const packetLossRate = packetLoss / (packetLoss + packetsReceived);

        const frameRate = videoTrack?.framesPerSecond || inboundVideo.framesPerSecond || 0;
        const resolution = {
            width: videoTrack?.frameWidth || inboundVideo.frameWidth || 0,
            height: videoTrack?.frameHeight || inboundVideo.frameHeight || 0
        };

        return {
            bandwidthMbps: bitrateKbps / 1000,
            bitrateKbps,
            packetLossRate: Number.isFinite(packetLossRate) ? packetLossRate : 0,
            jitterMs: (inboundVideo.jitter || 0) * 1000,
            frameRate,
            resolution,
            timestamp: Date.now()
        };
    }

    resolveRid(value) {
        if (!value) {
            return null;
        }

        const normalized = String(value).toLowerCase();

        if (this.config.qualityLayers[normalized]) {
            return this.config.qualityLayers[normalized].rid;
        }

        const matchByLabel = Object.values(this.config.qualityLayers).find(layer => {
            return layer.label.toLowerCase() === normalized || layer.rid === normalized;
        });

        if (matchByLabel) {
            return matchByLabel.rid;
        }

        if (normalized.includes('1080')) {
            return this.config.qualityLayers.high?.rid || 'high';
        }

        if (normalized.includes('720')) {
            return this.config.qualityLayers.medium?.rid || 'medium';
        }

        if (normalized.includes('480') || normalized.includes('low')) {
            return this.config.qualityLayers.low?.rid || 'low';
        }

        return null;
    }

    getQualityLabel(rid) {
        const layer = Object.values(this.config.qualityLayers).find(item => item.rid === rid);
        return layer ? layer.label : rid;
    }

    getPeerConnection() {
        return this.peerConnection;
    }

    disconnect() {
        this.stopAdaptiveControl();

        if (this.peerConnection) {
            this.peerConnection.getSenders().forEach(sender => {
                if (sender.track) {
                    sender.track.stop();
                }
            });

            this.peerConnection.getReceivers().forEach(receiver => {
                if (receiver.track) {
                    receiver.track.stop();
                }
            });

            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }

        this.isConnected = false;
        this.emit('stateChange', { state: 'disconnected', rid: this.currentRid });
    }

    destroy() {
        this.disconnect();
        this.removeAllListeners();
        this.previousInboundStats = null;
    }
}

class SimulcastABRController {
    constructor(player, options = {}) {
        this.player = player;
        this.options = {
            intervalMs: options.intervalMs || 3000,
            switchCooldownMs: options.switchCooldownMs || 5000,
            historySize: options.historySize || 8
        };

        this.timer = null;
        this.enabled = false;
        this.bandwidthHistory = [];
        this.lastSwitchTime = 0;
    }

    start() {
        if (this.enabled) {
            return;
        }
        this.enabled = true;

        if (!this.timer) {
            this.timer = setInterval(() => {
                this.tick();
            }, this.options.intervalMs);
        }
    }

    stop() {
        this.enabled = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.bandwidthHistory = [];
    }

    async tick() {
        if (!this.enabled) {
            return;
        }

        try {
            const stats = await this.player.getStats();
            if (!stats) {
                return;
            }

            const bandwidth = Number.isFinite(stats.bandwidthMbps) ? stats.bandwidthMbps : 0;
            const loss = Number.isFinite(stats.packetLossRate) ? stats.packetLossRate : 0;

            this.bandwidthHistory.push(bandwidth);
            if (this.bandwidthHistory.length > this.options.historySize) {
                this.bandwidthHistory.shift();
            }

            const avgBandwidth = this.bandwidthHistory.reduce((sum, value) => sum + value, 0) / this.bandwidthHistory.length;
            const targetRid = this.decideQuality(avgBandwidth, loss);

            if (!targetRid || targetRid === this.player.currentRid) {
                return;
            }

            const now = Date.now();
            if (now - this.lastSwitchTime < this.options.switchCooldownMs) {
                return;
            }

            await this.player.switchQuality(targetRid);
            this.lastSwitchTime = now;

        } catch (error) {
            console.error('Simulcast ABR 检查失败:', error);
        }
    }

    decideQuality(bandwidthMbps, packetLossRate) {
        if (packetLossRate > 0.05) {
            return 'low';
        }

        if (bandwidthMbps >= 4.0 && packetLossRate < 0.01) {
            return 'high';
        }

        if (bandwidthMbps >= 2.5 && packetLossRate < 0.02) {
            return 'medium';
        }

        return 'low';
    }
}

if (typeof window !== 'undefined') {
    window.WebRTCSimulcastPlayer = WebRTCSimulcastPlayer;
    window.SimulcastABRController = SimulcastABRController;
}
