/**
 * WebRTC 播放器模块
 * 职责：管理 WebRTC 连接、处理信令、切换码流
 * 原则：单一职责（SOLID-S）- 只负责 WebRTC 连接管理
 */
class WebRTCPlayer {
    constructor(videoElement, config = {}) {
        this.videoElement = videoElement;
        this.config = {
            // ICE 服务器配置
            iceServers: config.iceServers || [
                { urls: 'stun:stun.l.google.com:19302' }
            ],
            // 信令服务器地址（用户需要根据实际情况配置）
            signalingUrl: config.signalingUrl || 'ws://localhost:8080/signal',
            // 流地址模板
            streamUrlTemplate: config.streamUrlTemplate || 'drone_${quality}',
            ...config
        };

        this.peerConnection = null;
        this.websocket = null;
        this.currentQuality = null;
        this.isConnecting = false;
        this.listeners = {
            stateChange: [],
            error: [],
            statsReady: []
        };

        console.log('WebRTC 播放器初始化完成', this.config);
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

            // 1. 建立信令连接
            await this.connectSignaling();

            // 2. 创建 PeerConnection
            this.createPeerConnection();

            // 3. 发起 Offer（播放请求）
            await this.createOffer(quality);

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
     * 连接信令服务器
     * @returns {Promise<void>}
     */
    connectSignaling() {
        return new Promise((resolve, reject) => {
            try {
                this.websocket = new WebSocket(this.config.signalingUrl);

                this.websocket.onopen = () => {
                    console.log('信令服务器连接成功');
                    resolve();
                };

                this.websocket.onerror = (error) => {
                    console.error('信令服务器连接失败:', error);
                    reject(new Error('信令服务器连接失败'));
                };

                this.websocket.onmessage = (event) => {
                    this.handleSignalingMessage(event.data);
                };

                this.websocket.onclose = () => {
                    console.log('信令服务器连接关闭');
                };

                // 超时处理
                setTimeout(() => {
                    if (this.websocket.readyState !== WebSocket.OPEN) {
                        reject(new Error('信令服务器连接超时'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 创建 PeerConnection
     */
    createPeerConnection() {
        const config = {
            iceServers: this.config.iceServers
        };

        this.peerConnection = new RTCPeerConnection(config);

        // 监听 ICE 候选
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignaling({
                    type: 'candidate',
                    candidate: event.candidate
                });
            }
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
     * 创建 Offer 并发送
     * @param {string} quality - 质量档位
     */
    async createOffer(quality) {
        try {
            // 添加 transceiver 用于接收视频
            this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
            this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });

            // 创建 Offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // 发送 Offer 到信令服务器
            this.sendSignaling({
                type: 'offer',
                sdp: offer.sdp,
                streamId: this.getStreamId(quality)
            });

            console.log('Offer 创建并发送成功');

        } catch (error) {
            console.error('创建 Offer 失败:', error);
            throw error;
        }
    }

    /**
     * 处理信令消息
     * @param {string} data - 信令消息
     */
    async handleSignalingMessage(data) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'answer':
                    // 收到 Answer，设置远端描述
                    await this.peerConnection.setRemoteDescription(
                        new RTCSessionDescription({
                            type: 'answer',
                            sdp: message.sdp
                        })
                    );
                    console.log('Answer 设置成功');
                    break;

                case 'candidate':
                    // 收到 ICE 候选
                    await this.peerConnection.addIceCandidate(
                        new RTCIceCandidate(message.candidate)
                    );
                    break;

                case 'error':
                    console.error('信令错误:', message.message);
                    this.emit('error', { message: message.message });
                    break;

                default:
                    console.warn('未知的信令消息类型:', message.type);
            }

        } catch (error) {
            console.error('处理信令消息失败:', error);
        }
    }

    /**
     * 发送信令消息
     * @param {Object} message - 消息对象
     */
    sendSignaling(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        } else {
            console.error('WebSocket 未连接，无法发送消息');
        }
    }

    /**
     * 获取流 ID
     * @param {string} quality - 质量档位
     * @returns {string}
     */
    getStreamId(quality) {
        return this.config.streamUrlTemplate.replace('${quality}', quality);
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

        // 关闭 WebSocket
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
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
    window.WebRTCPlayer = WebRTCPlayer;
}
