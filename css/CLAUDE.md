# CSS 样式系统文档

**导航**: [← 返回项目根目录](../CLAUDE.md) / css样式

## 🎨 设计系统概览

本项目采用统一的UI设计系统，所有样式基于CSS变量定义，确保一致性和可维护性。

```
css/
└── style.css                   # 统一样式系统
```

## 🌈 色彩系统

### 主色调
```css
:root {
    /* 主品牌色 */
    --primary-color: #4b55fa;        /* 主色 */
    --primary-hover: #3b45ea;        /* 悬停态 */
    --primary-active: #2b35da;       /* 激活态 */
    --primary-light: rgba(75, 85, 250, 0.1);  /* 浅色背景 */
    
    /* 标题色 */
    --title-color: #2d3b8d;          /* 页面标题 */
}
```

### 文本色彩
```css
:root {
    /* 文本层级 */
    --text-primary: #333333;         /* 主要文本 */
    --text-secondary: #666666;       /* 次要文本 */
    --text-placeholder: #999999;     /* 占位符文本 */
}
```

### 背景色彩
```css
:root {
    /* 背景色 */
    --bg-page: #f1f4fd;             /* 页面背景 */
    --bg-white: #ffffff;            /* 卡片背景 */
    --border-color: #e4eafd;        /* 边框颜色 */
}
```

### 状态色彩
```css
:root {
    /* 状态指示 */
    --success-color: #37b874;       /* 成功/正常 */
    --warning-color: #faad14;       /* 警告 */
    --error-color: #fa4c6e;         /* 错误/失败 */
    --info-color: #1890ff;          /* 信息提示 */
}
```

## 📝 字体系统

### 字体族
```css
:root {
    --font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, 
                   'Segoe UI', 'Roboto', sans-serif;
}
```

### 字体大小层级
```css
:root {
    /* 字体大小 */
    --font-size-xxxl: 32px;         /* 超大标题 */
    --font-size-xxl: 24px;          /* 大标题 */
    --font-size-xl: 18px;           /* 中标题 */
    --font-size-lg: 16px;           /* 小标题 */
    --font-size-md: 14px;           /* 正文 */
    --font-size-base: 12px;         /* 基准文本 */
    --font-size-sm: 11px;           /* 小文本 */
    --font-size-xs: 10px;           /* 极小文本 */
}
```

## 📏 间距系统

### 标准间距
```css
:root {
    /* 间距层级 */
    --spacing-xs: 4px;              /* 极小间距 */
    --spacing-sm: 8px;              /* 小间距 */
    --spacing-md: 12px;             /* 中等间距 */
    --spacing-lg: 16px;             /* 大间距 */
    --spacing-xl: 20px;             /* 更大间距 */
    --spacing-xxl: 24px;            /* 很大间距 */
    --spacing-xxxl: 32px;           /* 超大间距 */
}
```

### 应用场景
- **xs (4px)**: 紧密相关元素间距
- **sm (8px)**: 表单控件内部间距
- **md (12px)**: 卡片内容间距
- **lg (16px)**: 组件间距
- **xl (20px)**: 区块间距
- **xxl (24px)**: 页面区域间距
- **xxxl (32px)**: 页面级间距

## 🔄 圆角系统

### 圆角规范
```css
:root {
    /* 圆角层级 */
    --border-radius-sm: 4px;        /* 小圆角 - 按钮、输入框 */
    --border-radius-md: 8px;        /* 中圆角 - 卡片、面板 */
    --border-radius-lg: 12px;       /* 大圆角 - 容器 */
    --border-radius-round: 50%;     /* 圆形 - 头像、图标 */
}
```

## 🏗️ 布局组件

### 容器系统
```css
.container {
    max-width: 1200px;              /* 最大宽度 */
    margin: 0 auto;                 /* 居中对齐 */
    padding: var(--spacing-xxl);    /* 内边距 */
}
```

### 网格系统
```css
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-lg);
}
```

### 弹性布局
```css
.control-panel {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-lg);
    align-items: center;
}
```

## 🎮 交互组件

### 按钮系统
```css
/* 主要按钮 */
.btn-primary {
    background-color: var(--primary-color);
    color: var(--bg-white);
    border: none;
    padding: var(--spacing-md) var(--spacing-xl);
    border-radius: var(--border-radius-sm);
    transition: all 0.2s ease;
}

.btn-primary:hover {
    background-color: var(--primary-hover);
    transform: translateY(-1px);
}

/* 次要按钮 */
.btn-secondary {
    background-color: var(--primary-light);
    color: var(--primary-color);
    border: 1px solid var(--primary-color);
}

/* 默认按钮 */
.btn-default {
    background-color: var(--bg-white);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
}
```

### 状态指示器
```css
/* 连接状态 */
.status-indicator {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--border-radius-round);
    background-color: var(--text-placeholder);
}

/* 状态变体 */
.status-indicator.connected .status-dot {
    background-color: var(--success-color);
    animation: pulse 2s infinite;
}

.status-indicator.connecting .status-dot {
    background-color: var(--warning-color);
    animation: blink 1s infinite;
}

.status-indicator.error .status-dot {
    background-color: var(--error-color);
}
```

## 📱 响应式设计

### 断点系统
```css
/* 移动端 */
@media (max-width: 768px) {
    .container {
        padding: var(--spacing-lg);
    }
    
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .control-panel {
        flex-direction: column;
        align-items: stretch;
    }
}

/* 平板端 */
@media (min-width: 769px) and (max-width: 1024px) {
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* 桌面端 */
@media (min-width: 1025px) {
    .stats-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}
```

## 🎞️ 动画系统

### 过渡动画
```css
/* 标准过渡 */
.transition-standard {
    transition: all 0.2s ease;
}

/* 慢速过渡 */
.transition-slow {
    transition: all 0.3s ease;
}
```

### 关键帧动画
```css
/* 脉冲动画 - 连接状态 */
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* 闪烁动画 - 连接中状态 */
@keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
}

/* 旋转动画 - 加载状态 */
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* 淡入动画 - 内容显示 */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
```

## 📊 数据可视化

### 网络质量指示
```css
.network-level {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    font-weight: 500;
}

.network-level.excellent {
    background-color: rgba(55, 184, 116, 0.1);
    color: var(--success-color);
}

.network-level.good {
    background-color: rgba(24, 144, 255, 0.1);
    color: var(--info-color);
}

.network-level.fair {
    background-color: rgba(250, 173, 20, 0.1);
    color: var(--warning-color);
}

.network-level.poor {
    background-color: rgba(250, 76, 110, 0.1);
    color: var(--error-color);
}
```

### 统计数值显示
```css
.stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--border-color);
}

.stat-label {
    font-size: var(--font-size-md);
    color: var(--text-secondary);
}

.stat-value {
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--text-primary);
    font-family: 'Monaco', 'Consolas', monospace;
}
```

## 🎯 专业组件

### 视频播放器容器
```css
.video-container {
    position: relative;
    background-color: #000;
    border-radius: var(--border-radius-md);
    overflow: hidden;
    aspect-ratio: 16/9;
}

.video-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
}

.quality-badge {
    position: absolute;
    top: var(--spacing-lg);
    right: var(--spacing-lg);
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
}
```

### 日志记录面板
```css
.log-container {
    max-height: 200px;
    overflow-y: auto;
    padding: var(--spacing-md);
}

.log-item {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-xs) 0;
    font-size: var(--font-size-sm);
    border-bottom: 1px solid var(--border-color);
}

.log-time {
    color: var(--text-placeholder);
    font-family: 'Monaco', 'Consolas', monospace;
    min-width: 80px;
}

.log-message {
    color: var(--text-secondary);
    flex: 1;
}
```

## 🔧 主题定制

### 暗色主题 (可扩展)
```css
[data-theme="dark"] {
    --bg-page: #1a1a1a;
    --bg-white: #2d2d2d;
    --text-primary: #ffffff;
    --text-secondary: #cccccc;
    --border-color: #404040;
}
```

### 高对比度主题 (可扩展)
```css
[data-theme="high-contrast"] {
    --text-primary: #000000;
    --bg-white: #ffffff;
    --border-color: #000000;
    --primary-color: #0000ff;
}
```

## 📋 样式编写规范

### CSS组织结构
1. **变量定义** - 所有设计token
2. **基础重置** - 标准化样式
3. **布局组件** - 容器、网格、弹性布局
4. **UI组件** - 按钮、表单、卡片
5. **专业组件** - 视频播放器、统计面板
6. **响应式适配** - 媒体查询
7. **动画效果** - 过渡和关键帧

### 命名约定
- **BEM方法论**: `.block__element--modifier`
- **语义化命名**: 描述功能而非样式
- **一致性前缀**: 相同功能组件使用相同前缀

### 性能优化
- **使用CSS变量**: 减少重复代码
- **避免深层嵌套**: 保持选择器简洁
- **合理使用动画**: 避免影响性能的属性

---

**设计系统版本**: v1.0.0  
**CSS变量总数**: 35个  
**响应式断点**: 3个  
**动画效果**: 4种  
**最后更新**: 2025-11-02T09:59:05.000Z