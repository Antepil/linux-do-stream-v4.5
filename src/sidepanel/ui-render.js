// UI 渲染模块 - 封装所有 DOM 操作

import { formatTime, formatNumber, escapeHtml, getTrustBadge, showToast } from '../utils/formatters.js';

// 图标定义
const ICONS = {
  refresh: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
  timer: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
  posts: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
  views: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
  user: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>'
};

// 分类配置
export const CATEGORIES = [
  { id: 4, name: '开发调优', slug: 'develop', color: 'tag-dev' },
  { id: 98, name: '国产替代', slug: 'domestic', color: 'tag-dev' },
  { id: 14, name: '资源荟萃', slug: 'resource', color: 'tag-resource' },
  { id: 42, name: '文档共建', slug: 'wiki', color: 'tag-dev' },
  { id: 27, name: '非我莫属', slug: 'job', color: 'tag-news' },
  { id: 32, name: '读书成诗', slug: 'reading', color: 'tag-life' },
  { id: 34, name: '前沿快讯', slug: 'news', color: 'tag-news' },
  { id: 92, name: '网络记忆', slug: 'feeds', color: 'tag-news' },
  { id: 36, name: '福利羊毛', slug: 'welfare', color: 'tag-resource' },
  { id: 11, name: '搞七捻三', slug: 'gossip', color: 'tag-life' },
  { id: 2, name: '运营反馈', slug: 'feedback', color: 'tag-default' }
];

const TAG_COLORS = { '人工智能': 'tag-ai', '抽奖': 'tag-resource', '精华神帖': 'tag-ai', '纯水': 'tag-life' };

// DOM 元素缓存
let elements = {};

/**
 * 初始化 DOM 元素缓存
 * @param {object} domElements - DOM 元素对象
 */
export function initElements(domElements) {
  elements = domElements;
}

/**
 * 渲染骨架屏
 */
export function showSkeleton() {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton-item';
    s.innerHTML = '<div class="skeleton-line" style="width:80%"></div><div class="skeleton-line" style="width:60%"></div><div class="skeleton-line" style="width:40%"></div>';
    fragment.appendChild(s);
  }
  elements.topicList.innerHTML = '';
  elements.topicList.appendChild(fragment);
}

/**
 * 渲染主题列表
 * @param {Array} topics - 主题数组
 * @param {object} config - 配置对象
 * @param {Set} readTopicIds - 已读主题 ID 集合
 * @param {Map} usersMap - 用户映射
 * @param {Function} onTopicClick - 主题点击回调
 * @param {Function} onContextMenu - 右键菜单回调
 */
export function renderTopics(topics, config, readTopicIds, usersMap, onTopicClick, onContextMenu) {
  const filtered = applyFilters(topics, config);
  const sorted = applySorting(filtered, config);

  // 更新角标
  if (config.showBadge) {
    const unreadCount = filtered.filter(t => !readTopicIds.has(t.id)).length;
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: unreadCount });
  } else {
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: 0 });
  }

  if (sorted.length === 0) {
    elements.topicList.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-tertiary)">暂无内容 (可能被过滤)</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  sorted.forEach(topic => {
    fragment.appendChild(createTopicElement(topic, config, readTopicIds, usersMap, onTopicClick, onContextMenu));
  });

  requestAnimationFrame(() => {
    elements.topicList.innerHTML = '';
    elements.topicList.appendChild(fragment);
  });
}

/**
 * 创建主题元素
 */
function createTopicElement(topic, config, readTopicIds, usersMap, onTopicClick, onContextMenu) {
  const el = document.createElement('div');
  const isSiteRead = config.syncReadStatus && topic.last_read_post_number && topic.last_read_post_number >= topic.highest_post_number;
  const isRead = readTopicIds.has(topic.id) || isSiteRead;

  el.className = `topic-item ${isRead && config.readStatusAction === 'fade' ? 'read' : ''}`;
  el.dataset.topicId = topic.id;

  const time = formatTime(topic.last_posted_at || topic.created_at);
  const isNew = (new Date() - new Date(topic.created_at)) < 14400000 && !isRead;
  const cat = CATEGORIES.find(c => c.id == topic.category_id) || { name: '其他', color: 'tag-default' };
  const excerpt = config.lowDataMode ? '' : (topic.excerpt || topic.title);

  let tagsHtml = `<span class="category-tag ${cat.color}">${cat.name}</span>`;
  if (topic.tags && topic.tags.length > 0) {
    topic.tags.slice(0, 2).forEach(tag => {
      const tagColor = TAG_COLORS[tag] || 'tag-default';
      tagsHtml += `<span class="category-tag ${tagColor}" style="margin-left:4px">${tag}</span>`;
    });
  }

  // 提取信任等级
  let trustLevel = 0;
  let isAdmin = false;

  if (topic.posters && topic.posters.length > 0) {
    const latestPoster = topic.posters.find(p => p.extras === 'latest') || topic.posters[topic.posters.length - 1];
    const userId = latestPoster ? latestPoster.user_id : null;

    if (userId && usersMap && usersMap.has(userId)) {
      const userData = usersMap.get(userId);
      trustLevel = userData.trust_level || 0;
      isAdmin = userData.admin || false;
    }
  }

  const trustBadge = getTrustBadge(trustLevel, isAdmin);

  el.innerHTML = `
    ${isNew ? '<div class="new-dot"></div>' : ''}
    <div class="tag-container">${tagsHtml}</div>
    <div class="topic-title">${escapeHtml(topic.title)}</div>
    ${excerpt ? `<div class="topic-excerpt">${escapeHtml(excerpt)}</div>` : ''}
    <div class="topic-meta">
      <div class="meta-group">
        ${!config.lowDataMode ? ICONS.user : ''} <span>${topic.last_poster_username || '匿名'}</span>
        ${trustBadge}
      </div>
      <div class="meta-group">
        ${ICONS.posts} <span>${formatNumber(topic.posts_count)}</span>
        ${ICONS.views} <span>${formatNumber(topic.views)}</span>
        <span style="margin-left:4px">${time}</span>
      </div>
    </div>
  `;

  el.onclick = (e) => onTopicClick(topic, e);
  el.oncontextmenu = (e) => { e.preventDefault(); showContextMenu(e, topic); };

  if (config.hoverPreview && !config.lowDataMode) {
    let hoverTimer = null;
    el.onmouseenter = () => {
      hoverTimer = setTimeout(() => {
        requestAnimationFrame(() => el.classList.add('show-preview'));
      }, 300);
    };
    el.onmouseleave = () => {
      clearTimeout(hoverTimer);
      requestAnimationFrame(() => el.classList.remove('show-preview'));
    };
  }

  return el;
}

/**
 * 应用过滤器
 */
function applyFilters(topics, config) {
  let res = [...topics];

  // 分类屏蔽
  if (config.blockCategories && config.blockCategories.length > 0) {
    res = res.filter(t => {
      const cat = CATEGORIES.find(c => c.id == t.category_id);
      return !cat || !config.blockCategories.includes(cat.slug);
    });
  }

  // 关键词黑名单
  if (config.keywordBlacklist) {
    const black = config.keywordBlacklist.split(',').map(k => k.trim().toLowerCase());
    res = res.filter(t => !black.some(k => t.title.toLowerCase().includes(k)));
  }

  // 高热度过滤
  if (config.qualityFilter) {
    res = res.filter(t => t.posts_count > 10);
  }

  // 已读隐藏
  if (config.readStatusAction === 'hide') {
    res = res.filter(t => !readTopicIds.has(t.id));
  }

  return res;
}

/**
 * 应用排序
 */
function applySorting(topics, config) {
  const res = [...topics];
  const sortFilter = config.sortFilter || 'latest';

  if (sortFilter === 'latest') res.sort((a, b) => new Date(b.last_posted_at) - new Date(a.last_posted_at));
  if (sortFilter === 'created') res.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (sortFilter === 'views') res.sort((a, b) => b.views - a.views);
  if (sortFilter === 'replies') res.sort((a, b) => b.posts_count - a.posts_count);

  return res;
}

/**
 * 显示自定义右键菜单
 */
function showContextMenu(e, topic) {
  initContextMenu();

  const menu = document.getElementById('customContextMenu');
  const url = `https://linux.do/t/${topic.id}`;

  menu.innerHTML = `
    <div class="menu-item" onclick="window.copyText('${url}')">复制链接</div>
    <div class="menu-item" onclick="window.copyText('[${topic.title.replace(/'/g, "\\'")}](${url})')">复制 Markdown</div>
    <div class="menu-item" onclick="window.toggleRead(${topic.id})">标记为未读</div>
  `;

  menu.style.display = 'block';
  menu.style.left = `${Math.min(e.pageX, window.innerWidth - 160)}px`;
  menu.style.top = `${Math.min(e.pageY, window.innerHeight - 120)}px`;
}

/**
 * 初始化右键菜单容器
 */
export function initContextMenu() {
  if (!document.getElementById('customContextMenu')) {
    const m = document.createElement('div');
    m.id = 'customContextMenu';
    m.className = 'custom-menu';
    document.body.appendChild(m);
  }
}

/**
 * 渲染分类屏蔽列表
 */
export function renderCategoryBlockList(container, blockedSlugs, onToggle) {
  container.innerHTML = CATEGORIES.map(c => `
    <div class="selectable-tag ${blockedSlugs.includes(c.slug) ? 'blocked' : ''}" data-slug="${c.slug}">${c.name}</div>
  `).join('');

  container.querySelectorAll('.selectable-tag').forEach(tag => {
    tag.onclick = () => onToggle(tag.dataset.slug);
  });
}

/**
 * 填充子分类下拉框
 */
export function fillSubCategories(select) {
  select.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

/**
 * 更新用户按钮显示
 */
export function updateUserButton(isLoggedIn, currentUser) {
  if (isLoggedIn && currentUser) {
    const avatarUrl = currentUser.avatar_template
      ? currentUser.avatar_template.replace('{size}', '40')
      : '';
    elements.userBtn.innerHTML = avatarUrl
      ? `<img src="${avatarUrl}" class="user-avatar" alt="${currentUser.username}">`
      : ICONS.user;
    elements.userBtn.classList.add('logged-in');
  } else {
    elements.userBtn.innerHTML = ICONS.user;
    elements.userBtn.classList.remove('logged-in');
  }
}

/**
 * 显示用户下拉菜单
 */
export function showUserDropdown(currentUser, onAction) {
  hideUserDropdown();

  const dropdown = document.createElement('div');
  dropdown.className = 'user-dropdown';
  dropdown.id = 'userDropdown';

  if (!currentUser) {
    dropdown.innerHTML = `
      <div class="dropdown-header" style="padding: 16px;">
        <span class="username">未登录</span>
        <span class="user-level" style="margin-top: 4px;">点击下方按钮登录</span>
      </div>
      <div class="dropdown-item" data-action="login" style="color: var(--apple-blue);">
        ${ICONS.user} <span>前往登录</span>
      </div>
    `;
  } else {
    const avatarUrl = currentUser.avatar_template
      ? currentUser.avatar_template.replace('{size}', '40')
      : '';
    const trustLevel = currentUser.trust_level || 0;
    const levelNames = { 0: '新用户', 1: '基本用户', 2: '成员', 3: '常任成员', 4: '领袖' };
    const levelName = levelNames[trustLevel] || '用户';

    dropdown.innerHTML = `
      <div class="dropdown-header">
        <img src="${avatarUrl}" alt="${currentUser.username}" onerror="this.style.display='none'">
        <div class="user-info">
          <span class="username">${escapeHtml(currentUser.username)}</span>
          <span class="user-level">${levelName} · LV${trustLevel}</span>
        </div>
      </div>
      <div class="dropdown-item" data-action="profile">${ICONS.profile} <span>我的主页</span></div>
      <div class="dropdown-item logout" data-action="logout">${ICONS.logout} <span>退出登录</span></div>
    `;
  }

  document.body.appendChild(dropdown);

  dropdown.onclick = (e) => {
    const item = e.target.closest('.dropdown-item');
    if (item) onAction(item.dataset.action);
  };

  setTimeout(() => {
    document.addEventListener('click', handleDropdownOutsideClick);
  }, 0);
}

/**
 * 隐藏用户下拉菜单
 */
export function hideUserDropdown() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.remove();
  }
  document.removeEventListener('click', handleDropdownOutsideClick);
}

/**
 * 处理点击外部关闭下拉菜单
 */
function handleDropdownOutsideClick(e) {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown && !dropdown.contains(e.target) && e.target !== elements.userBtn && !elements.userBtn.contains(e.target)) {
    hideUserDropdown();
  }
}

/**
 * 应用外观设置
 */
export function applyAppearance(config) {
  document.body.classList.remove('font-small', 'font-large', 'compact');
  if (config.fontSize === 'small') document.body.classList.add('font-small');
  if (config.fontSize === 'large') document.body.classList.add('font-large');
  if (config.compactMode) document.body.classList.add('compact');

  document.documentElement.setAttribute('data-theme', config.themeMode || 'system');
}

/**
 * 更新主题计数
 */
export function updateTopicCount(count) {
  elements.topicCount.textContent = count;
}

/**
 * 设置加载状态
 */
export function setLoading(loading) {
  if (loading) {
    elements.statusIndicator.classList.add('loading');
  } else {
    elements.statusIndicator.classList.remove('loading');
  }
}

/**
 * 绑定刷新按钮图标
 */
export function bindRefreshIcon() {
  elements.refreshBtn.innerHTML = ICONS.refresh;
}

/**
 * 绑定自动刷新图标
 */
export function bindAutoRefreshIcon() {
  elements.autoRefreshToggle.innerHTML = ICONS.timer;
}

export { ICONS, CATEGORIES, TAG_COLORS };
