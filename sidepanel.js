// Linux.do 主题流 v4.1 - 优化设置版

// DOM 元素
const topicList = document.getElementById('topicList');
const statusIndicator = document.getElementById('statusIndicator');
const topicCountEl = document.getElementById('topicCount');
const refreshBtn = document.getElementById('refreshBtn');
const autoRefreshToggle = document.getElementById('autoRefreshToggle');
const categoryFilter = document.getElementById('categoryFilter');
const subCategoryContainer = document.getElementById('subCategoryContainer');
const subCategoryFilter = document.getElementById('subCategoryFilter');
const sortFilter = document.getElementById('sortFilter');
const refreshProgress = document.getElementById('refreshProgress');

// 设置面板元素
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');

// 设置项
const pollingInterval = document.getElementById('pollingInterval');
const lowDataMode = document.getElementById('lowDataMode');
const categoryBlockList = document.getElementById('categoryBlockList');
const keywordBlacklist = document.getElementById('keywordBlacklist');
const qualityFilter = document.getElementById('qualityFilter');
const hoverPreview = document.getElementById('hoverPreview');
const readStatusAction = document.getElementById('readStatusAction');
const showBadge = document.getElementById('showBadge');
const notifyKeywords = document.getElementById('notifyKeywords');
const fontSize = document.getElementById('fontSize');
const compactMode = document.getElementById('compactMode');

// 默认配置
const DEFAULT_CONFIG = {
  pollingInterval: 30,
  lowDataMode: false,
  blockCategories: [], // 改为数组存储 slug
  keywordBlacklist: '',
  qualityFilter: false,
  hoverPreview: true,
  clickBehavior: 'newTab',
  readStatusAction: 'fade',
  showBadge: true,
  notifyKeywords: '',
  fontSize: 'medium',
  compactMode: false,
  themeMode: 'system',
  syncReadStatus: true
};

// 状态管理
let allTopics = [];
let readTopicIds = new Set();
let autoRefreshEnabled = true;
let progressTimer = null;
let currentProgress = 0;
let config = { ...DEFAULT_CONFIG };

// 板块配置
const CATEGORIES = [
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

const ICONS = {
  refresh: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
  timer: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
  posts: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
  views: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
  user: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
};

async function init() {
  const result = await chrome.storage.local.get(['readTopicIds', 'userSettings', 'config']);
  if (result.readTopicIds) readTopicIds = new Set(result.readTopicIds);
  if (result.config) config = { ...config, ...result.config };
  
  fillSubCategories();
  renderCategoryBlockList();
  loadConfigToUI();
  applyAppearance();

  if (result.userSettings) {
    const s = result.userSettings;
    autoRefreshEnabled = s.autoRefreshEnabled !== false;
    categoryFilter.value = s.categoryFilter || 'all';
    subCategoryFilter.value = s.subCategoryFilter || CATEGORIES[0].id;
    sortFilter.value = s.sortFilter || 'latest';
    if (autoRefreshEnabled) autoRefreshToggle.classList.add('active');
    toggleSubCategoryVisibility();
  }

  refreshBtn.innerHTML = ICONS.refresh;
  autoRefreshToggle.innerHTML = ICONS.timer;

  bindEvents();
  showSkeleton();
  await loadTopics();
  if (autoRefreshEnabled && config.pollingInterval > 0) startAutoRefresh();
  
  initContextMenu();
}

function loadConfigToUI() {
  pollingInterval.value = config.pollingInterval;
  lowDataMode.checked = config.lowDataMode;
  keywordBlacklist.value = config.keywordBlacklist;
  qualityFilter.checked = config.qualityFilter;
  hoverPreview.checked = config.hoverPreview;
  readStatusAction.value = config.readStatusAction;
  showBadge.checked = config.showBadge;
  notifyKeywords.value = config.notifyKeywords;
  fontSize.value = config.fontSize;
  compactMode.checked = config.compactMode;
  const syncReadStatus = document.getElementById('syncReadStatus');
  if (syncReadStatus) syncReadStatus.checked = config.syncReadStatus;
  
  const clickRadio = document.querySelector(`input[name="clickBehavior"][value="${config.clickBehavior}"]`);
  if (clickRadio) clickRadio.checked = true;

  const themeRadio = document.querySelector(`input[name="themeMode"][value="${config.themeMode || 'system'}"]`);
  if (themeRadio) themeRadio.checked = true;

  // 更新标签组状态
  document.querySelectorAll('.selectable-tag').forEach(tag => {
    const slug = tag.dataset.slug;
    if (config.blockCategories.includes(slug)) {
      tag.classList.add('blocked');
    } else {
      tag.classList.remove('blocked');
    }
  });
}

function renderCategoryBlockList() {
  categoryBlockList.innerHTML = CATEGORIES.map(c => `
    <div class="selectable-tag" data-slug="${c.slug}">${c.name}</div>
  `).join('');

  // 绑定标签点击事件
  document.querySelectorAll('.selectable-tag').forEach(tag => {
    tag.onclick = () => {
      const slug = tag.dataset.slug;
      if (config.blockCategories.includes(slug)) {
        config.blockCategories = config.blockCategories.filter(s => s !== slug);
        tag.classList.remove('blocked');
      } else {
        config.blockCategories.push(slug);
        tag.classList.add('blocked');
      }
      saveConfig();
    };
  });
}

function applyAppearance() {
  document.body.classList.remove('font-small', 'font-large', 'compact');
  if (config.fontSize === 'small') document.body.classList.add('font-small');
  if (config.fontSize === 'large') document.body.classList.add('font-large');
  if (config.compactMode) document.body.classList.add('compact');
  
  // 应用主题模式
  document.documentElement.setAttribute('data-theme', config.themeMode || 'system');
}

function fillSubCategories() {
  subCategoryFilter.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function toggleSubCategoryVisibility() {
  subCategoryContainer.style.display = categoryFilter.value === 'categories' ? 'block' : 'none';
}

function saveConfig() {
    const syncReadStatus = document.getElementById('syncReadStatus');
    config = {
      ...config,
      pollingInterval: parseInt(pollingInterval.value),
      lowDataMode: lowDataMode.checked,
      keywordBlacklist: keywordBlacklist.value,
      qualityFilter: qualityFilter.checked,
      hoverPreview: hoverPreview.checked,
      clickBehavior: document.querySelector('input[name="clickBehavior"]:checked').value,
      readStatusAction: readStatusAction.value,
      showBadge: showBadge.checked,
      notifyKeywords: notifyKeywords.value,
      fontSize: fontSize.value,
      compactMode: compactMode.checked,
      themeMode: document.querySelector('input[name="themeMode"]:checked').value,
      syncReadStatus: syncReadStatus ? syncReadStatus.checked : true
    };
  chrome.storage.local.set({ config });
  applyAppearance();
  renderTopics();
  if (autoRefreshEnabled) startAutoRefresh();
}

function bindEvents() {
  refreshBtn.onclick = handleManualRefresh;
  autoRefreshToggle.onclick = toggleAutoRefresh;
  categoryFilter.onchange = () => { toggleSubCategoryVisibility(); handleManualRefresh(); saveSettings(); };
  subCategoryFilter.onchange = () => { handleManualRefresh(); saveSettings(); };
  sortFilter.onchange = () => { renderTopics(); saveSettings(); };
  
  settingsBtn.onclick = () => settingsPanel.classList.add('open');
  closeSettingsBtn.onclick = () => settingsPanel.classList.remove('open');
  
  resetSettingsBtn.onclick = () => {
    if (confirm('确定要恢复默认设置吗？所有个性化配置将被重置。')) {
      config = { ...DEFAULT_CONFIG };
      chrome.storage.local.set({ config });
      loadConfigToUI();
      applyAppearance();
      renderTopics();
      if (autoRefreshEnabled) startAutoRefresh();
    }
  };

  [pollingInterval, lowDataMode, keywordBlacklist, qualityFilter, hoverPreview, readStatusAction, showBadge, notifyKeywords, fontSize, compactMode].forEach(el => {
    el.onchange = saveConfig;
  });
  document.querySelectorAll('input[name="clickBehavior"], input[name="themeMode"]').forEach(el => el.onchange = saveConfig);

  document.onclick = () => {
    const m = document.getElementById('customContextMenu');
    if (m) m.style.display = 'none';
  };
}

function showSkeleton() {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton-item';
    s.innerHTML = '<div class="skeleton-line" style="width:80%"></div><div class="skeleton-line" style="width:60%"></div><div class="skeleton-line" style="width:40%"></div>';
    fragment.appendChild(s);
  }
  topicList.innerHTML = '';
  topicList.appendChild(fragment);
}

async function loadTopics() {
  try {
    statusIndicator.classList.add('loading');
    let endpoint = '/latest.json';
    const cat = categoryFilter.value;
    
    if (cat === 'top') endpoint = '/top.json';
    else if (cat === 'categories') {
      const subId = subCategoryFilter.value;
      const subCat = CATEGORIES.find(c => c.id == subId);
      endpoint = `/c/${subCat.slug}/${subId}.json`;
    }

    const res = await chrome.runtime.sendMessage({ type: 'FETCH_API', endpoint });
    
    if (res && res.success && res.topics) {
      // 建立用户 ID 到用户数据的映射表，用于提取信任等级
      if (res.users) {
        window.allUsersMap = new Map(res.users.map(u => [u.id, u]));
      }
      
      allTopics = res.topics;
      checkNotifications(allTopics);
      renderTopics();
      updateTopicCount();
    } else {
      throw new Error(res.error || '获取数据失败');
    }
  } catch (e) {
    console.error('加载失败:', e);
    topicList.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-tertiary)">加载失败: ${e.message}</div>`;
  } finally {
    statusIndicator.classList.remove('loading');
  }
}

function checkNotifications(topics) {
  if (!config.notifyKeywords) return;
  const keywords = config.notifyKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
  const newTopics = topics.filter(t => isTopicRecent(t) && !readTopicIds.has(t.id));
  
  newTopics.forEach(t => {
    const title = t.title.toLowerCase();
    if (keywords.some(k => title.includes(k))) {
      chrome.runtime.sendMessage({ type: 'SHOW_NOTIFICATION', text: t.title });
    }
  });
}

function renderTopics() {
  let filtered = applyFilters(allTopics);
  const sorted = applySorting(filtered);
  
  if (config.showBadge) {
    const unreadCount = filtered.filter(t => !readTopicIds.has(t.id)).length;
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: unreadCount });
  } else {
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: 0 });
  }

  if (sorted.length === 0) {
    topicList.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-tertiary)">暂无内容 (可能被过滤)</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  sorted.forEach(t => fragment.appendChild(createTopicElement(t)));
  
  requestAnimationFrame(() => {
    topicList.innerHTML = '';
    topicList.appendChild(fragment);
  });
}

function applyFilters(topics) {
  let res = [...topics];
  
  // 分类屏蔽 (可视化标签组)
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

function createTopicElement(t) {
  const el = document.createElement('div');
  // 智能已读识别：本地记录 OR (同步开启且站内已读)
  const isSiteRead = config.syncReadStatus && t.last_read_post_number && t.last_read_post_number >= t.highest_post_number;
  const isRead = readTopicIds.has(t.id) || isSiteRead;
  el.className = `topic-item ${isRead && config.readStatusAction === 'fade' ? 'read' : ''}`;
  el.dataset.topicId = t.id;
  
  const time = formatTime(t.last_posted_at || t.created_at);
  const isNew = isTopicRecent(t);
  const cat = CATEGORIES.find(c => c.id == t.category_id) || { name: '其他', color: 'tag-default' };
  const excerpt = config.lowDataMode ? '' : (t.excerpt || t.title);

  let tagsHtml = `<span class="category-tag ${cat.color}">${cat.name}</span>`;
  if (t.tags && t.tags.length > 0) {
    t.tags.slice(0, 2).forEach(tag => {
      const tagColor = TAG_COLORS[tag] || 'tag-default';
      tagsHtml += `<span class="category-tag ${tagColor}" style="margin-left:4px">${tag}</span>`;
    });
  }

  // 提取信任等级 (从全局 users 数组中匹配)
  let trustLevel = 0;
  let isAdmin = false;
  
  if (t.posters && t.posters.length > 0) {
    // 优先查找最新发帖人 (latest)，因为 meta 显示的是最新发帖人名字
    const latestPoster = t.posters.find(p => p.extras === 'latest') || t.posters[t.posters.length - 1];
    const userId = latestPoster ? latestPoster.user_id : null;
    
    if (userId && window.allUsersMap && window.allUsersMap.has(userId)) {
      const userData = window.allUsersMap.get(userId);
      trustLevel = userData.trust_level || 0;
      isAdmin = userData.admin || false;
    }
  }
  const trustBadge = getTrustBadge(trustLevel, isAdmin);

  el.innerHTML = `
    ${isNew && !isRead ? '<div class="new-dot"></div>' : ''}
    <div class="tag-container">${tagsHtml}</div>
    <div class="topic-title">${escapeHtml(t.title)}</div>
    ${excerpt ? `<div class="topic-excerpt">${escapeHtml(excerpt)}</div>` : ''}
    <div class="topic-meta">
      <div class="meta-group">
        ${!config.lowDataMode ? ICONS.user : ''} <span>${t.last_poster_username || '匿名'}</span>
        ${trustBadge}
      </div>
      <div class="meta-group">
        ${ICONS.posts} <span>${formatNumber(t.posts_count)}</span>
        ${ICONS.views} <span>${formatNumber(t.views)}</span>
        <span style="margin-left:4px">${time}</span>
      </div>
    </div>
  `;

  el.onclick = (e) => handleTopicClick(t, e);
  el.oncontextmenu = (e) => { e.preventDefault(); showContextMenu(e, t); };

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

function handleTopicClick(t, e) {
  const url = `https://linux.do/t/${t.id}`;
  markAsRead(t.id, t.highest_post_number);
  
  const behavior = config.clickBehavior;
  if (behavior === 'background' || e.ctrlKey || e.metaKey || e.button === 1) {
    chrome.tabs.create({ url, active: false });
  } else {
    chrome.tabs.create({ url, active: true });
  }
}

function markAsRead(id, postNumber) {
  readTopicIds.add(id);
  
  // 如果开启了同步，则上报给站内
  if (config.syncReadStatus && postNumber) {
    chrome.runtime.sendMessage({ 
      type: 'MARK_READ_ON_SITE', 
      topicId: id, 
      postNumber: postNumber 
    });
  }

  const el = document.querySelector(`.topic-item[data-topic-id="${id}"]`);
  if (el) {
    if (config.readStatusAction === 'hide') {
      el.remove();
    } else if (config.readStatusAction === 'fade') {
      el.classList.add('read');
    }
    const dot = el.querySelector('.new-dot');
    if (dot) dot.remove();
  }
  chrome.storage.local.set({ readTopicIds: Array.from(readTopicIds) });
  renderTopics();
}

function initContextMenu() {
  if (!document.getElementById('customContextMenu')) {
    const m = document.createElement('div');
    m.id = 'customContextMenu';
    m.className = 'custom-menu';
    document.body.appendChild(m);
  }
}

function showContextMenu(e, t) {
  const m = document.getElementById('customContextMenu');
  const url = `https://linux.do/t/${t.id}`;
  m.innerHTML = `
    <div class="menu-item" onclick="copyText('${url}')">复制链接</div>
    <div class="menu-item" onclick="copyText('[${t.title.replace(/'/g, "\\'")}](${url})')">复制 Markdown</div>
    <div class="menu-item" onclick="toggleRead(${t.id})">标记为未读</div>
  `;
  m.style.display = 'block';
  m.style.left = `${Math.min(e.pageX, window.innerWidth - 160)}px`;
  m.style.top = `${Math.min(e.pageY, window.innerHeight - 120)}px`;
}

window.copyText = async (text) => {
  await navigator.clipboard.writeText(text);
};

window.toggleRead = (id) => {
  readTopicIds.delete(id);
  renderTopics();
  chrome.storage.local.set({ readTopicIds: Array.from(readTopicIds) });
};

function isTopicRecent(t) {
  return (new Date() - new Date(t.created_at)) < 14400000;
}

function formatTime(iso) {
  const d = new Date(iso);
  const diff = (new Date() - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function formatNumber(n) {
  return n >= 1000 ? (n/1000).toFixed(1) + 'k' : n;
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function applySorting(topics) {
  const s = sortFilter.value;
  const res = [...topics];
  if (s === 'latest') res.sort((a,b) => new Date(b.last_posted_at) - new Date(a.last_posted_at));
  if (s === 'created') res.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  if (s === 'views') res.sort((a,b) => b.views - a.views);
  if (s === 'replies') res.sort((a,b) => b.posts_count - a.posts_count);
  return res;
}

function startAutoRefresh() {
  stopAutoRefresh();
  if (config.pollingInterval === 0) return;
  
  currentProgress = 0;
  refreshProgress.style.width = '0%';
  
  progressTimer = setInterval(() => {
    currentProgress += (100 / config.pollingInterval);
    requestAnimationFrame(() => {
      refreshProgress.style.width = `${Math.min(currentProgress, 100)}%`;
    });
    if (currentProgress >= 100) {
      handleManualRefresh();
    }
  }, 1000);
}

function stopAutoRefresh() {
  clearInterval(progressTimer);
  refreshProgress.style.width = '0%';
}

function toggleAutoRefresh() {
  autoRefreshEnabled = !autoRefreshEnabled;
  autoRefreshToggle.classList.toggle('active');
  autoRefreshEnabled ? startAutoRefresh() : stopAutoRefresh();
  saveSettings();
}

async function handleManualRefresh() {
  currentProgress = 0;
  refreshProgress.style.width = '0%';
  await loadTopics();
}

function updateTopicCount() {
  topicCountEl.textContent = allTopics.length;
}

function saveSettings() {
  chrome.storage.local.set({ userSettings: { 
    autoRefreshEnabled, 
    categoryFilter: categoryFilter.value, 
    subCategoryFilter: subCategoryFilter.value,
    sortFilter: sortFilter.value 
  } });
}

function handleNewTopics(newTopics) {
  const ids = new Set(allTopics.map(t => t.id));
  const unique = newTopics.filter(t => !ids.has(t.id));
  if (unique.length > 0) {
    allTopics = [...unique, ...allTopics];
    checkNotifications(unique);
    renderTopics();
    updateTopicCount();
  }
}

function getTrustBadge(level, isAdmin) {
  if (isAdmin) {
    return `<span class="trust-badge admin" title="管理员">
      <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
    </span>`;
  }
  
  const badges = {
    4: { class: 'l4', title: '信任等级 4: 领袖', icon: '<path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5Z"/>' },
    3: { class: 'l3', title: '信任等级 3: 常任成员', icon: '<path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"/>' },
    2: { class: 'l2', title: '信任等级 2: 成员', icon: '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>' },
    1: { class: 'l1', title: '信任等级 1: 基本用户', icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>' }
  };
  
  const badge = badges[level];
  if (!badge) return '';
  
  return `<span class="trust-badge ${badge.class}" title="${badge.title}">
    <svg viewBox="0 0 24 24">${badge.icon}</svg>
  </span>`;
}

init();
