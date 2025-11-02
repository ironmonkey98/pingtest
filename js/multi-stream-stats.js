/**
 * 多流统计采集器
 * 职责：统计多个视频流的使用情况，分析网络负载，提供智能切换建议
 * 原则：单一职责（SOLID-S）- 专注于多流统计分析
 */
class MultiStreamStatsCollector {
    constructor(config = {}) {
        this.config = {
            // 统计采集间隔（毫秒）
            interval: config.interval || 2000,
            // 历史数据保留时长（毫秒）
            historyDuration: config.historyDuration || 60000,
            // 质量评估阈值
            qualityThresholds: {
                excellent: { packetLoss: 0.5, jitter: 20, fps: 28 },
                good: { packetLoss: 1.5, jitter: 40, fps: 24 },
                fair: { packetLoss: 3.0, jitter: 60, fps: 20 },
                poor: { packetLoss: 5.0, jitter: 100, fps: 15 }
            },
            // 带宽评估阈值 (Mbps)
            bandwidthThresholds: {
                high: 10,
                medium: 5,
                low: 2
            },
            ...config
        };

        // 流统计数据存储
        this.streamStats = new Map(); // 每个流的统计信息
        this.historicalData = new Map(); // 历史数据
        this.aggregatedStats = null; // 聚合统计
        this.networkAssessment = null; // 网络评估结果
        
        // 时间相关
        this.lastUpdateTime = Date.now();
        this.intervalId = null;
        
        // 事件监听器
        this.listeners = {
            statsUpdate: [],
            qualityChange: [],
            networkChange: [],
            recommendation: []
        };

        // 质量切换建议缓存
        this.lastRecommendations = new Map();

        console.log('多流统计采集器初始化完成');
    }

    /**
     * 开始统计采集
     */
    start() {
        if (this.intervalId) {
            console.warn('多流统计采集已在运行');
            return;
        }

        console.log('开始多流统计采集...');
        this.intervalId = setInterval(() => {
            this.collectAndAnalyze();
        }, this.config.interval);

        // 立即执行一次
        this.collectAndAnalyze();
    }

    /**
     * 停止统计采集
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('多流统计采集已停止');
        }
    }

    /**
     * 添加流统计监控
     * @param {string} streamId - 流ID
     * @param {Object} statsCollector - WebRTCStatsCollector实例
     * @param {Object} metadata - 流元数据
     */
    addStream(streamId, statsCollector, metadata = {}) {
        console.log(`添加流监控: ${streamId}`);

        const streamInfo = {
            id: streamId,
            statsCollector,
            metadata: {
                viewIndex: metadata.viewIndex || 0,
                quality: metadata.quality || 'auto',
                priority: metadata.priority || 'normal',
                ...metadata
            },
            currentStats: null,
            lastUpdate: Date.now(),
            qualityHistory: [],
            isActive: true
        };

        this.streamStats.set(streamId, streamInfo);
        this.historicalData.set(streamId, []);

        // 监听单个流的统计更新
        statsCollector.addListener((data) => {
            this.updateStreamStats(streamId, data);
        });
    }

    /**
     * 移除流监控
     * @param {string} streamId - 流ID
     */
    removeStream(streamId) {
        console.log(`移除流监控: ${streamId}`);

        const streamInfo = this.streamStats.get(streamId);
        if (streamInfo) {
            streamInfo.isActive = false;
            this.streamStats.delete(streamId);
        }
    }

    /**
     * 更新单个流的统计数据
     * @param {string} streamId - 流ID
     * @param {Object} data - 统计数据
     */
    updateStreamStats(streamId, data) {
        const streamInfo = this.streamStats.get(streamId);
        if (!streamInfo || !streamInfo.isActive) {
            return;
        }

        const now = Date.now();
        const { stats, quality } = data;

        // 更新当前统计
        streamInfo.currentStats = {
            ...stats,
            timestamp: now,
            qualityStatus: quality.status,
            qualityScore: quality.score
        };
        streamInfo.lastUpdate = now;

        // 记录质量变化历史
        const lastQuality = streamInfo.qualityHistory[streamInfo.qualityHistory.length - 1];
        if (!lastQuality || lastQuality.status !== quality.status) {
            streamInfo.qualityHistory.push({
                status: quality.status,
                score: quality.score,
                timestamp: now
            });

            // 限制历史记录长度
            if (streamInfo.qualityHistory.length > 20) {
                streamInfo.qualityHistory.shift();
            }
        }

        // 添加到历史数据
        this.addToHistory(streamId, streamInfo.currentStats);
    }

    /**
     * 添加数据到历史记录
     * @param {string} streamId - 流ID
     * @param {Object} stats - 统计数据
     */
    addToHistory(streamId, stats) {
        const history = this.historicalData.get(streamId);
        if (!history) return;

        history.push({ ...stats });

        // 清理过期数据
        const cutoffTime = Date.now() - this.config.historyDuration;
        while (history.length > 0 && history[0].timestamp < cutoffTime) {
            history.shift();
        }
    }

    /**
     * 收集并分析所有流数据
     */
    collectAndAnalyze() {
        const now = Date.now();

        // 收集当前所有活跃流的统计
        const activeStreams = this.getActiveStreams();
        
        if (activeStreams.length === 0) {
            return; // 没有活跃流
        }

        // 生成聚合统计
        this.aggregatedStats = this.generateAggregatedStats(activeStreams);

        // 网络状况评估
        this.networkAssessment = this.assessNetworkConditions(activeStreams);

        // 生成质量切换建议
        const recommendations = this.generateQualityRecommendations(activeStreams);

        // 触发事件
        this.emit('statsUpdate', {
            timestamp: now,
            activeStreams: activeStreams.length,
            aggregated: this.aggregatedStats,
            network: this.networkAssessment,
            recommendations
        });

        // 检查是否有网络状况变化
        this.checkNetworkChanges();

        this.lastUpdateTime = now;
    }

    /**
     * 获取活跃流信息
     * @returns {Array} 活跃流数组
     */
    getActiveStreams() {
        const activeStreams = [];
        
        this.streamStats.forEach((streamInfo, streamId) => {
            if (streamInfo.isActive && streamInfo.currentStats) {
                activeStreams.push({
                    id: streamId,
                    ...streamInfo
                });
            }
        });

        return activeStreams;
    }

    /**
     * 生成聚合统计
     * @param {Array} activeStreams - 活跃流数组
     * @returns {Object} 聚合统计结果
     */
    generateAggregatedStats(activeStreams) {
        const stats = {
            totalStreams: activeStreams.length,
            totalBandwidth: 0, // kbps
            averageFps: 0,
            averagePacketLoss: 0,
            averageJitter: 0,
            totalResolution: { width: 0, height: 0 },
            qualityDistribution: {
                excellent: 0,
                good: 0,
                fair: 0,
                poor: 0
            },
            networkUtilization: 0 // 网络利用率百分比
        };

        let totalFps = 0;
        let totalPacketLoss = 0;
        let totalJitter = 0;

        activeStreams.forEach(stream => {
            const { currentStats } = stream;
            
            // 累计带宽
            stats.totalBandwidth += currentStats.videoBitrate || 0;
            
            // 累计帧率
            totalFps += currentStats.videoFps || 0;
            
            // 累计丢包率
            totalPacketLoss += parseFloat(currentStats.packetLossRate) || 0;
            
            // 累计抖动
            totalJitter += currentStats.jitter || 0;
            
            // 分辨率（选择最大的）
            if (currentStats.resolution) {
                stats.totalResolution.width = Math.max(
                    stats.totalResolution.width,
                    currentStats.resolution.width || 0
                );
                stats.totalResolution.height = Math.max(
                    stats.totalResolution.height,
                    currentStats.resolution.height || 0
                );
            }
            
            // 质量分布统计
            const qualityStatus = currentStats.qualityStatus || 'fair';
            if (stats.qualityDistribution[qualityStatus] !== undefined) {
                stats.qualityDistribution[qualityStatus]++;
            }
        });

        // 计算平均值
        if (activeStreams.length > 0) {
            stats.averageFps = Math.round(totalFps / activeStreams.length);
            stats.averagePacketLoss = (totalPacketLoss / activeStreams.length).toFixed(2);
            stats.averageJitter = Math.round(totalJitter / activeStreams.length);
        }

        // 估算网络利用率（基于经验值）
        const bandwidthMbps = stats.totalBandwidth / 1000;
        if (bandwidthMbps < 2) {
            stats.networkUtilization = 30;
        } else if (bandwidthMbps < 5) {
            stats.networkUtilization = 60;
        } else if (bandwidthMbps < 10) {
            stats.networkUtilization = 80;
        } else {
            stats.networkUtilization = 95;
        }

        return stats;
    }

    /**
     * 评估网络状况
     * @param {Array} activeStreams - 活跃流数组
     * @returns {Object} 网络评估结果
     */
    assessNetworkConditions(activeStreams) {
        const assessment = {
            overall: 'good',
            bandwidth: 'sufficient',
            stability: 'stable',
            recommendations: [],
            metrics: {
                totalBandwidthUsage: 0, // Mbps
                averageQualityScore: 0,
                networkStressLevel: 'low' // low, medium, high
            }
        };

        if (activeStreams.length === 0) {
            return assessment;
        }

        // 计算总带宽使用
        const totalBandwidth = activeStreams.reduce((sum, stream) => {
            return sum + (stream.currentStats.videoBitrate || 0);
        }, 0);
        assessment.metrics.totalBandwidthUsage = (totalBandwidth / 1000).toFixed(1);

        // 计算平均质量分数
        const totalQualityScore = activeStreams.reduce((sum, stream) => {
            return sum + (stream.currentStats.qualityScore || 50);
        }, 0);
        assessment.metrics.averageQualityScore = Math.round(totalQualityScore / activeStreams.length);

        // 评估带宽状况
        const bandwidthMbps = parseFloat(assessment.metrics.totalBandwidthUsage);
        if (bandwidthMbps > this.config.bandwidthThresholds.high) {
            assessment.bandwidth = 'overloaded';
            assessment.recommendations.push('建议减少同时观看的视频数量或降低画质');
        } else if (bandwidthMbps > this.config.bandwidthThresholds.medium) {
            assessment.bandwidth = 'moderate';
            assessment.recommendations.push('网络负载较高，建议使用自动画质调节');
        } else {
            assessment.bandwidth = 'sufficient';
        }

        // 评估网络稳定性
        const problematicStreams = activeStreams.filter(stream => {
            const stats = stream.currentStats;
            return parseFloat(stats.packetLossRate) > 2 || stats.jitter > 60;
        });

        if (problematicStreams.length > activeStreams.length * 0.5) {
            assessment.stability = 'unstable';
            assessment.recommendations.push('网络不稳定，建议使用更低的画质设置');
        } else if (problematicStreams.length > 0) {
            assessment.stability = 'moderate';
            assessment.recommendations.push('部分视频流存在质量问题，建议检查网络连接');
        } else {
            assessment.stability = 'stable';
        }

        // 评估网络压力等级
        if (bandwidthMbps > this.config.bandwidthThresholds.high || problematicStreams.length > 2) {
            assessment.metrics.networkStressLevel = 'high';
        } else if (bandwidthMbps > this.config.bandwidthThresholds.medium || problematicStreams.length > 0) {
            assessment.metrics.networkStressLevel = 'medium';
        } else {
            assessment.metrics.networkStressLevel = 'low';
        }

        // 综合评估
        if (assessment.bandwidth === 'overloaded' || assessment.stability === 'unstable') {
            assessment.overall = 'poor';
        } else if (assessment.bandwidth === 'moderate' || assessment.stability === 'moderate') {
            assessment.overall = 'fair';
        } else if (assessment.metrics.averageQualityScore > 80) {
            assessment.overall = 'excellent';
        } else {
            assessment.overall = 'good';
        }

        return assessment;
    }

    /**
     * 生成质量切换建议
     * @param {Array} activeStreams - 活跃流数组
     * @returns {Array} 切换建议数组
     */
    generateQualityRecommendations(activeStreams) {
        const recommendations = [];

        activeStreams.forEach(stream => {
            const recommendation = this.generateStreamRecommendation(stream);
            if (recommendation) {
                recommendations.push(recommendation);
            }
        });

        // 全局优化建议
        const globalRecommendation = this.generateGlobalOptimization(activeStreams);
        if (globalRecommendation) {
            recommendations.push(globalRecommendation);
        }

        return recommendations;
    }

    /**
     * 为单个流生成切换建议
     * @param {Object} stream - 流信息
     * @returns {Object|null} 切换建议
     */
    generateStreamRecommendation(stream) {
        const { id, currentStats, metadata } = stream;
        const stats = currentStats;

        // 获取上次的建议，避免频繁切换
        const lastRecommendation = this.lastRecommendations.get(id);
        const timeSinceLastRecommendation = Date.now() - (lastRecommendation?.timestamp || 0);
        
        // 5秒内不重复建议相同的切换
        if (timeSinceLastRecommendation < 5000 && lastRecommendation?.action) {
            return null;
        }

        let recommendedQuality = null;
        let reason = '';
        let confidence = 0;

        // 分析当前状况
        const packetLoss = parseFloat(stats.packetLossRate) || 0;
        const jitter = stats.jitter || 0;
        const fps = stats.videoFps || 0;
        const qualityScore = stats.qualityScore || 50;

        // 根据质量指标判断是否需要降级
        if (packetLoss > 3 || jitter > 80 || fps < 20) {
            // 需要降级
            const currentResolution = stats.resolution?.height || 720;
            
            if (currentResolution > 720) {
                recommendedQuality = '720p';
                reason = `丢包率${packetLoss}%，抖动${jitter}ms，建议降级以保证流畅性`;
                confidence = 0.8;
            } else if (currentResolution > 480) {
                recommendedQuality = '480p';
                reason = `网络状况较差，建议使用低画质保证观看体验`;
                confidence = 0.9;
            }
        } 
        // 根据质量指标判断是否可以升级
        else if (packetLoss < 1 && jitter < 30 && fps > 28 && qualityScore > 80) {
            // 可以尝试升级
            const currentResolution = stats.resolution?.height || 480;
            
            if (currentResolution < 720 && this.canUpgradeBasedOnBandwidth()) {
                recommendedQuality = '720p';
                reason = '网络状况良好，可以提升画质';
                confidence = 0.7;
            } else if (currentResolution < 1080 && this.canUpgradeBasedOnBandwidth() && metadata.priority === 'high') {
                recommendedQuality = '1080p';
                reason = '网络优秀且为主要视频流，建议升级到高画质';
                confidence = 0.6;
            }
        }

        if (recommendedQuality) {
            const recommendation = {
                streamId: id,
                type: 'quality_switch',
                currentQuality: this.getQualityFromResolution(stats.resolution?.height),
                recommendedQuality,
                reason,
                confidence,
                timestamp: Date.now(),
                metrics: {
                    packetLoss,
                    jitter,
                    fps,
                    qualityScore
                }
            };

            // 缓存建议
            this.lastRecommendations.set(id, recommendation);

            return recommendation;
        }

        return null;
    }

    /**
     * 生成全局优化建议
     * @param {Array} activeStreams - 活跃流数组
     * @returns {Object|null} 全局建议
     */
    generateGlobalOptimization(activeStreams) {
        if (activeStreams.length < 2) {
            return null; // 单流无需全局优化
        }

        const totalBandwidth = activeStreams.reduce((sum, stream) => {
            return sum + (stream.currentStats.videoBitrate || 0);
        }, 0);

        const bandwidthMbps = totalBandwidth / 1000;

        let recommendation = null;

        // 带宽过载时的优化建议
        if (bandwidthMbps > this.config.bandwidthThresholds.high) {
            recommendation = {
                type: 'global_optimization',
                action: 'reduce_quality',
                reason: `总带宽消耗${bandwidthMbps.toFixed(1)}Mbps过高，建议降低部分视频画质`,
                confidence: 0.9,
                timestamp: Date.now(),
                suggestions: [
                    '保持主视频高画质，其他视频使用中低画质',
                    '减少同时观看的视频数量',
                    '启用自动画质调节功能'
                ]
            };
        }
        // 网络充足时的优化建议
        else if (bandwidthMbps < this.config.bandwidthThresholds.low && activeStreams.length <= 4) {
            const lowQualityStreams = activeStreams.filter(stream => {
                const height = stream.currentStats.resolution?.height || 480;
                return height < 720;
            });

            if (lowQualityStreams.length > 0) {
                recommendation = {
                    type: 'global_optimization',
                    action: 'improve_quality',
                    reason: `网络状况良好，带宽充足，可以提升画质`,
                    confidence: 0.7,
                    timestamp: Date.now(),
                    suggestions: [
                        '可以尝试提升部分视频到更高画质',
                        '网络容量充足，支持更多视频流同时播放'
                    ]
                };
            }
        }

        return recommendation;
    }

    /**
     * 检查是否可以基于带宽状况升级
     * @returns {boolean}
     */
    canUpgradeBasedOnBandwidth() {
        if (!this.aggregatedStats) {
            return false;
        }

        const currentBandwidthMbps = this.aggregatedStats.totalBandwidth / 1000;
        return currentBandwidthMbps < this.config.bandwidthThresholds.medium;
    }

    /**
     * 根据分辨率高度获取质量档位
     * @param {number} height - 分辨率高度
     * @returns {string}
     */
    getQualityFromResolution(height) {
        if (!height) return 'unknown';
        
        if (height >= 1080) return '1080p';
        if (height >= 720) return '720p';
        if (height >= 480) return '480p';
        return 'low';
    }

    /**
     * 检查网络状况变化
     */
    checkNetworkChanges() {
        if (!this.networkAssessment) return;

        // 这里可以实现网络状况变化检测逻辑
        // 比较当前评估与历史评估，触发网络变化事件
        
        const significantChange = this.detectSignificantNetworkChange();
        if (significantChange) {
            this.emit('networkChange', {
                timestamp: Date.now(),
                assessment: this.networkAssessment,
                changeType: significantChange.type,
                reason: significantChange.reason
            });
        }
    }

    /**
     * 检测显著的网络变化
     * @returns {Object|null} 变化信息
     */
    detectSignificantNetworkChange() {
        // 简化实现：这里可以添加更复杂的变化检测逻辑
        return null;
    }

    /**
     * 获取聚合统计
     * @returns {Object|null}
     */
    getAggregatedStats() {
        return this.aggregatedStats;
    }

    /**
     * 获取网络评估
     * @returns {Object|null}
     */
    getNetworkAssessment() {
        return this.networkAssessment;
    }

    /**
     * 获取流历史数据
     * @param {string} streamId - 流ID
     * @param {number} duration - 时长（毫秒）
     * @returns {Array}
     */
    getStreamHistory(streamId, duration = 30000) {
        const history = this.historicalData.get(streamId);
        if (!history) return [];

        const cutoffTime = Date.now() - duration;
        return history.filter(data => data.timestamp >= cutoffTime);
    }

    /**
     * 添加事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * 移除事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`多流统计事件 ${event} 监听器执行出错:`, error);
                }
            });
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        console.log('销毁多流统计采集器...');

        this.stop();
        
        // 清理数据
        this.streamStats.clear();
        this.historicalData.clear();
        this.lastRecommendations.clear();
        
        // 清理监听器
        this.listeners = {
            statsUpdate: [],
            qualityChange: [],
            networkChange: [],
            recommendation: []
        };

        console.log('多流统计采集器已销毁');
    }
}

// 导出为全局变量
if (typeof window !== 'undefined') {
    window.MultiStreamStatsCollector = MultiStreamStatsCollector;
}