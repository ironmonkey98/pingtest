/**
 * 网络质量监测模块
 * 职责：监测网络类型、带宽、延迟等指标
 * 原则：单一职责（SOLID-S）- 只负责网络监测
 */
class NetworkMonitor {
    constructor() {
        this.connection = null;
        this.networkInfo = {
            type: '未知',
            effectiveType: '未知',
            downlink: 0,
            rtt: 0,
            saveData: false
        };
        this.listeners = [];
        this.monitorInterval = null;

        this.init();
    }

    /**
     * 初始化网络监测
     */
    init() {
        // 检查 Network Information API 支持情况
        if ('connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator) {
            this.connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            this.updateNetworkInfo();

            // 监听网络变化
            this.connection.addEventListener('change', () => {
                this.updateNetworkInfo();
                this.notifyListeners();
            });
        } else {
            console.warn('Network Information API 不支持，将使用降级方案');
        }

        // 启动定期监测
        this.startMonitoring();
    }

    /**
     * 更新网络信息
     */
    updateNetworkInfo() {
        if (!this.connection) return;

        this.networkInfo = {
            type: this.connection.type || '未知',
            effectiveType: this.connection.effectiveType || '4g',
            downlink: this.connection.downlink || 10, // Mbps
            rtt: this.connection.rtt || 50, // ms
            saveData: this.connection.saveData || false
        };
    }

    /**
     * 启动定期监测
     */
    startMonitoring() {
        // 每 3 秒更新一次网络信息
        this.monitorInterval = setInterval(() => {
            this.updateNetworkInfo();
            this.notifyListeners();
        }, 3000);
    }

    /**
     * 停止监测
     */
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }

    /**
     * 获取当前网络信息
     * @returns {Object} 网络信息对象
     */
    getNetworkInfo() {
        return { ...this.networkInfo };
    }

    /**
     * 评估网络质量等级
     * @returns {Object} { level: string, score: number, reason: string }
     */
    evaluateNetworkQuality() {
        const { effectiveType, downlink, rtt, saveData } = this.networkInfo;

        let score = 100;
        let level = 'excellent';
        let reasons = [];

        // 根据有效类型评分
        switch (effectiveType) {
            case 'slow-2g':
                score -= 70;
                reasons.push('网络类型为 2G');
                break;
            case '2g':
                score -= 60;
                reasons.push('网络类型为 2G');
                break;
            case '3g':
                score -= 40;
                reasons.push('网络类型为 3G');
                break;
            case '4g':
                score -= 10;
                break;
        }

        // 根据下行速度评分
        if (downlink < 0.5) {
            score -= 40;
            reasons.push('下行速度过低');
        } else if (downlink < 1.5) {
            score -= 25;
            reasons.push('下行速度较低');
        } else if (downlink < 3) {
            score -= 10;
        }

        // 根据 RTT 评分
        if (rtt > 300) {
            score -= 30;
            reasons.push('网络延迟过高');
        } else if (rtt > 150) {
            score -= 15;
            reasons.push('网络延迟较高');
        } else if (rtt > 100) {
            score -= 5;
        }

        // 省流模式
        if (saveData) {
            score -= 20;
            reasons.push('启用省流模式');
        }

        // 确定等级
        if (score >= 80) {
            level = 'excellent';
        } else if (score >= 60) {
            level = 'good';
        } else if (score >= 40) {
            level = 'fair';
        } else {
            level = 'poor';
        }

        return {
            level,
            score: Math.max(0, score),
            reason: reasons.join('、') || '网络状况良好'
        };
    }

    /**
     * 推荐合适的视频质量
     * @returns {string} '1080p' | '720p' | '480p'
     */
    recommendQuality() {
        const { downlink, rtt, effectiveType } = this.networkInfo;

        // 优先使用下行速度判断
        if (downlink >= 3 && rtt < 100) {
            return '1080p';
        } else if (downlink >= 1.5 && rtt < 150) {
            return '720p';
        } else if (downlink >= 0.8) {
            return '720p';
        } else {
            return '480p';
        }
    }

    /**
     * 添加监听器
     * @param {Function} callback 回调函数
     */
    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    /**
     * 移除监听器
     * @param {Function} callback 回调函数
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    /**
     * 通知所有监听器
     */
    notifyListeners() {
        const networkInfo = this.getNetworkInfo();
        const quality = this.evaluateNetworkQuality();

        this.listeners.forEach(listener => {
            try {
                listener({ networkInfo, quality });
            } catch (error) {
                console.error('通知监听器时出错:', error);
            }
        });
    }

    /**
     * 销毁实例
     */
    destroy() {
        this.stopMonitoring();
        this.listeners = [];

        if (this.connection) {
            this.connection.removeEventListener('change', this.updateNetworkInfo);
        }
    }
}

// 导出为全局变量（兼容非模块环境）
if (typeof window !== 'undefined') {
    window.NetworkMonitor = NetworkMonitor;
}
