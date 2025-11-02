/**
 * 自适应码流切换控制器
 * 职责：整合网络监测和 WebRTC 统计，决策码流切换
 * 原则：
 * - 单一职责（SOLID-S）：只负责切换决策
 * - 开放封闭（SOLID-O）：策略可扩展
 * - 依赖倒置（SOLID-D）：依赖抽象接口而非具体实现
 */
class AdaptiveController {
    constructor(player, networkMonitor, statsCollector, options = {}) {
        this.player = player;
        this.networkMonitor = networkMonitor;
        this.statsCollector = statsCollector;

        // 配置选项
        this.options = {
            // 是否启用自动切换
            autoSwitch: true,
            // 切换冷却时间（毫秒）
            switchCooldown: 10000,
            // 检查间隔（毫秒）
            checkInterval: 3000,
            // 质量档位定义
            qualityLevels: ['1080p', '720p', '480p'],
            // 质量要求阈值
            qualityThresholds: {
                '1080p': { minBandwidth: 3.0, maxRTT: 100, maxPacketLoss: 2 },
                '720p': { minBandwidth: 1.5, maxRTT: 150, maxPacketLoss: 3 },
                '480p': { minBandwidth: 0.8, maxRTT: 250, maxPacketLoss: 5 }
            },
            ...options
        };

        this.currentQuality = null;
        this.lastSwitchTime = 0;
        this.checkIntervalId = null;
        this.switchHistory = [];
        this.listeners = [];

        // 连续不良计数器（用于避免频繁切换）
        this.poorQualityCount = 0;
        this.goodQualityCount = 0;

        console.log('自适应控制器初始化完成', this.options);
    }

    /**
     * 启动自适应控制
     * @param {string} initialQuality - 初始质量档位
     */
    start(initialQuality = '720p') {
        if (this.checkIntervalId) {
            console.warn('自适应控制已经在运行中');
            return;
        }

        this.currentQuality = initialQuality;
        console.log(`自适应控制启动，初始质量: ${initialQuality}`);

        // 启动定期检查
        this.checkIntervalId = setInterval(() => {
            if (this.options.autoSwitch) {
                this.checkAndSwitch();
            }
        }, this.options.checkInterval);
    }

    /**
     * 停止自适应控制
     */
    stop() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = null;
            console.log('自适应控制已停止');
        }
    }

    /**
     * 启用自动切换
     */
    enableAutoSwitch() {
        this.options.autoSwitch = true;
        console.log('自动切换已启用');
    }

    /**
     * 禁用自动切换
     */
    disableAutoSwitch() {
        this.options.autoSwitch = false;
        console.log('自动切换已禁用');
    }

    /**
     * 检查并决定是否切换
     */
    async checkAndSwitch() {
        // 检查冷却时间
        const now = Date.now();
        if (now - this.lastSwitchTime < this.options.switchCooldown) {
            return;
        }

        try {
            // 获取当前网络和码流数据
            const networkInfo = this.networkMonitor.getNetworkInfo();
            const networkQuality = this.networkMonitor.evaluateNetworkQuality();
            const webrtcStats = this.statsCollector.getStats();
            const streamQuality = this.statsCollector.evaluateQuality();

            // 决策新质量
            const recommendedQuality = this.decideQuality(networkInfo, networkQuality, webrtcStats, streamQuality);

            // 如果推荐质量与当前不同，则切换
            if (recommendedQuality !== this.currentQuality) {
                await this.switchTo(recommendedQuality, '自动切换');
            }

        } catch (error) {
            console.error('检查切换时出错:', error);
        }
    }

    /**
     * 决策合适的质量档位
     * @param {Object} networkInfo - 网络信息
     * @param {Object} networkQuality - 网络质量评估
     * @param {Object} webrtcStats - WebRTC 统计
     * @param {Object} streamQuality - 码流质量评估
     * @returns {string} 推荐的质量档位
     */
    decideQuality(networkInfo, networkQuality, webrtcStats, streamQuality) {
        const { downlink, rtt } = networkInfo;
        const { packetLossRate } = webrtcStats;

        // 如果当前播放质量良好且网络稳定，保持当前质量
        if (streamQuality.score >= 75 && networkQuality.score >= 70) {
            this.goodQualityCount++;
            this.poorQualityCount = 0;

            // 如果持续良好，尝试升级（但不超过最高档）
            if (this.goodQualityCount >= 5) {
                const currentIndex = this.options.qualityLevels.indexOf(this.currentQuality);
                if (currentIndex > 0) {
                    const higherQuality = this.options.qualityLevels[currentIndex - 1];
                    const threshold = this.options.qualityThresholds[higherQuality];

                    // 检查是否满足更高质量的要求
                    if (downlink >= threshold.minBandwidth * 1.2 &&
                        rtt <= threshold.maxRTT &&
                        packetLossRate <= threshold.maxPacketLoss) {
                        this.goodQualityCount = 0;
                        return higherQuality;
                    }
                }
            }

            return this.currentQuality;
        }

        // 如果质量不佳，增加计数器
        if (streamQuality.score < 60 || networkQuality.score < 50) {
            this.poorQualityCount++;
            this.goodQualityCount = 0;
        } else {
            this.poorQualityCount = 0;
        }

        // 只有连续多次质量不佳才降级（避免抖动）
        if (this.poorQualityCount < 3) {
            return this.currentQuality;
        }

        // 从高到低遍历质量档位，找到第一个满足条件的
        for (const quality of this.options.qualityLevels) {
            const threshold = this.options.qualityThresholds[quality];

            // 检查是否满足该档位的要求
            if (downlink >= threshold.minBandwidth &&
                rtt <= threshold.maxRTT &&
                packetLossRate <= threshold.maxPacketLoss) {
                return quality;
            }
        }

        // 如果所有档位都不满足，返回最低档
        return this.options.qualityLevels[this.options.qualityLevels.length - 1];
    }

    /**
     * 切换到指定质量
     * @param {string} quality - 目标质量
     * @param {string} reason - 切换原因
     */
    async switchTo(quality, reason = '手动切换') {
        if (!this.options.qualityLevels.includes(quality)) {
            console.error(`无效的质量档位: ${quality}`);
            return;
        }

        if (quality === this.currentQuality) {
            console.log('已经是目标质量，无需切换');
            return;
        }

        const oldQuality = this.currentQuality;
        console.log(`准备切换: ${oldQuality} -> ${quality}, 原因: ${reason}`);

        try {
            // 执行切换
            await this.player.switchQuality(quality);

            // 更新状态
            this.currentQuality = quality;
            this.lastSwitchTime = Date.now();

            // 重置计数器
            this.poorQualityCount = 0;
            this.goodQualityCount = 0;

            // 记录切换历史
            this.addSwitchHistory({
                from: oldQuality,
                to: quality,
                reason,
                timestamp: new Date()
            });

            // 通知监听器
            this.notifyListeners({
                type: 'switched',
                oldQuality,
                newQuality: quality,
                reason
            });

            console.log(`切换成功: ${quality}`);

        } catch (error) {
            console.error('切换失败:', error);
            this.notifyListeners({
                type: 'error',
                message: '切换失败',
                error
            });
        }
    }

    /**
     * 手动切换到指定质量（禁用自动切换）
     * @param {string} quality - 目标质量
     */
    async manualSwitch(quality) {
        // 手动切换时，临时禁用自动切换
        const wasAutoEnabled = this.options.autoSwitch;
        this.disableAutoSwitch();

        await this.switchTo(quality, '手动切换');

        // 5 秒后恢复自动切换
        setTimeout(() => {
            if (wasAutoEnabled) {
                this.enableAutoSwitch();
            }
        }, 5000);
    }

    /**
     * 添加切换历史记录
     * @param {Object} record - 切换记录
     */
    addSwitchHistory(record) {
        this.switchHistory.unshift(record);

        // 只保留最近 50 条记录
        if (this.switchHistory.length > 50) {
            this.switchHistory.pop();
        }
    }

    /**
     * 获取切换历史
     * @returns {Array} 切换历史记录
     */
    getSwitchHistory() {
        return [...this.switchHistory];
    }

    /**
     * 清空切换历史
     */
    clearSwitchHistory() {
        this.switchHistory = [];
    }

    /**
     * 获取当前质量
     * @returns {string}
     */
    getCurrentQuality() {
        return this.currentQuality;
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
     * @param {Object} event - 事件对象
     */
    notifyListeners(event) {
        this.listeners.forEach(listener => {
            try {
                listener(event);
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
        this.switchHistory = [];
    }
}

// 导出为全局变量
if (typeof window !== 'undefined') {
    window.AdaptiveController = AdaptiveController;
}
