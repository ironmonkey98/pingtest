/**
 * WebRTC 播放器模块（HTTP 信令版本）
 * 职责：管理 WebRTC 连接、处理 HTTP 信令、切换码流
 * 原则：单一职责（SOLID-S）- 只负责 WebRTC 连接管理
 *
 * 适配基于 HTTP POST 的 WHIP 风格信令协议
 */
class WebRTCPlayerHTTP {
    constructor(videoElement, config = {}) {
        this.videoElement = videoElement;
        this.config = {
            // ICE 服务器配置
            iceServers: config.iceServers || [
                { urls: 'stun:stun.l.google.com:19302' }
            ],
            // HTTP 信令 API 基础 URL
            apiBaseUrl: config.apiBaseUrl || 'https://glythgb.xmrbi.com/index/api/webrtc',
            // 流参数配置
            streamApp: config.streamApp || 'live',
            streamPrefix: config.streamPrefix || 'stream/wrj/pri/8UUXN4R00A06RS_165-0-7',
            streamType: config.streamType || 'play',
            // 质量后缀模板（可选）
            qualitySuffix: config.qualitySuffix || '', // 例如: '_${quality}' 或 '-${quality}'
            ...config
        };

        this.peerConnection = null;
        this.currentQuality = null;
        this.isConnecting = false;
        this.listeners = {
            stateChange: [],
            error: [],
            statsReady: []
        };

        console.log('WebRTC 播放器（HTTP 版本）初始化完成', this.config);
    }

    /**
     * 连接到指定质量的流
     * @param {string} quality - '1080p' | '720p' | '480p'
     * @returns {Promise<void>}
     */
    async connect(quality) {
        if (this.isConnecting) {
            console.warn('正在连接中，请勿重复操作');
            return;
        }

        try {
            this.isConnecting = true;
            this.currentQuality = quality;
            this.emit('stateChange', { state: 'connecting', quality });

            console.log(`开始连接 ${quality} 流...`);

            // 1. 创建 PeerConnection
            this.createPeerConnection();

            // 2. 创建 Offer
            const offer = await this.createOffer();

            // 3. 通过 HTTP POST 发送 Offer 并获取 Answer
            const answer = await this.sendOfferAndGetAnswer(offer, quality);

            // 4. 设置远端描述
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription({
                    type: 'answer',
                    sdp: answer.sdp
                })
            );

            console.log(`${quality} 流连接成功`);
            this.emit('stateChange', { state: 'connected', quality });

        } catch (error) {
            console.error('连接失败:', error);
            this.emit('error', { message: '连接失败', error });
            this.emit('stateChange', { state: 'error', quality });
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * 切换到新的质量
     * @param {string} newQuality - 新的质量档位
     * @returns {Promise<void>}
     */
    async switchQuality(newQuality) {
        if (newQuality === this.currentQuality) {
            console.log('已经是当前质量，无需切换');
            return;
        }

        console.log(`切换码流: ${this.currentQuality} -> ${newQuality}`);

        // 先断开当前连接
        this.disconnect();

        // 短暂延迟后重新连接
        await new Promise(resolve => setTimeout(resolve, 500));

        // 连接到新质量
        await this.connect(newQuality);
    }

    /**
     * 创建 PeerConnection
     */
    createPeerConnection() {
        const config = {
            iceServers: this.config.iceServers
        };

        this.peerConnection = new RTCPeerConnection(config);

        // 监听 ICE 候选（HTTP 信令中，ICE 候选通常在 SDP 中 trickle）
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE 候选:', event.candidate);
                // HTTP 信令模式下，通常不需要额外发送 ICE 候选
                // 因为 SDP 中已经包含了 ICE 信息
            }
        };

        // 等待所有 ICE 候选收集完成
        this.peerConnection.onicegatheringstatechange = () => {
            console.log('ICE 收集状态:', this.peerConnection.iceGatheringState);
        };

        // 监听连接状态变化
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('连接状态:', state);

            if (state === 'connected') {
                this.emit('stateChange', { state: 'connected', quality: this.currentQuality });
            } else if (state === 'failed' || state === 'closed') {
                this.emit('stateChange', { state: 'disconnected', quality: this.currentQuality });
            }
        };

        // 监听媒体流
        this.peerConnection.ontrack = (event) => {
            console.log('接收到媒体流:', event.streams[0]);
            this.videoElement.srcObject = event.streams[0];
            this.emit('statsReady', this.peerConnection);
        };

        console.log('PeerConnection 创建成功');
    }

    /**
     * 创建 Offer
     * @returns {Promise<RTCSessionDescriptionInit>}
     */
    async createOffer() {
        try {
            // 添加 transceiver 用于接收视频和音频
            this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
            this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });

            // 创建 Offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // 等待 ICE 候选收集完成（可选，但推荐）
            await this.waitForIceGathering();

            console.log('Offer 创建成功');
            return this.peerConnection.localDescription;

        } catch (error) {
            console.error('创建 Offer 失败:', error);
            throw error;
        }
    }

    /**
     * 等待 ICE 候选收集完成
     * @returns {Promise<void>}
     */
    waitForIceGathering() {
        return new Promise((resolve) => {
            if (this.peerConnection.iceGatheringState === 'complete') {
                resolve();
                return;
            }

            const checkState = () => {
                if (this.peerConnection.iceGatheringState === 'complete') {
                    this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
                    resolve();
                }
            };

            this.peerConnection.addEventListener('icegatheringstatechange', checkState);

            // 超时保护（5 秒）
            setTimeout(() => {
                this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
                resolve();
            }, 5000);
        });
    }

    /**
     * 通过 HTTP POST 发送 Offer 并获取 Answer
     * @param {RTCSessionDescriptionInit} offer - Offer SDP
     * @param {string} quality - 质量档位
     * @returns {Promise<Object>} Answer SDP
     */
    async sendOfferAndGetAnswer(offer, quality) {
        try {
            // 构建流 ID（带质量后缀）
            const streamId = this.getStreamId(quality);

            // 构建完整 URL
            const url = `${this.config.apiBaseUrl}?app=${this.config.streamApp}&stream=${streamId}&type=${this.config.streamType}`;

            console.log('发送 Offer 到:', url);

            // 发送 HTTP POST 请求
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sdp'
                },
                body: offer.sdp
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // 解析响应
            const contentType = response.headers.get('Content-Type');

            if (contentType && contentType.includes('application/json')) {
                // JSON 格式响应
                const data = await response.json();

                if (data.code !== 0) {
                    throw new Error(`服务器错误 (${data.code}): ${data.msg}`);
                }

                return {
                    sdp: data.sdp || data.data?.sdp
                };
            } else {
                // 直接 SDP 格式响应
                const sdp = await response.text();
                return { sdp };
            }

        } catch (error) {
            console.error('发送 Offer 失败:', error);
            throw error;
        }
    }

    /**
     * 获取流 ID（包含质量后缀）
     * @param {string} quality - 质量档位
     * @returns {string}
     */
    getStreamId(quality) {
        const suffix = this.config.qualitySuffix.replace('${quality}', quality);
        return this.config.streamPrefix + suffix;
    }

    /**
     * 断开连接
     */
    disconnect() {
        console.log('断开连接...');

        // 关闭 PeerConnection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // 清空视频
        if (this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }

        this.currentQuality = null;
        this.emit('stateChange', { state: 'disconnected' });
    }

    /**
     * 获取当前质量
     * @returns {string|null}
     */
    getCurrentQuality() {
        return this.currentQuality;
    }

    /**
     * 获取 PeerConnection（用于统计采集）
     * @returns {RTCPeerConnection|null}
     */
    getPeerConnection() {
        return this.peerConnection;
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
     * 销毁实例
     */
    destroy() {
        this.disconnect();
        this.listeners = {
            stateChange: [],
            error: [],
            statsReady: []
        };
    }
}

// 导出为全局变量
if (typeof window !== 'undefined') {
    window.WebRTCPlayerHTTP = WebRTCPlayerHTTP;
}
