/**
 * 多视图布局管理器
 * 职责：管理单个/四宫格/九宫格视频布局，协调多路视频流
 * 原则：单一职责（SOLID-S）- 只负责视图布局和多路流管理
 */
class MultiViewManager {
    constructor(containerElement, config = {}) {
        this.container = containerElement;
        this.config = {
            // 默认布局类型
            defaultLayout: config.defaultLayout || 'single',
            // 视频流配置
            streamConfig: config.streamConfig || {},
            // WebRTC 播放器配置
            playerConfig: config.playerConfig || {},
            // 自动切换配置
            autoSwitchEnabled: config.autoSwitchEnabled !== false,
            ...config
        };

        // 当前状态
        this.currentLayout = this.config.defaultLayout;
        this.videoPlayers = new Map(); // 视频播放器实例映射
        this.viewStats = new Map(); // 每个视图的统计信息
        this.activeStreams = new Set(); // 活跃的流ID集合
        
        // 布局配置
        this.layouts = {
            single: { count: 1, grid: '1x1' },
            grid4: { count: 4, grid: '2x2' },
            grid9: { count: 9, grid: '3x3' }
        };

        // 事件监听器
        this.listeners = {
            layoutChange: [],
            streamStats: [],
            qualitySwitch: [],
            error: []
        };

        this.init();
    }

    /**
     * 初始化多视图管理器
     */
    init() {
        console.log('多视图管理器初始化...');
        
        // 创建布局容器
        this.createLayoutContainer();
        
        // 设置默认布局
        this.switchLayout(this.currentLayout);
        
        console.log('多视图管理器初始化完成');
    }

    /**
     * 创建布局容器
     */
    createLayoutContainer() {
        this.container.innerHTML = '';
        this.container.className = 'multi-view-container';

        // 创建视频网格容器
        this.gridContainer = document.createElement('div');
        this.gridContainer.className = 'video-grid';
        this.container.appendChild(this.gridContainer);

        // 创建统计悬浮面板
        this.createStatsOverlay();
    }

    /**
     * 创建统计悬浮面板
     */
    createStatsOverlay() {
        this.statsOverlay = document.createElement('div');
        this.statsOverlay.className = 'stats-overlay';
        this.statsOverlay.innerHTML = `
            <div class="stats-header">
                <h4>多流统计总览</h4>
                <button class="stats-toggle">📊</button>
            </div>
            <div class="stats-content">
                <div class="overall-stats">
                    <div class="stat-item">
                        <label>总带宽消耗:</label>
                        <span id="totalBandwidth">0 Mbps</span>
                    </div>
                    <div class="stat-item">
                        <label>活跃流数量:</label>
                        <span id="activeStreams">0/0</span>
                    </div>
                    <div class="stat-item">
                        <label>推荐布局:</label>
                        <span id="recommendedLayout">单个视图</span>
                    </div>
                    <div class="stat-item">
                        <label>网络质量:</label>
                        <span id="networkQuality" class="quality-indicator">优秀</span>
                    </div>
                </div>
                <div class="streams-list" id="streamsList"></div>
            </div>
        `;
        this.container.appendChild(this.statsOverlay);

        // 绑定统计面板切换事件
        const toggleBtn = this.statsOverlay.querySelector('.stats-toggle');
        toggleBtn.addEventListener('click', () => {
            this.statsOverlay.classList.toggle('expanded');
        });
    }

    /**
     * 切换布局
     * @param {string} layoutType - 布局类型: 'single', 'grid4', 'grid9'
     */
    async switchLayout(layoutType) {
        if (!this.layouts[layoutType]) {
            console.error('不支持的布局类型:', layoutType);
            return;
        }

        console.log(`切换布局: ${this.currentLayout} -> ${layoutType}`);

        const previousLayout = this.currentLayout;
        this.currentLayout = layoutType;
        const layout = this.layouts[layoutType];

        try {
            // 更新网格样式
            this.updateGridLayout(layout);

            // 创建视频视图
            await this.createVideoViews(layout.count);

            // 触发布局变化事件
            this.emit('layoutChange', {
                from: previousLayout,
                to: layoutType,
                viewCount: layout.count
            });

            console.log(`布局切换完成: ${layoutType} (${layout.count}个视图)`);

        } catch (error) {
            console.error('布局切换失败:', error);
            this.emit('error', { message: '布局切换失败', error });
        }
    }

    /**
     * 更新网格布局样式
     * @param {Object} layout - 布局配置
     */
    updateGridLayout(layout) {
        const { grid } = layout;
        const [cols, rows] = grid.split('x').map(Number);

        this.gridContainer.className = `video-grid grid-${cols}x${rows}`;
        this.gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        this.gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    }

    /**
     * 创建视频视图
     * @param {number} viewCount - 视图数量
     */
    async createVideoViews(viewCount) {
        // 清空现有视图
        this.clearVideoViews();

        // 创建新视图
        for (let i = 0; i < viewCount; i++) {
            await this.createSingleView(i);
        }
    }

    /**
     * 创建单个视频视图
     * @param {number} index - 视图索引
     */
    async createSingleView(index) {
        const viewId = `view_${index}`;
        
        // 创建视图容器
        const viewContainer = document.createElement('div');
        viewContainer.className = 'video-view';
        viewContainer.dataset.index = index;

        // 创建视频元素
        const videoElement = document.createElement('video');
        videoElement.id = `video_${index}`;
        videoElement.autoplay = true;
        videoElement.playsinline = true;
        videoElement.muted = true;

        // 创建视图覆盖层
        const overlayElement = document.createElement('div');
        overlayElement.className = 'view-overlay';
        overlayElement.innerHTML = `
            <div class="view-info">
                <span class="view-index">#${index + 1}</span>
                <span class="view-quality" id="quality_${index}">--</span>
                <span class="view-status" id="status_${index}">未连接</span>
            </div>
            <div class="view-stats" id="stats_${index}">
                <div class="stat-row">
                    <span>码率: <span id="bitrate_${index}">-- kbps</span></span>
                    <span>帧率: <span id="fps_${index}">-- fps</span></span>
                </div>
                <div class="stat-row">
                    <span>分辨率: <span id="resolution_${index}">--</span></span>
                    <span>丢包: <span id="loss_${index}">--%</span></span>
                </div>
            </div>
            <div class="view-controls">
                <button class="view-btn" data-action="connect" data-view="${index}">连接</button>
                <button class="view-btn" data-action="disconnect" data-view="${index}" style="display:none;">断开</button>
                <select class="quality-select" data-view="${index}">
                    <option value="auto">自动</option>
                    <option value="1080p">1080P</option>
                    <option value="720p">720P</option>
                    <option value="480p">480P</option>
                </select>
            </div>
        `;

        viewContainer.appendChild(videoElement);
        viewContainer.appendChild(overlayElement);
        this.gridContainer.appendChild(viewContainer);

        // 绑定视图控制事件
        this.bindViewEvents(viewContainer, index);

        // 初始化视图统计
        this.viewStats.set(viewId, {
            index,
            connected: false,
            quality: 'auto',
            stats: {},
            lastUpdate: Date.now()
        });
    }

    /**
     * 绑定视图事件
     * @param {HTMLElement} viewContainer - 视图容器
     * @param {number} index - 视图索引
     */
    bindViewEvents(viewContainer, index) {
        const connectBtn = viewContainer.querySelector('[data-action="connect"]');
        const disconnectBtn = viewContainer.querySelector('[data-action="disconnect"]');
        const qualitySelect = viewContainer.querySelector('.quality-select');

        // 连接按钮事件
        connectBtn.addEventListener('click', () => {
            this.connectView(index);
        });

        // 断开按钮事件
        disconnectBtn.addEventListener('click', () => {
            this.disconnectView(index);
        });

        // 质量选择事件
        qualitySelect.addEventListener('change', (e) => {
            this.changeViewQuality(index, e.target.value);
        });
    }

    /**
     * 连接指定视图
     * @param {number} index - 视图索引
     */
    async connectView(index) {
        const viewId = `view_${index}`;
        const videoElement = document.getElementById(`video_${index}`);
        
        if (!videoElement) {
            console.error(`视图 ${index} 的视频元素不存在`);
            return;
        }

        try {
            console.log(`连接视图 ${index}...`);

            // 更新状态
            this.updateViewStatus(index, '连接中...');

            // 创建 WebRTC 播放器实例
            const player = new WebRTCPlayerHTTP(videoElement, {
                ...this.config.playerConfig,
                // 每个视图使用不同的流ID（可以配置为同一个流的不同质量）
                streamPrefix: this.getStreamId(index)
            });

            // 监听播放器事件
            this.bindPlayerEvents(player, index);

            // 保存播放器实例
            this.videoPlayers.set(viewId, player);

            // 获取推荐质量
            const quality = this.getRecommendedQuality(index);
            
            // 连接播放器
            await player.connect(quality);

            // 更新视图状态
            const viewStats = this.viewStats.get(viewId);
            viewStats.connected = true;
            viewStats.quality = quality;
            this.activeStreams.add(viewId);

            // 更新UI
            this.updateViewControls(index, true);
            this.updateViewStatus(index, '已连接');
            this.updateViewQuality(index, quality);

            console.log(`视图 ${index} 连接成功`);

        } catch (error) {
            console.error(`视图 ${index} 连接失败:`, error);
            this.updateViewStatus(index, '连接失败');
            this.emit('error', { message: `视图 ${index} 连接失败`, error });
        }
    }

    /**
     * 断开指定视图
     * @param {number} index - 视图索引
     */
    disconnectView(index) {
        const viewId = `view_${index}`;
        const player = this.videoPlayers.get(viewId);

        if (player) {
            console.log(`断开视图 ${index}...`);

            // 断开播放器
            player.disconnect();
            player.destroy();

            // 清理状态
            this.videoPlayers.delete(viewId);
            this.activeStreams.delete(viewId);

            const viewStats = this.viewStats.get(viewId);
            if (viewStats) {
                viewStats.connected = false;
                viewStats.stats = {};
            }

            // 更新UI
            this.updateViewControls(index, false);
            this.updateViewStatus(index, '未连接');
            this.clearViewStats(index);

            console.log(`视图 ${index} 已断开`);
        }
    }

    /**
     * 更改视图质量
     * @param {number} index - 视图索引
     * @param {string} quality - 新质量
     */
    async changeViewQuality(index, quality) {
        const viewId = `view_${index}`;
        const player = this.videoPlayers.get(viewId);

        if (!player) {
            console.warn(`视图 ${index} 未连接，无法切换质量`);
            return;
        }

        try {
            console.log(`视图 ${index} 切换质量: ${quality}`);

            if (quality === 'auto') {
                // 启用自动质量
                const recommendedQuality = this.getRecommendedQuality(index);
                await player.switchQuality(recommendedQuality);
            } else {
                // 手动质量
                await player.switchQuality(quality);
            }

            // 更新状态
            const viewStats = this.viewStats.get(viewId);
            viewStats.quality = quality;
            this.updateViewQuality(index, quality);

            // 触发质量切换事件
            this.emit('qualitySwitch', {
                viewIndex: index,
                quality,
                isAuto: quality === 'auto'
            });

        } catch (error) {
            console.error(`视图 ${index} 质量切换失败:`, error);
        }
    }

    /**
     * 绑定播放器事件
     * @param {WebRTCPlayerHTTP} player - 播放器实例
     * @param {number} index - 视图索引
     */
    bindPlayerEvents(player, index) {
        const viewId = `view_${index}`;

        // 状态变化
        player.on('stateChange', (event) => {
            const { state, quality } = event;
            console.log(`视图 ${index} 状态变化:`, state, quality);

            switch (state) {
                case 'connecting':
                    this.updateViewStatus(index, '连接中...');
                    break;
                case 'connected':
                    this.updateViewStatus(index, '已连接');
                    if (quality) {
                        this.updateViewQuality(index, quality);
                    }
                    break;
                case 'disconnected':
                    this.updateViewStatus(index, '未连接');
                    break;
                case 'error':
                    this.updateViewStatus(index, '错误');
                    break;
            }
        });

        // 统计就绪
        player.on('statsReady', (peerConnection) => {
            console.log(`视图 ${index} 统计就绪`);
            this.setupViewStatsCollection(index, peerConnection);
        });

        // 错误处理
        player.on('error', (event) => {
            console.error(`视图 ${index} 播放器错误:`, event);
            this.updateViewStatus(index, '错误');
        });
    }

    /**
     * 设置视图统计采集
     * @param {number} index - 视图索引
     * @param {RTCPeerConnection} peerConnection - PeerConnection实例
     */
    setupViewStatsCollection(index, peerConnection) {
        const viewId = `view_${index}`;
        
        // 创建统计采集器
        const statsCollector = new WebRTCStatsCollector(peerConnection, 1000);
        
        // 监听统计数据
        statsCollector.addListener((data) => {
            this.updateViewStats(index, data);
        });

        // 启动采集
        statsCollector.start();

        // 保存采集器实例（用于清理）
        const viewStats = this.viewStats.get(viewId);
        if (viewStats) {
            viewStats.statsCollector = statsCollector;
        }
    }

    /**
     * 更新视图统计
     * @param {number} index - 视图索引
     * @param {Object} data - 统计数据
     */
    updateViewStats(index, data) {
        const viewId = `view_${index}`;
        const { stats, quality } = data;

        // 更新内存中的统计
        const viewStats = this.viewStats.get(viewId);
        if (viewStats) {
            viewStats.stats = stats;
            viewStats.lastUpdate = Date.now();
        }

        // 更新UI显示
        this.updateViewStatsUI(index, stats);

        // 更新总览统计
        this.updateOverallStats();

        // 触发统计事件
        this.emit('streamStats', {
            viewIndex: index,
            stats,
            quality
        });

        // 自动质量调整（如果启用）
        if (this.config.autoSwitchEnabled) {
            this.autoAdjustQuality(index, stats, quality);
        }
    }

    /**
     * 更新视图统计UI
     * @param {number} index - 视图索引
     * @param {Object} stats - 统计数据
     */
    updateViewStatsUI(index, stats) {
        // 更新码率
        const bitrateElement = document.getElementById(`bitrate_${index}`);
        if (bitrateElement) {
            bitrateElement.textContent = `${stats.videoBitrate} kbps`;
        }

        // 更新帧率
        const fpsElement = document.getElementById(`fps_${index}`);
        if (fpsElement) {
            fpsElement.textContent = `${stats.videoFps} fps`;
        }

        // 更新分辨率
        const resolutionElement = document.getElementById(`resolution_${index}`);
        if (resolutionElement) {
            resolutionElement.textContent = `${stats.resolution.width}x${stats.resolution.height}`;
        }

        // 更新丢包率
        const lossElement = document.getElementById(`loss_${index}`);
        if (lossElement) {
            lossElement.textContent = `${stats.packetLossRate}%`;
        }
    }

    /**
     * 更新总览统计
     */
    updateOverallStats() {
        let totalBandwidth = 0;
        let activeCount = 0;
        let goodQualityCount = 0;

        // 计算总览数据
        this.viewStats.forEach((viewStat, viewId) => {
            if (viewStat.connected && viewStat.stats.videoBitrate) {
                totalBandwidth += viewStat.stats.videoBitrate;
                activeCount++;

                // 评估质量
                if (viewStat.stats.packetLossRate < 2 && viewStat.stats.videoFps > 24) {
                    goodQualityCount++;
                }
            }
        });

        // 更新UI
        const totalBandwidthElement = document.getElementById('totalBandwidth');
        if (totalBandwidthElement) {
            totalBandwidthElement.textContent = `${(totalBandwidth / 1000).toFixed(1)} Mbps`;
        }

        const activeStreamsElement = document.getElementById('activeStreams');
        if (activeStreamsElement) {
            activeStreamsElement.textContent = `${activeCount}/${this.layouts[this.currentLayout].count}`;
        }

        // 推荐布局
        const recommendedLayout = this.getRecommendedLayout(totalBandwidth);
        const recommendedLayoutElement = document.getElementById('recommendedLayout');
        if (recommendedLayoutElement) {
            const layoutNames = {
                single: '单个视图',
                grid4: '四宫格',
                grid9: '九宫格'
            };
            recommendedLayoutElement.textContent = layoutNames[recommendedLayout];
        }

        // 网络质量
        const networkQuality = this.evaluateNetworkQuality(goodQualityCount, activeCount);
        const networkQualityElement = document.getElementById('networkQuality');
        if (networkQualityElement) {
            networkQualityElement.textContent = networkQuality.text;
            networkQualityElement.className = `quality-indicator ${networkQuality.class}`;
        }
    }

    /**
     * 获取推荐布局
     * @param {number} totalBandwidth - 总带宽消耗 (kbps)
     * @returns {string} 推荐的布局类型
     */
    getRecommendedLayout(totalBandwidth) {
        // 根据网络状况推荐布局
        if (totalBandwidth < 2000) { // < 2 Mbps
            return 'single';
        } else if (totalBandwidth < 8000) { // < 8 Mbps
            return 'grid4';
        } else {
            return 'grid9';
        }
    }

    /**
     * 评估网络质量
     * @param {number} goodQualityCount - 优质流数量
     * @param {number} totalCount - 总流数量
     * @returns {Object} 质量评估结果
     */
    evaluateNetworkQuality(goodQualityCount, totalCount) {
        if (totalCount === 0) {
            return { text: '未知', class: 'unknown' };
        }

        const qualityRatio = goodQualityCount / totalCount;

        if (qualityRatio >= 0.8) {
            return { text: '优秀', class: 'excellent' };
        } else if (qualityRatio >= 0.6) {
            return { text: '良好', class: 'good' };
        } else if (qualityRatio >= 0.4) {
            return { text: '一般', class: 'fair' };
        } else {
            return { text: '较差', class: 'poor' };
        }
    }

    /**
     * 自动调整质量
     * @param {number} index - 视图索引
     * @param {Object} stats - 统计数据
     * @param {Object} quality - 质量信息
     */
    autoAdjustQuality(index, stats, quality) {
        const viewId = `view_${index}`;
        const viewStats = this.viewStats.get(viewId);

        if (!viewStats || viewStats.quality !== 'auto') {
            return; // 非自动模式，不调整
        }

        // 根据统计数据决定是否需要调整质量
        const shouldDowngrade = this.shouldDowngradeQuality(stats);
        const shouldUpgrade = this.shouldUpgradeQuality(stats);

        if (shouldDowngrade) {
            const newQuality = this.getDowngradedQuality(stats);
            console.log(`建议视图 ${index} 降级到 ${newQuality}`);
            this.emit('qualitySwitch', {
                viewIndex: index,
                recommendedQuality: newQuality,
                reason: 'network_degradation',
                stats
            });
        } else if (shouldUpgrade) {
            const newQuality = this.getUpgradedQuality(stats);
            console.log(`建议视图 ${index} 升级到 ${newQuality}`);
            this.emit('qualitySwitch', {
                viewIndex: index,
                recommendedQuality: newQuality,
                reason: 'network_improvement',
                stats
            });
        }
    }

    /**
     * 判断是否应该降级质量
     * @param {Object} stats - 统计数据
     * @returns {boolean}
     */
    shouldDowngradeQuality(stats) {
        return stats.packetLossRate > 3 || // 丢包率超过3%
               stats.jitter > 80 || // 抖动超过80ms
               stats.videoFps < 20; // 帧率低于20fps
    }

    /**
     * 判断是否应该升级质量
     * @param {Object} stats - 统计数据
     * @returns {boolean}
     */
    shouldUpgradeQuality(stats) {
        return stats.packetLossRate < 1 && // 丢包率低于1%
               stats.jitter < 30 && // 抖动低于30ms
               stats.videoFps > 28; // 帧率高于28fps
    }

    /**
     * 获取降级后的质量
     * @param {Object} stats - 统计数据
     * @returns {string}
     */
    getDowngradedQuality(stats) {
        if (stats.resolution.height >= 1080) {
            return '720p';
        } else if (stats.resolution.height >= 720) {
            return '480p';
        } else {
            return '480p'; // 已经是最低质量
        }
    }

    /**
     * 获取升级后的质量
     * @param {Object} stats - 统计数据
     * @returns {string}
     */
    getUpgradedQuality(stats) {
        if (stats.resolution.height <= 480) {
            return '720p';
        } else if (stats.resolution.height <= 720) {
            return '1080p';
        } else {
            return '1080p'; // 已经是最高质量
        }
    }

    /**
     * 获取推荐质量
     * @param {number} index - 视图索引
     * @returns {string}
     */
    getRecommendedQuality(index) {
        // 根据布局和视图索引推荐质量
        switch (this.currentLayout) {
            case 'single':
                return '1080p'; // 单视图使用最高质量
            case 'grid4':
                return index === 0 ? '1080p' : '720p'; // 主视图高质量，其他中等质量
            case 'grid9':
                return index < 4 ? '720p' : '480p'; // 前4个中等质量，其他低质量
            default:
                return '720p';
        }
    }

    /**
     * 获取流ID
     * @param {number} index - 视图索引
     * @returns {string}
     */
    getStreamId(index) {
        // 可以配置为使用不同的流或同一个流
        const baseStream = this.config.streamConfig.baseStreamId || 'stream/wrj/pri/8UUXN4R00A06RS_165-0-7';
        
        if (this.config.streamConfig.useMultipleStreams) {
            // 使用多个不同的流
            return `${baseStream}_${index}`;
        } else {
            // 使用同一个流（服务器自动适配不同质量）
            return baseStream;
        }
    }

    /**
     * 更新视图控制按钮
     * @param {number} index - 视图索引
     * @param {boolean} connected - 是否已连接
     */
    updateViewControls(index, connected) {
        const viewContainer = this.gridContainer.querySelector(`[data-index="${index}"]`);
        if (!viewContainer) return;

        const connectBtn = viewContainer.querySelector('[data-action="connect"]');
        const disconnectBtn = viewContainer.querySelector('[data-action="disconnect"]');

        if (connected) {
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
        } else {
            connectBtn.style.display = 'inline-block';
            disconnectBtn.style.display = 'none';
        }
    }

    /**
     * 更新视图状态
     * @param {number} index - 视图索引
     * @param {string} status - 状态文本
     */
    updateViewStatus(index, status) {
        const statusElement = document.getElementById(`status_${index}`);
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    /**
     * 更新视图质量显示
     * @param {number} index - 视图索引
     * @param {string} quality - 质量档位
     */
    updateViewQuality(index, quality) {
        const qualityElement = document.getElementById(`quality_${index}`);
        if (qualityElement) {
            qualityElement.textContent = quality;
        }
    }

    /**
     * 清空视图统计显示
     * @param {number} index - 视图索引
     */
    clearViewStats(index) {
        const elements = [
            `bitrate_${index}`,
            `fps_${index}`,
            `resolution_${index}`,
            `loss_${index}`
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '--';
            }
        });
    }

    /**
     * 清空所有视频视图
     */
    clearVideoViews() {
        // 断开所有连接
        this.videoPlayers.forEach((player, viewId) => {
            player.disconnect();
            player.destroy();
        });

        // 清理数据
        this.videoPlayers.clear();
        this.viewStats.clear();
        this.activeStreams.clear();

        // 清空DOM
        this.gridContainer.innerHTML = '';
    }

    /**
     * 获取当前布局类型
     * @returns {string}
     */
    getCurrentLayout() {
        return this.currentLayout;
    }

    /**
     * 获取活跃流统计
     * @returns {Object}
     */
    getActiveStreamsStats() {
        const stats = {
            total: this.layouts[this.currentLayout].count,
            active: this.activeStreams.size,
            streams: []
        };

        this.viewStats.forEach((viewStat, viewId) => {
            if (viewStat.connected) {
                stats.streams.push({
                    viewIndex: viewStat.index,
                    quality: viewStat.quality,
                    stats: viewStat.stats,
                    lastUpdate: viewStat.lastUpdate
                });
            }
        });

        return stats;
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
                    console.error(`事件 ${event} 的监听器执行出错:`, error);
                }
            });
        }
    }

    /**
     * 销毁管理器
     */
    destroy() {
        console.log('销毁多视图管理器...');

        // 清空所有视图
        this.clearVideoViews();

        // 清理事件监听器
        this.listeners = {
            layoutChange: [],
            streamStats: [],
            qualitySwitch: [],
            error: []
        };

        // 清空容器
        this.container.innerHTML = '';

        console.log('多视图管理器已销毁');
    }
}

// 导出为全局变量
if (typeof window !== 'undefined') {
    window.MultiViewManager = MultiViewManager;
}