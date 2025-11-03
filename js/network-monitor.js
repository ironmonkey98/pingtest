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
        this.lastBandwidthTest = null;
        this.bandwidthTestInterval = null;

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

        // 启动实际带宽测试（每30秒一次）
        this.startBandwidthTesting();
    }

    /**
     * 更新网络信息
     */
    updateNetworkInfo() {
        if (this.connection) {
            // 使用API数据，但设置合理的默认值
            this.networkInfo = {
                type: this.connection.type || '未知',
                effectiveType: this.connection.effectiveType || '4g',
                downlink: this.connection.downlink || this.getReasonableDefaultBandwidth(),
                rtt: this.connection.rtt || this.getReasonableDefaultRTT(),
                saveData: this.connection.saveData || false,
                isAPIData: true
            };
        } else {
            // 浏览器不支持时的降级方案
            this.networkInfo = {
                type: '未知',
                effectiveType: '4g', 
                downlink: this.getReasonableDefaultBandwidth(),
                rtt: this.getReasonableDefaultRTT(),
                saveData: false,
                isAPIData: false
            };
        }
    }

    /**
     * 获取合理的默认带宽（基于网络类型）
     */
    getReasonableDefaultBandwidth() {
        const connectionType = this.connection?.effectiveType || '4g';
        const defaults = {
            'slow-2g': 0.1,
            '2g': 0.3,
            '3g': 1.5,
            '4g': 15.0,  // 现代4G应该有更高带宽
            '5g': 50.0
        };
        return defaults[connectionType] || 15.0;
    }

    /**
     * 获取合理的默认RTT（基于网络类型）
     */
    getReasonableDefaultRTT() {
        const connectionType = this.connection?.effectiveType || '4g';
        const defaults = {
            'slow-2g': 1000,
            '2g': 500,
            '3g': 200,
            '4g': 80,    // 现代4G的RTT应该更低
            '5g': 30
        };
        return defaults[connectionType] || 80;
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
     * 启动实际带宽测试
     */
    startBandwidthTesting() {
        // 立即执行一次测试
        this.performBandwidthTest();
        
        // 每30秒测试一次
        this.bandwidthTestInterval = setInterval(() => {
            this.performBandwidthTest();
        }, 30000);
    }

    /**
     * 执行实际带宽测试
     */
    async performBandwidthTest() {
        try {
            // 使用测试图片来进行真实网络测试
            const testUrls = [
                'https://httpbin.org/bytes/51200', // 50KB
                'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
                'https://www.baidu.com/img/baidu_jgylogo3.gif'
            ];
            
            let bestSpeed = 0;
            let successfulTests = 0;
            
            for (const testUrl of testUrls) {
                try {
                    const startTime = performance.now();
                    const response = await fetch(testUrl + '?_t=' + Date.now(), {
                        cache: 'no-cache',
                        mode: 'cors'
                    });
                    
                    if (!response.ok) continue;
                    
                    const data = await response.blob();
                    const endTime = performance.now();
                    
                    const duration = (endTime - startTime) / 1000; // 秒
                    const sizeBytes = data.size;
                    const speedMbps = (sizeBytes * 8) / (duration * 1000000); // Mbps
                    
                    if (speedMbps > bestSpeed) {
                        bestSpeed = speedMbps;
                    }
                    
                    successfulTests++;
                    
                    console.log(`测试 ${testUrl}: ${speedMbps.toFixed(2)} Mbps (${sizeBytes} bytes, ${duration.toFixed(2)}s)`);
                    
                    // 如果有一个成功的测试就够了
                    break;
                    
                } catch (error) {
                    console.warn(`测试 ${testUrl} 失败:`, error);
                    continue;
                }
            }
            
            if (successfulTests > 0) {
                this.lastBandwidthTest = {
                    measuredBandwidth: Math.max(bestSpeed, 0.1), // 最低0.1Mbps
                    timestamp: Date.now(),
                    testMethod: 'real_download'
                };

                // 更新网络信息，优先使用测试结果
                this.updateNetworkInfoWithTest();
                
                console.log(`实际带宽测试完成: ${bestSpeed.toFixed(2)} Mbps`);
            } else {
                console.warn('所有带宽测试都失败，使用API数据');
            }
            
        } catch (error) {
            console.warn('带宽测试失败:', error);
            // 测试失败时使用API数据
        }
    }

    /**
     * 生成测试数据
     */
    generateTestData(size) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < size; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return btoa(result);
    }

    /**
     * 使用测试结果更新网络信息
     */
    updateNetworkInfoWithTest() {
        if (this.lastBandwidthTest) {
            const testAge = Date.now() - this.lastBandwidthTest.timestamp;
            
            // 如果测试结果在60秒内，使用测试结果
            if (testAge < 60000) {
                const apiData = this.connection ? {
                    type: this.connection.type || '未知',
                    effectiveType: this.connection.effectiveType || '4g',
                    downlink: this.connection.downlink,
                    rtt: this.connection.rtt,
                    saveData: this.connection.saveData || false
                } : null;

                // 优先使用实际测试的带宽，API的RTT通常比较准确
                this.networkInfo = {
                    type: apiData?.type || '未知',
                    effectiveType: apiData?.effectiveType || '4g',
                    downlink: this.lastBandwidthTest.measuredBandwidth,
                    rtt: apiData?.rtt || this.getReasonableDefaultRTT(),
                    saveData: apiData?.saveData || false,
                    isAPIData: false,
                    isTested: true,
                    testAge: Math.round(testAge / 1000) // 秒
                };
                
                console.log(`使用实际测试带宽: ${this.lastBandwidthTest.measuredBandwidth.toFixed(2)} Mbps`);
                return;
            }
        }
        
        // 回退到原来的方法
        this.updateNetworkInfo();
    }

    /**
     * 停止带宽测试
     */
    stopBandwidthTesting() {
        if (this.bandwidthTestInterval) {
            clearInterval(this.bandwidthTestInterval);
            this.bandwidthTestInterval = null;
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        this.stopMonitoring();
        this.stopBandwidthTesting();
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
