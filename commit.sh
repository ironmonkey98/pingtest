#!/bin/bash
cd /Users/hongye/Desktop/pingtest
export GIT_EDITOR=":"
git commit -m "refactor: 简化架构统一到多视图,删除冗余代码(-3555行)

核心变更:
- 移除单视图相关代码(main.js, adaptive-controller.js)
- 删除WebSocket播放器(webrtc-player.js),聚焦HTTP/WHIP
- 简化HTTP播放器实现(减少516行重复逻辑)
- 增强多视图管理器(新增主视图优先+270行)
- 增强网络监测器(更精准带宽估算+205行)
- 统一入口到index.html多宫格方案

技术债务清理:
- 删除过时文档(CLAUDE.md, CONFIG.md等)
- 删除冗余CSS文档(css/CLAUDE.md)
- 删除实验性multi-view.html

SOLID原则应用:
- 单一职责(S): 每个模块职责更清晰
- 接口隔离(I): 通过事件系统解耦
- 依赖倒置(D): 播放器provider可配置切换

统计: 20个文件变更, +835/-4390行"
echo "提交完成"
git log -1 --oneline
