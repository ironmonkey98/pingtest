/**
 * WebRTC 播放器模块（HTTP/WHIP 信令）
 * 职责：管理 WebRTC 连接、通过 HTTP/WHIP 发送 SDP Offer 并接收 Answer；向外暴露统一事件
 * 事件：
 *  - stateChange: { state: 'connecting'|'connected'|'disconnected'|'error', quality?: string }
 *  - error: { message, error }
 *  - statsReady: RTCPeerConnection             // 可用于外部统计采集
 */
class WebRTCPlayerHTTP {
  constructor(videoElement, config = {}) {
    if (!videoElement) throw new Error('WebRTCPlayerHTTP 需要有效的视频元素');

    this.videoElement = videoElement;
    this.config = {
      iceServers: config.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }],
      apiBaseUrl: config.apiBaseUrl || '',
      streamApp: config.streamApp || 'live',
      streamPrefix: config.streamPrefix || '',
      streamType: config.streamType || 'play',
      qualitySuffix: config.qualitySuffix || '', // e.g. '-${quality}'
      ...config
    };

    this.peerConnection = null;
    this.currentQuality = null;
    this.isConnecting = false;
    this.listeners = { stateChange: [], error: [], statsReady: [], qualityChanged: [] };

    if (!this.config.apiBaseUrl || !this.config.streamPrefix) {
      console.warn('WebRTCPlayerHTTP: apiBaseUrl/streamPrefix 未配置，连接将失败');
    }

    console.log('WebRTC 播放器（HTTP 版本）初始化完成', this.config);
  }

  // 事件系统
  on(event, cb) {
    if (this.listeners[event]) this.listeners[event].push(cb);
  }
  off(event, cb) {
    if (this.listeners[event]) this.listeners[event] = this.listeners[event].filter(fn => fn !== cb);
  }
  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
  }

  async connect(quality = '480p') {
    if (this.isConnecting) return;
    this.isConnecting = true;
    this.currentQuality = quality;
    this.emit('stateChange', { state: 'connecting', quality });

    try {
      this._createPeerConnection();
      const offer = await this._createOffer();
      const answer = await this._sendOfferAndGetAnswer(offer, quality);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answer.sdp }));
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

  async switchQuality(newQuality) {
    if (newQuality === this.currentQuality) return;
    this.disconnect();
    await new Promise(r => setTimeout(r, 300));
    await this.connect(newQuality);
    this.emit('qualityChanged', { oldRid: null, newRid: newQuality, label: newQuality });
  }

  disconnect() {
    if (this.peerConnection) {
      this.peerConnection.getSenders().forEach(s => s.track && s.track.stop());
      this.peerConnection.getReceivers().forEach(r => r.track && r.track.stop());
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.videoElement.srcObject) {
      this.videoElement.srcObject.getTracks().forEach(t => t.stop());
      this.videoElement.srcObject = null;
    }
    this.emit('stateChange', { state: 'disconnected', quality: this.currentQuality });
  }

  getPeerConnection() { return this.peerConnection; }
  getCurrentQuality() { return this.currentQuality; }

  _createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({ iceServers: this.config.iceServers });

    this.peerConnection.onicecandidate = (e) => {
      if (e.candidate) console.debug('ICE 候选:', e.candidate.candidate);
    };
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('ICE 收集状态:', this.peerConnection.iceGatheringState);
    };
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('连接状态:', state);
      if (state === 'connected') this.emit('stateChange', { state: 'connected', quality: this.currentQuality });
      if (state === 'failed' || state === 'closed') this.emit('stateChange', { state: 'disconnected', quality: this.currentQuality });
    };
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.videoElement.srcObject = event.streams[0];
        this.emit('statsReady', this.peerConnection);
      }
    };

    console.log('PeerConnection 创建成功');
  }

  async _createOffer() {
    // 仅接收音视频
    this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
    this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await this._waitForIceGathering();
    console.log('Offer 创建成功');
    return this.peerConnection.localDescription;
  }

  _waitForIceGathering() {
    return new Promise(resolve => {
      if (this.peerConnection.iceGatheringState === 'complete') return resolve();
      const onState = () => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          this.peerConnection.removeEventListener('icegatheringstatechange', onState);
          resolve();
        }
      };
      this.peerConnection.addEventListener('icegatheringstatechange', onState);
      setTimeout(() => {
        this.peerConnection.removeEventListener('icegatheringstatechange', onState);
        resolve();
      }, 5000);
    });
  }

  async _sendOfferAndGetAnswer(offer, quality) {
    const base = this.config.apiBaseUrl.replace(/\/$/, '');
    const suffix = (this.config.qualitySuffix || '').replace('${quality}', quality || '');
    const streamId = `${this.config.streamPrefix}${suffix}`;
    const url = `${base}?app=${encodeURIComponent(this.config.streamApp)}&stream=${encodeURIComponent(streamId)}&type=${encodeURIComponent(this.config.streamType)}`;

    console.log('发送 Offer 到:', url);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: offer.sdp });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const ct = res.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (data.code && data.code !== 0) throw new Error(`服务器错误(${data.code}): ${data.msg || 'unknown'}`);
      const sdp = data.sdp || (data.data && data.data.sdp);
      if (!sdp) throw new Error('响应中缺少 sdp');
      return { sdp };
    }
    const sdp = await res.text();
    return { sdp };
  }
}

if (typeof window !== 'undefined') {
  window.WebRTCPlayerHTTP = WebRTCPlayerHTTP;
}

