/**
 * WebRTC 统计信息采集模块
 * 职责：定期采集 WebRTC 连接的统计数据
 * 原则：单一职责（SOLID-S）- 只负责统计数据采集
 */
class WebRTCStatsCollector {
    constructor(peerConnection, interval = 1000) {
        this.peerConnection = peerConnection;
        this.interval = interval;
        this.stats = {
            videoBitrate: 0,
            audioBitrate: 0,
            videoFps: 0,
            resolution: { width: 0, height: 0 },
            packetsLost: 0,
            packetsReceived: 0,
            packetLossRate: 0,
            jitter: 0,
            framesReceived: 0,
            framesDropped: 0,
            timestamp: Date.now()
        };
        this.previousStats = null;
        this.intervalId = null;
        this.listeners = [];

        console.log('统计采集器初始化完成');
    }

    /**
     * 开始采集统计信息
     */
    start() {
        if (this.intervalId) {
            console.warn('统计采集已经在运行中');
            return;
        }

        console.log('开始采集统计信息...');
        this.intervalId = setInterval(() => {
            this.collect();
        }, this.interval);

        // 立即采集一次
        this.collect();
    }

    /**
     * 停止采集统计信息
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('统计采集已停止');
        }
    }

    /**
     * 采集统计信息
     */
    async collect() {
        if (!this.peerConnection) {
            return;
        }

        try {
            const stats = await this.peerConnection.getStats();
            this.parseStats(stats);
            this.notifyListeners();
        } catch (error) {
            console.error('采集统计信息失败:', error);
        }
    }

    /**
     * 解析统计信息
     * @param {RTCStatsReport} statsReport - WebRTC 统计报告
     */
    parseStats(statsReport) {
        const currentTimestamp = Date.now();
        const timeDelta = (currentTimestamp - this.stats.timestamp) / 1000; // 转换为秒

        let inboundVideoStats = null;
        let inboundAudioStats = null;

        statsReport.forEach((report) => {
            // 查找入站视频流统计
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
                inboundVideoStats = report;
            }

            // 查找入站音频流统计
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                inboundAudioStats = report;
            }
        });

        // 解析视频统计
        if (inboundVideoStats) {
            this.parseVideoStats(inboundVideoStats, timeDelta);
        }

        // 解析音频统计
        if (inboundAudioStats) {
            this.parseAudioStats(inboundAudioStats, timeDelta);
        }

        // 更新时间戳
        this.stats.timestamp = currentTimestamp;
    }

    /**
     * 解析视频统计
     * @param {Object} report - 视频统计报告
     * @param {number} timeDelta - 时间增量（秒）
     */
    parseVideoStats(report, timeDelta) {
        // 计算视频码率（比特率）
        if (this.previousStats && this.previousStats.videoBytesReceived !== undefined && timeDelta > 0) {
            const bytesReceived = report.bytesReceived || 0;
            const bytesDelta = bytesReceived - this.previousStats.videoBytesReceived;
            this.stats.videoBitrate = Math.round((bytesDelta * 8) / timeDelta / 1000); // kbps
        }

        // 计算帧率
        if (this.previousStats && this.previousStats.videoFramesReceived !== undefined && timeDelta > 0) {
            const framesReceived = report.framesReceived || 0;
            const framesDelta = framesReceived - this.previousStats.videoFramesReceived;
            this.stats.videoFps = Math.round(framesDelta / timeDelta);
        }

        // 分辨率
        this.stats.resolution = {
            width: report.frameWidth || 0,
            height: report.frameHeight || 0
        };

        // 丢包统计
        const packetsLost = report.packetsLost || 0;
        const packetsReceived = report.packetsReceived || 0;
        this.stats.packetsLost = packetsLost;
        this.stats.packetsReceived = packetsReceived;

        // 丢包率（百分比）
        const totalPackets = packetsLost + packetsReceived;
        this.stats.packetLossRate = totalPackets > 0
            ? ((packetsLost / totalPackets) * 100).toFixed(2)
            : 0;

        // 抖动
        this.stats.jitter = Math.round((report.jitter || 0) * 1000); // 转换为毫秒

        // 帧数统计
        this.stats.framesReceived = report.framesReceived || 0;
        this.stats.framesDropped = report.framesDropped || 0;

        // 保存当前值用于下次计算
        if (!this.previousStats) {
            this.previousStats = {};
        }
        this.previousStats.videoBytesReceived = report.bytesReceived || 0;
        this.previousStats.videoFramesReceived = report.framesReceived || 0;
    }

    /**
     * 解析音频统计
     * @param {Object} report - 音频统计报告
     * @param {number} timeDelta - 时间增量（秒）
     */
    parseAudioStats(report, timeDelta) {
        // 计算音频码率
        if (this.previousStats && this.previousStats.audioBytesReceived !== undefined && timeDelta > 0) {
            const bytesReceived = report.bytesReceived || 0;
            const bytesDelta = bytesReceived - this.previousStats.audioBytesReceived;
            this.stats.audioBitrate = Math.round((bytesDelta * 8) / timeDelta / 1000); // kbps
        }

        // 保存当前值用于下次计算
        if (!this.previousStats) {
            this.previousStats = {};
        }
        this.previousStats.audioBytesReceived = report.bytesReceived || 0;
    }

    /**
     * 获取当前统计信息
     * @returns {Object} 统计信息对象
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * 评估码流质量
     * @returns {Object} { status: string, score: number, issues: Array }
     */
    evaluateQuality() {
        let score = 100;
        let status = 'normal';
        let issues = [];

        // 评估丢包率
        if (this.stats.packetLossRate > 5) {
            score -= 40;
            issues.push('丢包率过高');
        } else if (this.stats.packetLossRate > 2) {
            score -= 20;
            issues.push('存在丢包');
        }

        // 评估抖动
        if (this.stats.jitter > 100) {
            score -= 30;
            issues.push('网络抖动严重');
        } else if (this.stats.jitter > 50) {
            score -= 15;
            issues.push('网络抖动较大');
        }

        // 评估帧率
        if (this.stats.videoFps < 15) {
            score -= 25;
            issues.push('帧率过低');
        } else if (this.stats.videoFps < 24) {
            score -= 10;
            issues.push('帧率偏低');
        }

        // 评估掉帧
        const dropRate = this.stats.framesReceived > 0
            ? (this.stats.framesDropped / this.stats.framesReceived) * 100
            : 0;
        if (dropRate > 5) {
            score -= 20;
            issues.push('掉帧严重');
        }

        // 确定状态
        if (score >= 80) {
            status = 'excellent';
        } else if (score >= 60) {
            status = 'good';
        } else if (score >= 40) {
            status = 'fair';
        } else {
            status = 'poor';
        }

        return {
            status,
            score: Math.max(0, score),
            issues
        };
    }

    /**
     * 添加监听器
     * @param {Function} callback - 回调函数
     */
    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    /**
     * 移除监听器
     * @param {Function} callback - 回调函数
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    /**
     * 通知所有监听器
     */
    notifyListeners() {
        const stats = this.getStats();
        const quality = this.evaluateQuality();

        this.listeners.forEach(listener => {
            try {
                listener({ stats, quality });
            } catch (error) {
                console.error('通知监听器时出错:', error);
            }
        });
    }

    /**
     * 销毁实例
     */
    destroy() {
        this.stop();
        this.listeners = [];
        this.peerConnection = null;
        this.previousStats = null;
    }
}

// 导出为全局变量
if (typeof window !== 'undefined') {
    window.WebRTCStatsCollector = WebRTCStatsCollector;
}
