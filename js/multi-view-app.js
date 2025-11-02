/**
 * 多视图应用主控制器
 * 职责：整合所有模块，处理用户交互，协调智能切换
 * 原则：单一职责（SOLID-S）- 专注于应用层面的协调控制
 */
class MultiViewApplication {
    constructor() {
        // DOM 元素
        this.elements = {
            // 多视图容器
            multiViewContainer: document.getElementById('multiViewContainer'),
            
            // 状态指示器
            connectionStatus: document.getElementById('connectionStatus'),
            networkLevel: document.getElementById('networkLevel'),
            overallStatus: document.getElementById('overallStatus'),
            
            // 布局控制按钮
            layoutSingle: document.getElementById('layoutSingle'),
            layoutGrid4: document.getElementById('layoutGrid4'),
            layoutGrid9: document.getElementById('layoutGrid9'),
            
            // 全局控制按钮
            connectAll: document.getElementById('connectAll'),
            disconnectAll: document.getElementById('disconnectAll'),
            autoOptimize: document.getElementById('autoOptimize'),
            
            // 布局切换器
            layoutSwitcher: document.querySelector('.layout-switcher'),
            
            // 统计显示
            networkType: document.getElementById('networkType'),
            bandwidth: document.getElementById('bandwidth'),
            rtt: document.getElementById('rtt'),
            downlink: document.getElementById('downlink'),
            activeStreamCount: document.getElementById('activeStreamCount'),
            totalBandwidthUsage: document.getElementById('totalBandwidthUsage'),
            averageFps: document.getElementById('averageFps'),
            averagePacketLoss: document.getElementById('averagePacketLoss'),
            networkUtilization: document.getElementById('networkUtilization'),
            recommendedLayout: document.getElementById('recommendedLayout'),
            
            // 建议和日志
            recommendationsList: document.getElementById('recommendationsList'),
            refreshRecommendations: document.getElementById('refreshRecommendations'),
            logContainer: document.getElementById('logContainer'),
            btnClearLog: document.getElementById('btnClearLog'),
            
            // 弹窗
            recommendationModal: document.getElementById('recommendationModal'),
            modalRecommendations: document.getElementById('modalRecommendations'),
            applyRecommendations: document.getElementById('applyRecommendations'),
            ignoreRecommendations: document.getElementById('ignoreRecommendations')
        };

        // 核心模块
        this.networkMonitor = null;
        this.multiViewManager = null;
        this.multiStreamStats = null;
        this.smartQualityController = null;

        // 应用状态
        this.currentLayout = 'single';
        this.autoOptimizeEnabled = false;
        this.lastRecommendations = null;

        // 配置
        this.config = {
            // WebRTC 播放器配置
            playerConfig: {
                apiBaseUrl: 'https://glythgb.xmrbi.com/index/api/webrtc',
                streamApp: 'live',
                streamPrefix: 'stream/wrj/pri/8UUXN4R00A06RS_165-0-7',
                streamType: 'play',
                qualitySuffix: '',
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            },
            
            // 流配置
            streamConfig: {
                baseStreamId: 'stream/wrj/pri/8UUXN4R00A06RS_165-0-7',
                useMultipleStreams: false // 使用同一个流
            },
            
            // 自动优化配置
            autoOptimize: {
                enabled: true,
                intervalMs: 5000,
                aggressiveMode: false
            }
        };

        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        console.log('多视图应用初始化...');

        try {
            // 初始化核心模块
            await this.initializeModules();
            
            // 绑定事件监听
            this.bindEvents();
            
            // 启动网络监测
            this.startNetworkMonitoring();
            
            // 启动多流统计
            this.startMultiStreamStats();
            
            // 设置默认布局
            await this.switchLayout('single');

            console.log('多视图应用初始化完成');
            this.addLog('应用初始化完成', 'success');

        } catch (error) {
            console.error('应用初始化失败:', error);
            this.showError('应用初始化失败，请刷新页面重试');
        }
    }

    /**
     * 初始化核心模块
     */
    async initializeModules() {
        // 初始化网络监测器
        this.networkMonitor = new NetworkMonitor();
        
        // 初始化多视图管理器
        this.multiViewManager = new MultiViewManager(this.elements.multiViewContainer, {
            defaultLayout: this.currentLayout,
            streamConfig: this.config.streamConfig,
            playerConfig: this.config.playerConfig,
            autoSwitchEnabled: false // 由智能控制器管理
        });

        // 初始化多流统计收集器
        this.multiStreamStats = new MultiStreamStatsCollector({
            interval: 2000,
            historyDuration: 60000
        });

        // 初始化智能画质控制器
        this.smartQualityController = new SmartQualityController({
            switchCooldown: 10000,
            stabilityPeriod: 5000
        });

        // 设置模块间的关联
        this.smartQualityController.setNetworkMonitor(this.networkMonitor);
        this.smartQualityController.setMultiStreamStats(this.multiStreamStats);
    }

    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 布局切换按钮
        this.elements.layoutSingle.addEventListener('click', () => {
            this.switchLayout('single');
        });

        this.elements.layoutGrid4.addEventListener('click', () => {
            this.switchLayout('grid4');
        });

        this.elements.layoutGrid9.addEventListener('click', () => {
            this.switchLayout('grid9');
        });

        // 全局控制按钮
        this.elements.connectAll.addEventListener('click', () => {
            this.connectAll();
        });

        this.elements.disconnectAll.addEventListener('click', () => {
            this.disconnectAll();
        });

        this.elements.autoOptimize.addEventListener('click', () => {
            this.toggleAutoOptimize();
        });

        // 布局切换器（悬浮）
        const layoutBtns = this.elements.layoutSwitcher.querySelectorAll('.layout-btn');
        layoutBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const layout = btn.dataset.layout;
                this.switchLayout(layout);
            });
        });

        // 建议相关
        this.elements.refreshRecommendations.addEventListener('click', () => {
            this.refreshRecommendations();
        });

        this.elements.applyRecommendations.addEventListener('click', () => {
            this.applyRecommendations();
        });

        this.elements.ignoreRecommendations.addEventListener('click', () => {
            this.hideRecommendationModal();
        });

        // 清空日志
        this.elements.btnClearLog.addEventListener('click', () => {
            this.clearLog();
        });

        // 弹窗关闭
        const modalClose = this.elements.recommendationModal.querySelector('.modal-close');
        modalClose.addEventListener('click', () => {
            this.hideRecommendationModal();
        });

        // 模块事件监听
        this.bindModuleEvents();
    }

    /**
     * 绑定模块事件
     */
    bindModuleEvents() {
        // 网络监测事件
        this.networkMonitor.addListener((data) => {
            this.handleNetworkUpdate(data);
        });

        // 多视图管理器事件
        this.multiViewManager.on('layoutChange', (event) => {
            this.handleLayoutChange(event);
        });

        this.multiViewManager.on('streamStats', (event) => {
            this.handleStreamStats(event);
        });

        this.multiViewManager.on('qualitySwitch', (event) => {
            this.handleQualitySwitch(event);
        });

        this.multiViewManager.on('error', (event) => {
            this.handleError(event);
        });

        // 多流统计事件
        this.multiStreamStats.on('statsUpdate', (event) => {
            this.handleMultiStreamStatsUpdate(event);
        });

        this.multiStreamStats.on('networkChange', (event) => {
            this.handleNetworkChange(event);
        });

        // 智能画质控制器事件
        this.smartQualityController.on('qualityRecommendation', (event) => {
            this.handleQualityRecommendation(event);
        });

        this.smartQualityController.on('batchRecommendation', (event) => {
            this.handleBatchRecommendation(event);
        });
    }

    /**
     * 启动网络监测
     */
    startNetworkMonitoring() {
        console.log('启动网络监测...');
        // 网络监测会自动启动
    }

    /**
     * 启动多流统计
     */
    startMultiStreamStats() {
        console.log('启动多流统计...');
        this.multiStreamStats.start();
    }

    /**
     * 切换布局
     * @param {string} layout - 布局类型
     */
    async switchLayout(layout) {
        if (layout === this.currentLayout) {
            return;
        }

        console.log(`切换布局: ${this.currentLayout} -> ${layout}`);

        try {
            // 更新按钮状态
            this.updateLayoutButtons(layout);
            
            // 切换多视图管理器布局
            await this.multiViewManager.switchLayout(layout);
            
            // 通知智能控制器布局变化
            this.smartQualityController.updateLayout(layout);
            
            this.currentLayout = layout;
            this.addLog(`布局切换到${this.getLayoutName(layout)}`, 'info');

        } catch (error) {
            console.error('布局切换失败:', error);
            this.showError('布局切换失败');
        }
    }

    /**
     * 连接所有视图
     */
    async connectAll() {
        console.log('连接所有视图...');
        
        this.addLog('开始连接所有视频流...', 'info');
        
        const layout = this.multiViewManager.getCurrentLayout();
        const viewCount = this.multiViewManager.layouts[layout].count;

        for (let i = 0; i < viewCount; i++) {
            try {
                await this.multiViewManager.connectView(i);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 间隔连接
            } catch (error) {
                console.error(`连接视图 ${i} 失败:`, error);
            }
        }

        this.addLog('所有视频流连接完成', 'success');
    }

    /**
     * 断开所有视图
     */
    disconnectAll() {
        console.log('断开所有视图...');
        
        const layout = this.multiViewManager.getCurrentLayout();
        const viewCount = this.multiViewManager.layouts[layout].count;

        for (let i = 0; i < viewCount; i++) {
            this.multiViewManager.disconnectView(i);
        }

        this.addLog('所有视频流已断开', 'info');
    }

    /**
     * 切换自动优化
     */
    toggleAutoOptimize() {
        this.autoOptimizeEnabled = !this.autoOptimizeEnabled;
        
        const btn = this.elements.autoOptimize;
        if (this.autoOptimizeEnabled) {
            btn.className = 'btn btn-secondary';
            btn.innerHTML = '<span>🤖 自动优化 (开启)</span>';
            this.addLog('启用智能自动优化', 'success');
        } else {
            btn.className = 'btn btn-default';
            btn.innerHTML = '<span>🤖 智能优化</span>';
            this.addLog('禁用智能自动优化', 'info');
        }

        console.log('自动优化状态:', this.autoOptimizeEnabled);
    }

    /**
     * 处理网络更新
     * @param {Object} data - 网络数据
     */
    handleNetworkUpdate(data) {
        const { networkInfo, quality } = data;

        // 更新网络UI
        this.elements.networkType.textContent = networkInfo.effectiveType.toUpperCase();
        this.elements.bandwidth.textContent = `${networkInfo.downlink.toFixed(1)} Mbps`;
        this.elements.rtt.textContent = `${networkInfo.rtt} ms`;
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
     * 处理布局变化
     * @param {Object} event - 布局变化事件
     */
    handleLayoutChange(event) {
        console.log('布局变化:', event);
        this.addLog(`布局变更：${this.getLayoutName(event.to)} (${event.viewCount}个视图)`, 'info');
    }

    /**
     * 处理流统计
     * @param {Object} event - 流统计事件
     */
    handleStreamStats(event) {
        // 将流统计数据传递给多流统计收集器
        // 这里可以根据需要进行数据转换
    }

    /**
     * 处理质量切换
     * @param {Object} event - 质量切换事件
     */
    handleQualitySwitch(event) {
        const { viewIndex, quality, isAuto, recommendedQuality, reason } = event;
        
        if (recommendedQuality && reason) {
            // 这是一个建议，不是实际切换
            this.addLog(`视图 ${viewIndex + 1} 建议：${reason}`, 'warning');
        } else {
            // 实际的质量切换
            const modeText = isAuto ? '自动' : '手动';
            this.addLog(`视图 ${viewIndex + 1} ${modeText}切换到 ${quality}`, 'switch');
        }
    }

    /**
     * 处理错误
     * @param {Object} event - 错误事件
     */
    handleError(event) {
        console.error('多视图错误:', event);
        this.addLog(`错误: ${event.message}`, 'error');
        this.showError(event.message);
    }

    /**
     * 处理多流统计更新
     * @param {Object} event - 统计更新事件
     */
    handleMultiStreamStatsUpdate(event) {
        const { aggregated, network, recommendations } = event;

        // 更新多流统计UI
        if (aggregated) {
            this.elements.activeStreamCount.textContent = 
                `${event.activeStreams}/${aggregated.totalStreams}`;
            this.elements.totalBandwidthUsage.textContent = 
                `${(aggregated.totalBandwidth / 1000).toFixed(1)} Mbps`;
            this.elements.averageFps.textContent = `${aggregated.averageFps} fps`;
            this.elements.averagePacketLoss.textContent = `${aggregated.averagePacketLoss}%`;
            this.elements.networkUtilization.textContent = `${aggregated.networkUtilization}%`;
        }

        // 更新网络评估
        if (network) {
            this.updateOverallStatus(network.overall);
            this.updateRecommendedLayout(network);
        }

        // 处理建议
        if (recommendations && recommendations.length > 0) {
            this.updateRecommendations(recommendations);
            
            // 如果启用自动优化，自动应用建议
            if (this.autoOptimizeEnabled) {
                this.autoApplyRecommendations(recommendations);
            }
        }
    }

    /**
     * 处理网络变化
     * @param {Object} event - 网络变化事件
     */
    handleNetworkChange(event) {
        console.log('网络状况变化:', event);
        this.addLog(`网络状况变化: ${event.changeType}`, 'warning');
    }

    /**
     * 处理质量建议
     * @param {Object} event - 质量建议事件
     */
    handleQualityRecommendation(event) {
        console.log('收到质量建议:', event);
        
        if (this.autoOptimizeEnabled) {
            // 自动应用建议
            this.applyQualityRecommendation(event);
        } else {
            // 仅显示建议
            this.showQualityRecommendation(event);
        }
    }

    /**
     * 处理批量建议
     * @param {Object} event - 批量建议事件
     */
    handleBatchRecommendation(event) {
        console.log('收到批量建议:', event);
        
        this.lastRecommendations = event;
        
        if (this.autoOptimizeEnabled && event.strategy.priority === 'high') {
            // 高优先级建议自动应用
            this.applyBatchRecommendations(event);
        } else {
            // 显示建议弹窗
            this.showRecommendationModal(event);
        }
    }

    /**
     * 更新整体状态
     * @param {string} status - 状态
     */
    updateOverallStatus(status) {
        const statusMap = {
            'excellent': { text: '优秀', class: 'status-success' },
            'good': { text: '良好', class: 'status-success' },
            'fair': { text: '一般', class: 'status-warning' },
            'poor': { text: '较差', class: 'status-error' }
        };

        const config = statusMap[status] || statusMap.fair;
        this.elements.overallStatus.textContent = config.text;
        this.elements.overallStatus.className = `status-tag ${config.class}`;
    }

    /**
     * 更新推荐布局
     * @param {Object} network - 网络评估
     */
    updateRecommendedLayout(network) {
        // 这里可以根据网络状况推荐最优布局
        const bandwidthMbps = parseFloat(network.metrics?.totalBandwidthUsage) || 0;
        
        let recommendedLayout = 'single';
        if (bandwidthMbps < 2) {
            recommendedLayout = 'single';
        } else if (bandwidthMbps < 8) {
            recommendedLayout = 'grid4';
        } else {
            recommendedLayout = 'grid9';
        }

        const layoutNames = {
            single: '单视图',
            grid4: '四宫格',
            grid9: '九宫格'
        };

        this.elements.recommendedLayout.textContent = layoutNames[recommendedLayout];
    }

    /**
     * 更新建议列表
     * @param {Array} recommendations - 建议列表
     */
    updateRecommendations(recommendations) {
        const container = this.elements.recommendationsList;
        container.innerHTML = '';

        if (recommendations.length === 0) {
            container.innerHTML = `
                <div class="recommendation-item info">
                    <div class="recommendation-icon">✅</div>
                    <div class="recommendation-content">
                        <div class="recommendation-title">运行状态良好</div>
                        <div class="recommendation-desc">当前网络和视频质量稳定，无需调整</div>
                    </div>
                </div>
            `;
            return;
        }

        recommendations.forEach(rec => {
            const item = this.createRecommendationItem(rec);
            container.appendChild(item);
        });
    }

    /**
     * 创建建议项目
     * @param {Object} recommendation - 建议
     * @returns {HTMLElement} 建议元素
     */
    createRecommendationItem(recommendation) {
        const item = document.createElement('div');
        item.className = `recommendation-item ${this.getRecommendationType(recommendation)}`;

        const iconMap = {
            emergency_quality_reduction: '🚨',
            conservative_optimization: '⚡',
            quality_enhancement: '📈',
            balanced_optimization: '⚖️',
            global_optimization: '🌍'
        };

        const icon = iconMap[recommendation.type] || '💡';

        item.innerHTML = `
            <div class="recommendation-icon">${icon}</div>
            <div class="recommendation-content">
                <div class="recommendation-title">${this.getRecommendationTitle(recommendation)}</div>
                <div class="recommendation-desc">${recommendation.reason}</div>
                <div class="recommendation-meta">
                    置信度: ${Math.round((recommendation.confidence || 0) * 100)}%
                </div>
            </div>
        `;

        return item;
    }

    /**
     * 获取建议类型CSS类
     * @param {Object} recommendation - 建议
     * @returns {string} CSS类名
     */
    getRecommendationType(recommendation) {
        if (recommendation.type?.includes('emergency')) {
            return 'error';
        } else if (recommendation.type?.includes('enhancement')) {
            return 'success';
        } else {
            return 'warning';
        }
    }

    /**
     * 获取建议标题
     * @param {Object} recommendation - 建议
     * @returns {string} 标题
     */
    getRecommendationTitle(recommendation) {
        const titleMap = {
            emergency_quality_reduction: '紧急画质降级',
            conservative_optimization: '保守优化',
            quality_enhancement: '画质提升',
            balanced_optimization: '平衡优化',
            global_optimization: '全局优化'
        };

        return titleMap[recommendation.type] || '智能建议';
    }

    /**
     * 刷新建议
     */
    refreshRecommendations() {
        console.log('刷新智能建议...');
        
        const batchRecommendation = this.smartQualityController.generateBatchRecommendations();
        if (batchRecommendation) {
            this.handleBatchRecommendation(batchRecommendation);
        }

        this.addLog('已刷新智能建议', 'info');
    }

    /**
     * 应用建议
     */
    async applyRecommendations() {
        if (!this.lastRecommendations) {
            console.warn('没有待应用的建议');
            return;
        }

        console.log('应用智能建议...');
        
        try {
            await this.applyBatchRecommendations(this.lastRecommendations);
            this.hideRecommendationModal();
            this.addLog('智能建议已应用', 'success');
        } catch (error) {
            console.error('应用建议失败:', error);
            this.addLog('应用建议失败', 'error');
        }
    }

    /**
     * 应用批量建议
     * @param {Object} batchRecommendation - 批量建议
     */
    async applyBatchRecommendations(batchRecommendation) {
        const { recommendations } = batchRecommendation;

        // 先应用立即建议
        for (const rec of recommendations.immediate) {
            await this.applyQualityRecommendation(rec);
            await new Promise(resolve => setTimeout(resolve, 500)); // 间隔应用
        }

        // 再应用渐进建议
        for (const rec of recommendations.gradual) {
            await this.applyQualityRecommendation(rec);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 更长间隔
        }
    }

    /**
     * 应用质量建议
     * @param {Object} recommendation - 质量建议
     */
    async applyQualityRecommendation(recommendation) {
        const { streamIndex, recommendedQuality } = recommendation;
        
        try {
            await this.multiViewManager.changeViewQuality(streamIndex, recommendedQuality);
            
            // 报告切换结果给智能控制器
            this.smartQualityController.reportSwitchResult(
                `view_${streamIndex}`, 
                true, 
                { newQuality: recommendedQuality }
            );
            
        } catch (error) {
            console.error('应用质量建议失败:', error);
            
            // 报告失败
            this.smartQualityController.reportSwitchResult(
                `view_${streamIndex}`, 
                false, 
                { error: error.message }
            );
        }
    }

    /**
     * 自动应用建议
     * @param {Array} recommendations - 建议列表
     */
    async autoApplyRecommendations(recommendations) {
        console.log('自动应用建议:', recommendations.length);
        
        for (const rec of recommendations) {
            if (rec.confidence > 0.8) { // 只自动应用高置信度建议
                await this.applyQualityRecommendation(rec);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    /**
     * 显示质量建议
     * @param {Object} recommendation - 质量建议
     */
    showQualityRecommendation(recommendation) {
        const { streamIndex, recommendedQuality, reason, confidence } = recommendation;
        
        this.addLog(
            `视图 ${streamIndex + 1} 建议切换到 ${recommendedQuality}: ${reason} (置信度: ${Math.round(confidence * 100)}%)`,
            'warning'
        );
    }

    /**
     * 显示建议弹窗
     * @param {Object} batchRecommendation - 批量建议
     */
    showRecommendationModal(batchRecommendation) {
        const modal = this.elements.recommendationModal;
        const content = this.elements.modalRecommendations;

        // 生成弹窗内容
        content.innerHTML = this.generateModalRecommendationContent(batchRecommendation);

        // 显示弹窗
        modal.style.display = 'flex';
    }

    /**
     * 隐藏建议弹窗
     */
    hideRecommendationModal() {
        this.elements.recommendationModal.style.display = 'none';
    }

    /**
     * 生成弹窗建议内容
     * @param {Object} batchRecommendation - 批量建议
     * @returns {string} HTML内容
     */
    generateModalRecommendationContent(batchRecommendation) {
        const { strategy, recommendations, networkAssessment } = batchRecommendation;

        let html = `
            <div class="recommendation-summary">
                <h4>优化策略: ${this.getStrategyName(strategy.type)}</h4>
                <p>优先级: ${this.getPriorityName(strategy.priority)}</p>
                <p>置信度: ${Math.round(strategy.confidence * 100)}%</p>
                <p>网络状况: ${networkAssessment?.overall || '未知'}</p>
            </div>
            <div class="recommendation-details">
        `;

        // 立即建议
        if (recommendations.immediate.length > 0) {
            html += '<h5>🚨 立即执行建议:</h5><ul>';
            recommendations.immediate.forEach(rec => {
                html += `<li>${this.formatRecommendation(rec)}</li>`;
            });
            html += '</ul>';
        }

        // 渐进建议
        if (recommendations.gradual.length > 0) {
            html += '<h5>⚡ 渐进优化建议:</h5><ul>';
            recommendations.gradual.forEach(rec => {
                html += `<li>${this.formatRecommendation(rec)}</li>`;
            });
            html += '</ul>';
        }

        // 备选建议
        if (recommendations.fallback.length > 0) {
            html += '<h5>🔄 备选方案:</h5><ul>';
            recommendations.fallback.forEach(rec => {
                html += `<li>${this.formatRecommendation(rec)}</li>`;
            });
            html += '</ul>';
        }

        html += '</div>';
        return html;
    }

    /**
     * 格式化建议文本
     * @param {Object} recommendation - 建议
     * @returns {string} 格式化文本
     */
    formatRecommendation(recommendation) {
        const { streamIndex, currentQuality, recommendedQuality, reason, confidence } = recommendation;
        
        if (streamIndex !== undefined) {
            return `视图 ${streamIndex + 1}: ${currentQuality} → ${recommendedQuality} (${reason})`;
        } else {
            return reason || '无具体描述';
        }
    }

    /**
     * 获取策略名称
     * @param {string} strategyType - 策略类型
     * @returns {string} 策略名称
     */
    getStrategyName(strategyType) {
        const names = {
            emergency_downgrade: '紧急降级',
            conservative_optimization: '保守优化',
            quality_enhancement: '质量提升',
            balanced_optimization: '平衡优化'
        };
        return names[strategyType] || strategyType;
    }

    /**
     * 获取优先级名称
     * @param {string} priority - 优先级
     * @returns {string} 优先级名称
     */
    getPriorityName(priority) {
        const names = {
            high: '高',
            medium: '中',
            low: '低'
        };
        return names[priority] || priority;
    }

    /**
     * 更新布局按钮状态
     * @param {string} activeLayout - 当前布局
     */
    updateLayoutButtons(activeLayout) {
        // 更新主控制按钮
        const layoutButtons = [
            { element: this.elements.layoutSingle, layout: 'single' },
            { element: this.elements.layoutGrid4, layout: 'grid4' },
            { element: this.elements.layoutGrid9, layout: 'grid9' }
        ];

        layoutButtons.forEach(({ element, layout }) => {
            if (layout === activeLayout) {
                element.className = 'btn btn-secondary';
            } else {
                element.className = 'btn btn-default';
            }
        });

        // 更新悬浮切换器
        const switcherButtons = this.elements.layoutSwitcher.querySelectorAll('.layout-btn');
        switcherButtons.forEach(btn => {
            if (btn.dataset.layout === activeLayout) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 获取布局名称
     * @param {string} layout - 布局类型
     * @returns {string} 布局名称
     */
    getLayoutName(layout) {
        const names = {
            single: '单视图',
            grid4: '四宫格',
            grid9: '九宫格'
        };
        return names[layout] || layout;
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
    }

    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     */
    showError(message) {
        // 这里可以实现更复杂的错误显示逻辑
        console.error('应用错误:', message);
        
        // 简单的错误提示
        if (typeof alert !== 'undefined') {
            alert(`错误: ${message}`);
        }
    }

    /**
     * 销毁应用
     */
    destroy() {
        console.log('销毁多视图应用...');

        // 销毁模块
        if (this.multiViewManager) {
            this.multiViewManager.destroy();
        }
        if (this.multiStreamStats) {
            this.multiStreamStats.destroy();
        }
        if (this.smartQualityController) {
            this.smartQualityController.destroy();
        }

        console.log('多视图应用已销毁');
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.multiViewApp = new MultiViewApplication();
        console.log('多视图应用启动成功');
    } catch (error) {
        console.error('多视图应用启动失败:', error);
        alert('应用启动失败，请刷新页面重试');
    }
});

// 导出为全局变量
if (typeof window !== 'undefined') {
    window.MultiViewApplication = MultiViewApplication;
}