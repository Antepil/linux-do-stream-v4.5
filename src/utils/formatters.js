// Formatters 工具模块 - 封装所有格式化逻辑

/**
 * 格式化时间
 * @param {string} iso - ISO 时间字符串
 * @returns {string}
 */
export function formatTime(iso) {
  const d = new Date(iso);
  const diff = (new Date() - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 格式化数字（千分位）
 * @param {number} n - 数字
 * @returns {string}
 */
export function formatNumber(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
}

/**
 * HTML 转义
 * @param {string} text - 原始文本
 * @returns {string}
 */
export function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

/**
 * 检查主题是否近期发布（4小时内）
 * @param {object} topic - 主题对象
 * @returns {boolean}
 */
export function isTopicRecent(topic) {
  return (new Date() - new Date(topic.created_at)) < 14400000;
}

/**
 * 获取信任等级徽章 HTML
 * @param {number} level - 信任等级
 * @param {boolean} isAdmin - 是否管理员
 * @returns {string}
 */
export function getTrustBadge(level, isAdmin) {
  if (isAdmin) {
    return `<span class="trust-badge admin" title="管理员">
      <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
    </span>`;
  }

  const badges = {
    4: {
      class: 'l4',
      title: '信任等级 4: 领袖',
      icon: '<path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5Z"/>'
    },
    3: {
      class: 'l3',
      title: '信任等级 3: 常任成员',
      icon: '<path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"/>'
    },
    2: {
      class: 'l2',
      title: '信任等级 2: 成员',
      icon: '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>'
    },
    1: {
      class: 'l1',
      title: '信任等级 1: 基本用户',
      icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>'
    }
  };

  const badge = badges[level];
  if (!badge) return '';

  return `<span class="trust-badge ${badge.class}" title="${badge.title}">
    <svg viewBox="0 0 24 24">${badge.icon}</svg>
  </span>`;
}

/**
 * Toast 提示
 * @param {string} message - 提示消息
 * @param {number} duration - 持续时间（毫秒）
 */
export function showToast(message, duration = 3000) {
  // 移除已存在的 toast
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 1000;
    animation: toastFadeIn 0.3s ease;
  `;

  // 添加动画样式
  if (!document.getElementById('toastStyle')) {
    const style = document.createElement('style');
    style.id = 'toastStyle';
    style.textContent = `
      @keyframes toastFadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes toastFadeOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(10px); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // 自动消失
  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
