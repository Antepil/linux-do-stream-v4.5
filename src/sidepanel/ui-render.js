// UI 渲染模块 - 极简主义列表风格

import { formatTime, formatNumber, escapeHtml, getTrustBadge } from '../utils/formatters.js';
import { openAISummaryModal } from './ai-panel.js';

// 图标定义
const ICONS = {
  refresh: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
  timer: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
  user: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>'
};

// 分类配置
export const CATEGORIES = [
  { id: 4, name: '开发调优', slug: 'develop' },
  { id: 98, name: '国产替代', slug: 'domestic' },
  { id: 14, name: '资源荟萃', slug: 'resource' },
  { id: 42, name: '文档共建', slug: 'wiki' },
  { id: 27, name: '非我莫属', slug: 'job' },
  { id: 32, name: '读书成诗', slug: 'reading' },
  { id: 34, name: '前沿快讯', slug: 'news' },
  { id: 92, name: '网络记忆', slug: 'feeds' },
  { id: 36, name: '福利羊毛', slug: 'welfare' },
  { id: 11, name: '搞七捻三', slug: 'gossip' },
  { id: 46, name: '扬帆起航', slug: 'startup' },
  { id: 45, name: '深海幽域', slug: 'muted' },
  { id: 106, name: '积分乐园', slug: 'credit' },
  { id: 102, name: '社区孵化', slug: 'incubator' },
  { id: 2, name: '运营反馈', slug: 'feedback' }
];

const TAG_COLORS = { '人工智能': 'tag-ai', '抽奖': 'tag-resource', '精华神帖': 'tag-ai', '纯水': 'tag-life' };

// DOM 元素缓存
let elements = {};

export function initElements(domElements) {
  elements = domElements;
}

// 骨架屏
export function showSkeleton() {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton-item';
    s.innerHTML = '<div class="skeleton-line title"></div><div class="skeleton-line meta"></div>';
    fragment.appendChild(s);
  }
  elements.topicList.innerHTML = '';
  elements.topicList.appendChild(fragment);
}

// 渲染主题列表
export function renderTopics(topics, config, readTopicIds, usersMap, onTopicClick) {
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
    elements.topicList.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);font-size:14px">暂无内容</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  sorted.forEach(topic => {
    fragment.appendChild(createTopicElement(topic, config, readTopicIds, usersMap, onTopicClick));
  });

  requestAnimationFrame(() => {
    elements.topicList.innerHTML = '';
    elements.topicList.appendChild(fragment);
  });
}

// 创建主题元素 - 极简列表结构
function createTopicElement(topic, config, readTopicIds, usersMap, onTopicClick) {
  const el = document.createElement('div');
  const isSiteRead = config.syncReadStatus && topic.last_read_post_number && topic.last_read_post_number >= topic.highest_post_number;
  const isRead = readTopicIds.has(topic.id) || isSiteRead;

  el.className = `topic-item ${isRead && config.readStatusAction === 'fade' ? 'read' : ''}`;
  el.dataset.topicId = topic.id;

  const cat = CATEGORIES.find(c => c.id == topic.category_id) || { name: '其他', color: 'tag-default' };

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

  // 构建标签 HTML
  let tagsHtml = '';
  if (topic.tags && topic.tags.length > 0) {
    tagsHtml = '<span class="topic-tags">' + topic.tags.slice(0, 2).map(tag => {
      const tagColor = TAG_COLORS[tag] || 'tag-default';
      return `<span class="topic-tag ${tagColor}">${escapeHtml(tag)}</span>`;
    }).join('') + '</span>';
  }

  // 最后回复时间
  const time = formatTime(topic.last_posted_at || topic.created_at);

  el.innerHTML = `
    <div class="topic-content">
      <div class="topic-title">${tagsHtml}${escapeHtml(topic.title)}${trustBadge}</div>
      <div class="topic-meta-mini">
        <span class="topic-category">${escapeHtml(cat.name)}</span>
        <span>${time}</span>
      </div>
    </div>
    <div class="topic-heat">${formatNumber(topic.posts_count)}</div>
  `;

  el.onclick = (e) => onTopicClick(topic, e);
  el.oncontextmenu = (e) => { e.preventDefault(); showContextMenu(e, topic); };

  return el;
}

// 过滤器
function applyFilters(topics, config) {
  let res = [...topics];

  if (config.blockCategories && config.blockCategories.length > 0) {
    res = res.filter(t => {
      const cat = CATEGORIES.find(c => c.id == t.category_id);
      return !cat || !config.blockCategories.includes(cat.slug);
    });
  }

  if (config.keywordBlacklist) {
    const black = config.keywordBlacklist.split(',').map(k => k.trim().toLowerCase());
    res = res.filter(t => !black.some(k => t.title.toLowerCase().includes(k)));
  }

  if (config.qualityFilter) {
    res = res.filter(t => t.posts_count > 10);
  }

  if (config.readStatusAction === 'hide') {
    res = res.filter(t => !readTopicIds.has(t.id));
  }

  return res;
}

// 排序
function applySorting(topics, config) {
  const res = [...topics];
  const sortFilter = config.sortFilter || 'latest';

  if (sortFilter === 'latest') res.sort((a, b) => new Date(b.last_posted_at) - new Date(a.last_posted_at));
  if (sortFilter === 'created') res.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (sortFilter === 'views') res.sort((a, b) => b.views - a.views);
  if (sortFilter === 'replies') res.sort((a, b) => b.posts_count - a.posts_count);

  return res;
}

// 右键菜单
function showContextMenu(e, topic) {
  initContextMenu();

  const menu = document.getElementById('customContextMenu');
  const url = `https://linux.do/t/${topic.id}`;

  menu.innerHTML = `
    <div class="menu-item" onclick="window.copyText('${url}')">复制链接</div>
    <div class="menu-item" onclick="window.copyText('[${topic.title.replace(/'/g, "\\'")}](${url})')">复制 Markdown</div>
    <div class="menu-item" onclick="window.toggleRead(${topic.id})">标记为未读</div>
    <div class="menu-item ai-summarize" data-topic-id="${topic.id}">AI 总结</div>
  `;

  menu.querySelector('.ai-summarize').onclick = () => {
    openAISummaryModal(topic);
  };

  menu.style.display = 'block';
  menu.style.left = `${Math.min(e.pageX, window.innerWidth - 160)}px`;
  menu.style.top = `${Math.min(e.pageY, window.innerHeight - 120)}px`;
}

export function initContextMenu() {
  if (!document.getElementById('customContextMenu')) {
    const m = document.createElement('div');
    m.id = 'customContextMenu';
    m.className = 'custom-menu';
    document.body.appendChild(m);
  }
}

export function renderCategoryBlockList(container, blockedSlugs, onToggle) {
  container.innerHTML = CATEGORIES.map(c => `
    <div class="selectable-tag ${blockedSlugs.includes(c.slug) ? 'blocked' : ''}" data-slug="${c.slug}">${c.name}</div>
  `).join('');

  container.querySelectorAll('.selectable-tag').forEach(tag => {
    tag.onclick = () => onToggle(tag.dataset.slug);
  });
}

export function fillSubCategories(select) {
  select.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

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

export function showUserDropdown(currentUser, onAction) {
  hideUserDropdown();

  const dropdown = document.createElement('div');
  dropdown.className = 'user-dropdown';
  dropdown.id = 'userDropdown';

  if (!currentUser) {
    dropdown.innerHTML = `
      <div class="dropdown-header" style="padding:16px;">
        <span class="username">未登录</span>
        <span class="user-level" style="margin-top:4px;">点击下方按钮登录</span>
      </div>
      <div class="dropdown-item" data-action="login" style="color:var(--primary);">
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

export function hideUserDropdown() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.remove();
  }
  document.removeEventListener('click', handleDropdownOutsideClick);
}

function handleDropdownOutsideClick(e) {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown && !dropdown.contains(e.target) && e.target !== elements.userBtn && !elements.userBtn.contains(e.target)) {
    hideUserDropdown();
  }
}

export function applyAppearance(config) {
  document.body.classList.remove('font-small', 'font-large', 'compact');
  if (config.fontSize === 'small') document.body.classList.add('font-small');
  if (config.fontSize === 'large') document.body.classList.add('font-large');
  if (config.compactMode) document.body.classList.add('compact');
}

export function updateTopicCount(count) {
  elements.topicCount.textContent = count;
}

export function setLoading(loading) {
  if (loading) {
    elements.statusIndicator.classList.add('loading');
  } else {
    elements.statusIndicator.classList.remove('loading');
  }
}

export function bindRefreshIcon() {
  elements.refreshBtn.innerHTML = ICONS.refresh;
}

/**
 * 渲染筛选栏分类标签
 * @param {HTMLElement} container - 标签容器
 * @param {Array} categories - 要显示的分类数组
 * @param {Array} selectedSlugs - 已选中的分类 slug 数组
 * @param {Function} onToggle - 点击回调 (slug)
 */
export function renderCategoryTags(container, categories, selectedSlugs, onToggle) {
  container.innerHTML = categories.map(c => `
    <div class="category-tag ${selectedSlugs.includes(c.slug) ? 'selected' : ''}" data-slug="${c.slug}">${c.name}</div>
  `).join('');

  container.querySelectorAll('.category-tag').forEach(tag => {
    tag.onclick = () => onToggle(tag.dataset.slug);
  });
}

/**
 * 渲染分类下拉菜单
 * @param {HTMLElement} container - 下拉菜单容器
 * @param {Array} allCategories - 所有分类数组
 * @param {Array} visibleSlugs - 已显示的分类 slug 数组
 * @param {Array} selectedSlugs - 已选中的分类 slug 数组
 * @param {Function} onToggle - 点击回调 (slug)
 */
export function renderCategoryDropdown(container, allCategories, visibleSlugs, selectedSlugs, onToggle) {
  // 只显示不在 visibleCategories 中的分类
  const hiddenCategories = allCategories.filter(c => !visibleSlugs.includes(c.slug));

  container.innerHTML = hiddenCategories.map(c => `
    <div class="category-dropdown-item ${selectedSlugs.includes(c.slug) ? 'selected' : ''}" data-slug="${c.slug}">${c.name}</div>
  `).join('');

  container.querySelectorAll('.category-dropdown-item').forEach(item => {
    item.onclick = () => onToggle(item.dataset.slug);
  });
}

/**
 * 渲染设置页可见分类列表
 * @param {HTMLElement} container - 容器
 * @param {Array} allCategories - 所有分类数组
 * @param {Array} visibleSlugs - 当前可见的分类 slug 数组
 * @param {Function} onToggle - 点击回调 (slug)
 */
export function renderVisibleCategoryList(container, allCategories, visibleSlugs, onToggle) {
  container.innerHTML = allCategories.map(c => `
    <div class="selectable-tag ${visibleSlugs.includes(c.slug) ? '' : 'blocked'}" data-slug="${c.slug}">${c.name}</div>
  `).join('');

  container.querySelectorAll('.selectable-tag').forEach(tag => {
    tag.onclick = () => onToggle(tag.dataset.slug);
  });
}

export { ICONS, TAG_COLORS };
