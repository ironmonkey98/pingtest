/**
 * 智能画质控制器
 * 职责：基于网络状况和多流统计，智能推荐最优分辨率配置
 * 原则：单一职责（SOLID-S）- 专注于画质决策算法
 */
class SmartQualityController {
    constructor(config = {}) {
        this.config = {
            // 画质档位定义
            qualityProfiles: {
                '1080p': { 
                    width: 1920, 
                    height: 1080, 
                    bitrate: 4000, // kbps
                    minBandwidth: 5.0, // Mbps
                    priority: 4 
                },
                '720p': { 
                    width: 1280, 
                    height: 720, 
                    bitrate: 2500,
                    minBandwidth: 3.0,
                    priority: 3 
                },
                '480p': { 
                    width: 854, 
                    height: 480, 
                    bitrate: 1200,
                    minBandwidth: 1.5,
                    priority: 2 
                },
                '360p': { 
                    width: 640, 
                    height: 360, 
                    bitrate: 800,
                    minBandwidth: 1.0,
                    priority: 1 
                }
            },
            
            // 布局配置的画质策略
            layoutStrategies: {
                single: {
                    maxQuality: '1080p',
                    preferredQuality: '1080p',
                    fallbackStrategy: 'graceful_degradation'
                },
                grid4: {
                    maxQuality: '720p',
                    preferredQuality: '720p',
                    primaryStreamQuality: '1080p', // 主要流可以更高
                    fallbackStrategy: 'mixed_quality'
                },
                grid9: {
                    maxQuality: '480p',
                    preferredQuality: '480p',
                    primaryStreamQuality: '720p',
                    fallbackStrategy: 'uniform_quality'
                }
            },

            // 网络质量阈值
            networkThresholds: {
                excellent: { bandwidth: 15, latency: 50, loss: 0.5 },
                good: { bandwidth: 10, latency: 100, loss: 1.0 },
                fair: { bandwidth: 5, latency: 150, loss: 2.0 },
                poor: { bandwidth: 2, latency: 200, loss: 5.0 }
            },

            // 决策权重配置
            decisionWeights: {
                networkQuality: 0.4,
                currentPerformance: 0.3,
                layoutOptimization: 0.2,
                userPreference: 0.1
            },

            // 防抖配置
            switchCooldown: 10000, // 10秒内不重复切换
            stabilityPeriod: 5000,  // 5秒稳定期

            ...config
        };

        // 状态管理
        this.networkMonitor = null;
        this.multiStreamStats = null;
        this.currentLayout = 'single';
        this.primaryIndex = 0; // 主视图索引
        this.lastSwitchTimes = new Map(); // 记录每个流的最后切换时间
        this.stabilityTracker = new Map(); // 稳定性跟踪
        this.userPreferences = new Map(); // 用户偏好记录

        // 决策历史
        this.decisionHistory = [];
        this.performanceMetrics = {
            successfulSwitches: 0,
            failedSwitches: 0,
            userOverrides: 0
        };

        // 事件监听器
        this.listeners = {
            qualityRecommendation: [],
            batchRecommendation: [],
            performanceUpdate: [],
            strategyChange: []
        };

        console.log('智能画质控制器初始化完成');
    }

    /**
     * 设置网络监控器
     * @param {NetworkMonitor} networkMonitor 
     */
    setNetworkMonitor(networkMonitor) {
        this.networkMonitor = networkMonitor;
        console.log('网络监控器已设置');
    }

    /**
     * 设置多流统计收集器
     * @param {MultiStreamStatsCollector} multiStreamStats 
     */
    setMultiStreamStats(multiStreamStats) {
        this.multiStreamStats = multiStreamStats;
        console.log('多流统计收集器已设置');
    }

    /**
     * 更新当前布局
     * @param {string} layout - 布局类型
     */
    updateLayout(layout) {
        const previousLayout = this.currentLayout;
        this.currentLayout = layout;
        
        console.log(`布局变更: ${previousLayout} -> ${layout}`);
        
        // 触发布局变更的画质策略调整
        this.adjustStrategyForLayout(layout);
    }

    /**
     * 设置主视图索引
     * @param {number} index - 主视图
     */
    setPrimaryIndex(index) {
        const prev = this.primaryIndex;
        this.primaryIndex = index;
        this.emit('strategyChange', {
            layout: this.currentLayout,
            strategy: { type: 'primary_change' },
            recommendations: [{ type: 'primary_stream_update', streamIndex: index, reason: '用户设置主视图' }],
            timestamp: Date.now()
        });
        console.log(`主视图变更: ${prev} -> ${index}`);
    }

    /**
     * 为布局调整策略
     * @param {string} layout - 新布局
     */
    adjustStrategyForLayout(layout) {
        const strategy = this.config.layoutStrategies[layout];
        if (!strategy) {
            console.warn(`未知布局类型: ${layout}`);
            return;
        }

        // 生成布局优化建议
        const layoutRecommendations = this.generateLayoutOptimizations(layout);
        
        this.emit('strategyChange', {
            layout,
            strategy,
            recommendations: layoutRecommendations,
            timestamp: Date.now()
        });
    }

    /**
     * 生成布局优化建议
     * @param {string} layout - 布局类型
     * @returns {Array} 优化建议
     */
    generateLayoutOptimizations(layout) {
        const recommendations = [];
        const strategy = this.config.layoutStrategies[layout];
        
        if (!strategy || !this.multiStreamStats) {
            return recommendations;
        }

        const activeStreams = this.multiStreamStats.getActiveStreams?.() || [];
        const networkAssessment = this.multiStreamStats.getNetworkAssessment?.();

        switch (layout) {
            case 'single':
                recommendations.push({
                    type: 'single_stream_optimization',
                    streamIndex: 0,
                    recommendedQuality: this.getBestQualityForNetwork(networkAssessment),
                    reason: '单视图模式，推荐使用最高可用画质'
                });
                break;

            case 'grid4':
                recommendations.push(...this.optimizeGrid4Layout(activeStreams, networkAssessment));
                break;

            case 'grid9':
                recommendations.push(...this.optimizeGrid9Layout(activeStreams, networkAssessment));
                break;
        }

        return recommendations;
    }

    /**
     * 优化四宫格布局
     * @param {Array} activeStreams - 活跃流
     * @param {Object} networkAssessment - 网络评估
     * @returns {Array} 优化建议
     */
    optimizeGrid4Layout(activeStreams, networkAssessment) {
        const recommendations = [];
        const strategy = this.config.layoutStrategies.grid4;

        // 主流使用较高画质（由用户选择的主视图）
        const primary = Math.min(this.primaryIndex ?? 0, Math.max(0, activeStreams.length - 1));
        if (activeStreams.length > 0) {
            const primaryQuality = this.determineOptimalQuality(
                strategy.primaryStreamQuality,
                networkAssessment,
                { isPrimary: true }
            );

            recommendations.push({
                type: 'primary_stream_quality',
                streamIndex: primary,
                recommendedQuality: primaryQuality,
                reason: '主视频流，建议使用较高画质以保证观看体验'
            });
        }

        // 其他流使用中等画质
        for (let i = 0; i < Math.min(4, activeStreams.length); i++) {
            if (i === primary) continue;
            const secondaryQuality = this.determineOptimalQuality(
                strategy.preferredQuality,
                networkAssessment,
                { isPrimary: false, index: i }
            );

            recommendations.push({
                type: 'secondary_stream_quality',
                streamIndex: i,
                recommendedQuality: secondaryQuality,
                reason: '辅助视频流，使用中等画质平衡带宽和清晰度'
            });
        }

        return recommendations;
    }

    /**
     * 优化九宫格布局
     * @param {Array} activeStreams - 活跃流
     * @param {Object} networkAssessment - 网络评估
     * @returns {Array} 优化建议
     */
    optimizeGrid9Layout(activeStreams, networkAssessment) {
        const recommendations = [];
        const strategy = this.config.layoutStrategies.grid9;

        // 分层画质策略
        const qualityTiers = this.calculateQualityTiers(activeStreams.length, networkAssessment);

        for (let i = 0; i < Math.min(9, activeStreams.length); i++) {
            const tier = this.getStreamTier(i);
            const recommendedQuality = qualityTiers[tier] || strategy.preferredQuality;

            recommendations.push({
                type: 'multi_stream_optimization',
                streamIndex: i,
                recommendedQuality,
                tier,
                reason: `九宫格布局第${tier + 1}层，使用${recommendedQuality}画质`
            });
        }

        return recommendations;
    }

    /**
     * 计算画质分层
     * @param {number} streamCount - 流数量
     * @param {Object} networkAssessment - 网络评估
     * @returns {Array} 画质分层
     */
    calculateQualityTiers(streamCount, networkAssessment) {
        const network = networkAssessment?.overall || 'fair';
        
        // 根据网络状况和流数量确定分层策略
        const tierStrategies = {
            excellent: {
                tier0: '720p',  // 主要流
                tier1: '480p',  // 次要流
                tier2: '360p'   // 其他流
            },
            good: {
                tier0: '720p',
                tier1: '480p',
                tier2: '360p'
            },
            fair: {
                tier0: '480p',
                tier1: '360p',
                tier2: '360p'
            },
            poor: {
                tier0: '480p',
                tier1: '360p',
                tier2: '360p'
            }
        };

        return tierStrategies[network] || tierStrategies.fair;
    }

    /**
     * 获取流的层级
     * @param {number} streamIndex - 流索引
     * @returns {string} 层级
     */
    getStreamTier(streamIndex) {
        // 主视图永远是 tier0
        if (streamIndex === this.primaryIndex) return 'tier0';

        // 根据布局粗粒度分层，保持KISS
        switch (this.currentLayout) {
            case 'single':
                return 'tier0';
            case 'grid4':
                return 'tier1';
            case 'grid9':
                return streamIndex < 4 ? 'tier1' : 'tier2';
            default:
                return 'tier1';
        }
    }

    /**
     * 确定最优画质
     * @param {string} baseQuality - 基础画质
     * @param {Object} networkAssessment - 网络评估
     * @param {Object} options - 额外选项
     * @returns {string} 最优画质
     */
    determineOptimalQuality(baseQuality, networkAssessment, options = {}) {
        if (!networkAssessment) {
            return baseQuality;
        }

        const networkLevel = networkAssessment.overall;
        const isPrimary = options.isPrimary || false;

        // 网络质量映射到画质调整
        const networkQualityMap = {
            excellent: { adjustment: 1, canUpgrade: true },
            good: { adjustment: 0, canUpgrade: false },
            fair: { adjustment: -1, canUpgrade: false },
            poor: { adjustment: -2, canUpgrade: false }
        };

        const networkConfig = networkQualityMap[networkLevel] || networkQualityMap.fair;
        let targetQuality = baseQuality;

        // 应用网络质量调整
        if (networkConfig.adjustment > 0 && networkConfig.canUpgrade && isPrimary) {
            targetQuality = this.upgradeQuality(baseQuality);
        } else if (networkConfig.adjustment < 0) {
            targetQuality = this.downgradeQuality(baseQuality, Math.abs(networkConfig.adjustment));
        }

        // 确保画质在合理范围内
        return this.validateQuality(targetQuality);
    }

    /**
     * 升级画质
     * @param {string} currentQuality - 当前画质
     * @returns {string} 升级后画质
     */
    upgradeQuality(currentQuality) {
        const qualityOrder = ['360p', '480p', '720p', '1080p'];
        const currentIndex = qualityOrder.indexOf(currentQuality);
        
        if (currentIndex >= 0 && currentIndex < qualityOrder.length - 1) {
            return qualityOrder[currentIndex + 1];
        }
        
        return currentQuality;
    }

    /**
     * 降级画质
     * @param {string} currentQuality - 当前画质
     * @param {number} levels - 降级级数
     * @returns {string} 降级后画质
     */
    downgradeQuality(currentQuality, levels = 1) {
        const qualityOrder = ['360p', '480p', '720p', '1080p'];
        const currentIndex = qualityOrder.indexOf(currentQuality);
        
        if (currentIndex >= 0) {
            const newIndex = Math.max(0, currentIndex - levels);
            return qualityOrder[newIndex];
        }
        
        return currentQuality;
    }

    /**
     * 验证画质档位
     * @param {string} quality - 画质
     * @returns {string} 有效画质
     */
    validateQuality(quality) {
        const validQualities = Object.keys(this.config.qualityProfiles);
        return validQualities.includes(quality) ? quality : '480p';
    }

    /**
     * 获取网络条件下的最佳画质
     * @param {Object} networkAssessment - 网络评估
     * @returns {string} 最佳画质
     */
    getBestQualityForNetwork(networkAssessment) {
        if (!networkAssessment) {
            return '720p'; // 默认画质
        }

        const networkLevel = networkAssessment.overall;
        const bandwidthMbps = parseFloat(networkAssessment.metrics?.totalBandwidthUsage) || 0;

        // 基于网络状况的画质映射
        const qualityMapping = {
            excellent: bandwidthMbps < 5 ? '1080p' : '720p',
            good: '720p',
            fair: '480p',
            poor: '360p'
        };

        return qualityMapping[networkLevel] || '480p';
    }

    /**
     * 分析当前性能
     * @param {Array} activeStreams - 活跃流
     * @returns {Object} 性能分析结果
     */
    analyzeCurrentPerformance(activeStreams) {
        const analysis = {
            overall: 'good',
            issues: [],
            recommendations: [],
            metrics: {
                averageQualityScore: 0,
                problemStreams: 0,
                bandwidthEfficiency: 0
            }
        };

        if (!activeStreams || activeStreams.length === 0) {
            return analysis;
        }

        let totalQualityScore = 0;
        let problemStreams = 0;
        let totalBandwidth = 0;

        activeStreams.forEach((stream, index) => {
            const stats = stream.currentStats;
            if (!stats) return;

            totalQualityScore += stats.qualityScore || 50;
            totalBandwidth += stats.videoBitrate || 0;

            // 识别问题流
            if (stats.packetLossRate > 2 || stats.jitter > 80 || stats.videoFps < 20) {
                problemStreams++;
                analysis.issues.push(`视频流 ${index + 1} 存在质量问题`);
                
                // 生成针对性建议
                const recommendation = this.generateStreamRecommendation(stream, index);
                if (recommendation) {
                    analysis.recommendations.push(recommendation);
                }
            }
        });

        // 计算平均指标
        analysis.metrics.averageQualityScore = Math.round(totalQualityScore / activeStreams.length);
        analysis.metrics.problemStreams = problemStreams;
        analysis.metrics.bandwidthEfficiency = this.calculateBandwidthEfficiency(activeStreams);

        // 确定整体状况
        if (problemStreams === 0 && analysis.metrics.averageQualityScore > 80) {
            analysis.overall = 'excellent';
        } else if (problemStreams <= 1 && analysis.metrics.averageQualityScore > 60) {
            analysis.overall = 'good';
        } else if (problemStreams <= 2 && analysis.metrics.averageQualityScore > 40) {
            analysis.overall = 'fair';
        } else {
            analysis.overall = 'poor';
        }

        return analysis;
    }

    /**
     * 计算带宽效率
     * @param {Array} activeStreams - 活跃流
     * @returns {number} 效率百分比
     */
    calculateBandwidthEfficiency(activeStreams) {
        let actualBandwidth = 0;
        let theoreticalBandwidth = 0;

        activeStreams.forEach(stream => {
            const stats = stream.currentStats;
            if (!stats || !stats.resolution) return;

            actualBandwidth += stats.videoBitrate || 0;

            // 计算理论带宽需求
            const quality = this.getQualityFromResolution(stats.resolution.height);
            const profile = this.config.qualityProfiles[quality];
            if (profile) {
                theoreticalBandwidth += profile.bitrate;
            }
        });

        if (theoreticalBandwidth === 0) return 100;
        
        return Math.min(100, Math.round((actualBandwidth / theoreticalBandwidth) * 100));
    }

    /**
     * 为单个流生成建议
     * @param {Object} stream - 流信息
     * @param {number} index - 流索引
     * @returns {Object} 建议
     */
    generateStreamRecommendation(stream, index) {
        const stats = stream.currentStats;
        if (!stats) return null;

        // 检查冷却期
        const lastSwitchTime = this.lastSwitchTimes.get(stream.id) || 0;
        if (Date.now() - lastSwitchTime < this.config.switchCooldown) {
            return null;
        }

        let recommendedQuality = null;
        let reason = '';
        let confidence = 0;

        // 分析问题类型并推荐解决方案
        if (stats.packetLossRate > 3) {
            recommendedQuality = this.downgradeQuality(
                this.getQualityFromResolution(stats.resolution?.height)
            );
            reason = '网络丢包严重，建议降低画质';
            confidence = 0.9;
        } else if (stats.jitter > 100) {
            recommendedQuality = this.downgradeQuality(
                this.getQualityFromResolution(stats.resolution?.height)
            );
            reason = '网络抖动过大，建议降低画质';
            confidence = 0.8;
        } else if (stats.videoFps < 15) {
            recommendedQuality = this.downgradeQuality(
                this.getQualityFromResolution(stats.resolution?.height)
            );
            reason = '帧率过低，建议降低画质';
            confidence = 0.85;
        }

        if (recommendedQuality) {
            return {
                streamIndex: index,
                streamId: stream.id,
                currentQuality: this.getQualityFromResolution(stats.resolution?.height),
                recommendedQuality,
                reason,
                confidence,
                timestamp: Date.now()
            };
        }

        return null;
    }

    /**
     * 根据分辨率获取画质档位
     * @param {number} height - 分辨率高度
     * @returns {string} 画质档位
     */
    getQualityFromResolution(height) {
        if (!height) return '480p';
        
        if (height >= 1080) return '1080p';
        if (height >= 720) return '720p';
        if (height >= 480) return '480p';
        return '360p';
    }

    /**
     * 生成批量优化建议
     * @returns {Object} 批量建议
     */
    generateBatchRecommendations() {
        if (!this.multiStreamStats || !this.networkMonitor) {
            console.warn('缺少必要的数据源，无法生成建议');
            return null;
        }

        const activeStreams = this.multiStreamStats.getActiveStreams?.() || [];
        const networkAssessment = this.multiStreamStats.getNetworkAssessment?.();
        const networkData = this.networkMonitor.getLatestData?.();

        if (activeStreams.length === 0) {
            return null;
        }

        const performanceAnalysis = this.analyzeCurrentPerformance(activeStreams);
        const layoutOptimizations = this.generateLayoutOptimizations(this.currentLayout);

        const batchRecommendation = {
            timestamp: Date.now(),
            layout: this.currentLayout,
            totalStreams: activeStreams.length,
            networkAssessment,
            performanceAnalysis,
            recommendations: {
                immediate: [], // 立即执行的建议
                gradual: [],   // 渐进式建议
                fallback: []   // 备选方案
            },
            strategy: {
                type: this.determineOptimizationStrategy(performanceAnalysis, networkAssessment),
                priority: this.calculateOptimizationPriority(performanceAnalysis),
                confidence: this.calculateRecommendationConfidence(performanceAnalysis, networkAssessment)
            }
        };

        // 生成具体建议
        this.populateRecommendations(batchRecommendation, activeStreams, layoutOptimizations);

        // 记录决策历史
        this.recordDecision(batchRecommendation);

        return batchRecommendation;
    }

    /**
     * 确定优化策略类型
     * @param {Object} performanceAnalysis - 性能分析
     * @param {Object} networkAssessment - 网络评估
     * @returns {string} 策略类型
     */
    determineOptimizationStrategy(performanceAnalysis, networkAssessment) {
        const networkLevel = networkAssessment?.overall || 'fair';
        const performanceLevel = performanceAnalysis.overall;

        if (networkLevel === 'poor' || performanceAnalysis.metrics.problemStreams > 2) {
            return 'emergency_downgrade';
        } else if (networkLevel === 'fair' || performanceLevel === 'fair') {
            return 'conservative_optimization';
        } else if (networkLevel === 'excellent' && performanceLevel === 'excellent') {
            return 'quality_enhancement';
        } else {
            return 'balanced_optimization';
        }
    }

    /**
     * 计算优化优先级
     * @param {Object} performanceAnalysis - 性能分析
     * @returns {string} 优先级
     */
    calculateOptimizationPriority(performanceAnalysis) {
        if (performanceAnalysis.metrics.problemStreams > 2) {
            return 'high';
        } else if (performanceAnalysis.metrics.problemStreams > 0) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * 计算建议置信度
     * @param {Object} performanceAnalysis - 性能分析
     * @param {Object} networkAssessment - 网络评估
     * @returns {number} 置信度 (0-1)
     */
    calculateRecommendationConfidence(performanceAnalysis, networkAssessment) {
        let confidence = 0.5; // 基础置信度

        // 基于数据完整性调整
        if (performanceAnalysis && networkAssessment) {
            confidence += 0.2;
        }

        // 基于问题明确性调整
        if (performanceAnalysis.metrics.problemStreams > 0) {
            confidence += 0.2;
        }

        // 基于历史成功率调整
        const successRate = this.getHistoricalSuccessRate();
        confidence += (successRate - 0.5) * 0.2;

        return Math.min(1, Math.max(0, confidence));
    }

    /**
     * 获取历史成功率
     * @returns {number} 成功率
     */
    getHistoricalSuccessRate() {
        const totalSwitches = this.performanceMetrics.successfulSwitches + this.performanceMetrics.failedSwitches;
        if (totalSwitches === 0) return 0.5;

        return this.performanceMetrics.successfulSwitches / totalSwitches;
    }

    /**
     * 填充具体建议
     * @param {Object} batchRecommendation - 批量建议对象
     * @param {Array} activeStreams - 活跃流
     * @param {Array} layoutOptimizations - 布局优化
     */
    populateRecommendations(batchRecommendation, activeStreams, layoutOptimizations) {
        const { strategy } = batchRecommendation;

        switch (strategy.type) {
            case 'emergency_downgrade':
                this.generateEmergencyRecommendations(batchRecommendation, activeStreams);
                break;
            case 'conservative_optimization':
                this.generateConservativeRecommendations(batchRecommendation, activeStreams);
                break;
            case 'quality_enhancement':
                this.generateEnhancementRecommendations(batchRecommendation, activeStreams);
                break;
            default:
                this.generateBalancedRecommendations(batchRecommendation, activeStreams);
                break;
        }

        // 添加布局优化建议
        batchRecommendation.recommendations.gradual.push(...layoutOptimizations);
    }

    /**
     * 生成紧急降级建议
     * @param {Object} batchRecommendation - 批量建议
     * @param {Array} activeStreams - 活跃流
     */
    generateEmergencyRecommendations(batchRecommendation, activeStreams) {
        console.log('生成紧急降级建议');

        activeStreams.forEach((stream, index) => {
            const currentQuality = this.getQualityFromResolution(stream.currentStats?.resolution?.height);
            const emergencyQuality = this.downgradeQuality(currentQuality, 2); // 降级2个等级

            batchRecommendation.recommendations.immediate.push({
                type: 'emergency_quality_reduction',
                streamIndex: index,
                currentQuality,
                recommendedQuality: emergencyQuality,
                reason: '网络状况严重恶化，紧急降级以维持连接',
                confidence: 0.95
            });
        });
    }

    /**
     * 生成保守优化建议
     * @param {Object} batchRecommendation - 批量建议
     * @param {Array} activeStreams - 活跃流
     */
    generateConservativeRecommendations(batchRecommendation, activeStreams) {
        console.log('生成保守优化建议');

        activeStreams.forEach((stream, index) => {
            const stats = stream.currentStats;
            if (!stats) return;

            if (stats.packetLossRate > 2 || stats.jitter > 60) {
                const currentQuality = this.getQualityFromResolution(stats.resolution?.height);
                const conservativeQuality = this.downgradeQuality(currentQuality, 1);

                batchRecommendation.recommendations.gradual.push({
                    type: 'conservative_optimization',
                    streamIndex: index,
                    currentQuality,
                    recommendedQuality: conservativeQuality,
                    reason: '网络状况一般，保守降级以提升稳定性',
                    confidence: 0.8
                });
            }
        });
    }

    /**
     * 生成质量增强建议
     * @param {Object} batchRecommendation - 批量建议
     * @param {Array} activeStreams - 活跃流
     */
    generateEnhancementRecommendations(batchRecommendation, activeStreams) {
        console.log('生成质量增强建议');

        activeStreams.forEach((stream, index) => {
            const stats = stream.currentStats;
            if (!stats) return;

            // 只有在质量优秀的情况下才建议升级
            if (stats.packetLossRate < 1 && stats.jitter < 30 && stats.videoFps > 28) {
                const currentQuality = this.getQualityFromResolution(stats.resolution?.height);
                const enhancedQuality = this.upgradeQuality(currentQuality);

                if (enhancedQuality !== currentQuality) {
                    batchRecommendation.recommendations.gradual.push({
                        type: 'quality_enhancement',
                        streamIndex: index,
                        currentQuality,
                        recommendedQuality: enhancedQuality,
                        reason: '网络状况优秀，可以提升画质获得更好体验',
                        confidence: 0.7
                    });
                }
            }
        });
    }

    /**
     * 生成平衡优化建议
     * @param {Object} batchRecommendation - 批量建议
     * @param {Array} activeStreams - 活跃流
     */
    generateBalancedRecommendations(batchRecommendation, activeStreams) {
        console.log('生成平衡优化建议');

        // 综合考虑所有因素的平衡建议
        const layoutStrategy = this.config.layoutStrategies[this.currentLayout];
        
        activeStreams.forEach((stream, index) => {
            const recommendation = this.generateStreamRecommendation(stream, index);
            if (recommendation) {
                const recommendationType = this.determineRecommendationType(recommendation);
                batchRecommendation.recommendations[recommendationType].push({
                    ...recommendation,
                    type: 'balanced_optimization'
                });
            }
        });
    }

    /**
     * 确定建议类型
     * @param {Object} recommendation - 建议
     * @returns {string} 建议类型
     */
    determineRecommendationType(recommendation) {
        if (recommendation.confidence > 0.8) {
            return 'immediate';
        } else if (recommendation.confidence > 0.6) {
            return 'gradual';
        } else {
            return 'fallback';
        }
    }

    /**
     * 记录决策历史
     * @param {Object} decision - 决策记录
     */
    recordDecision(decision) {
        this.decisionHistory.push({
            timestamp: decision.timestamp,
            layout: decision.layout,
            strategy: decision.strategy,
            recommendationCount: decision.recommendations.immediate.length + 
                                decision.recommendations.gradual.length,
            networkLevel: decision.networkAssessment?.overall,
            performanceLevel: decision.performanceAnalysis.overall
        });

        // 限制历史记录长度
        if (this.decisionHistory.length > 100) {
            this.decisionHistory.shift();
        }
    }

    /**
     * 获取性能指标
     * @returns {Object} 性能指标
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            historicalSuccessRate: this.getHistoricalSuccessRate(),
            decisionCount: this.decisionHistory.length,
            averageConfidence: this.calculateAverageConfidence()
        };
    }

    /**
     * 计算平均置信度
     * @returns {number} 平均置信度
     */
    calculateAverageConfidence() {
        if (this.decisionHistory.length === 0) return 0;

        const totalConfidence = this.decisionHistory.reduce((sum, decision) => {
            return sum + (decision.strategy?.confidence || 0);
        }, 0);

        return totalConfidence / this.decisionHistory.length;
    }

    /**
     * 报告切换结果
     * @param {string} streamId - 流ID
     * @param {boolean} success - 是否成功
     * @param {Object} details - 详细信息
     */
    reportSwitchResult(streamId, success, details = {}) {
        if (success) {
            this.performanceMetrics.successfulSwitches++;
        } else {
            this.performanceMetrics.failedSwitches++;
        }

        // 更新最后切换时间
        this.lastSwitchTimes.set(streamId, Date.now());

        console.log(`画质切换结果 - 流 ${streamId}: ${success ? '成功' : '失败'}`, details);
    }

    /**
     * 记录用户偏好
     * @param {string} streamId - 流ID
     * @param {string} quality - 用户选择的画质
     */
    recordUserPreference(streamId, quality) {
        this.userPreferences.set(streamId, {
            quality,
            timestamp: Date.now()
        });

        this.performanceMetrics.userOverrides++;
        console.log(`记录用户偏好 - 流 ${streamId}: ${quality}`);
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
                    console.error(`智能画质控制器事件 ${event} 监听器执行出错:`, error);
                }
            });
        }
    }

    /**
     * 销毁控制器
     */
    destroy() {
        console.log('销毁智能画质控制器...');

        // 清理数据
        this.lastSwitchTimes.clear();
        this.stabilityTracker.clear();
        this.userPreferences.clear();
        this.decisionHistory = [];

        // 清理监听器
        this.listeners = {
            qualityRecommendation: [],
            batchRecommendation: [],
            performanceUpdate: [],
            strategyChange: []
        };

        console.log('智能画质控制器已销毁');
    }
}

// 导出为全局变量
if (typeof window !== 'undefined') {
    window.SmartQualityController = SmartQualityController;
}
