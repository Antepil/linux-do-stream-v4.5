// 主入口文件 - 侧边栏调度逻辑

import { getAllData, saveConfig, saveReadTopics, defaultConfig } from '../utils/storage.js';
import { showToast } from '../utils/formatters.js';
import { fetchTopics, checkUserStatus, clearUserCache, logout, markReadOnSite } from '../utils/api.js';
import {
  initElements,
  showSkeleton,
  renderTopics,
  renderCategoryBlockList,
  renderCategoryTags,
  updateUserButton,
  showUserDropdown,
  hideUserDropdown,
  applyAppearance,
  updateTopicCount,
  setLoading,
  bindRefreshIcon,
  initContextMenu,
  CATEGORIES
} from './ui-render.js';
import { initAIPanel } from './ai-panel.js';

// DOM 元素
const topicList = document.getElementById('topicList');
const statusIndicator = document.getElementById('statusIndicator');
const topicCountEl = document.getElementById('topicCount');
const refreshBtn = document.getElementById('refreshBtn');
const settingsBtn = document.getElementById('settingsBtn');
const categoryTags = document.getElementById('categoryTags');
const userBtn = document.getElementById('userBtn');
const backToFeedBtn = document.getElementById('backToFeedBtn');
const settingsView = document.getElementById('settingsView');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');
const categoryBlockList = document.getElementById('categoryBlockList');
const toggleCategoryBtn = document.getElementById('toggleCategoryBtn');

// 设置项元素
const pollingInterval = document.getElementById('pollingInterval');
const keywordBlacklist = document.getElementById('keywordBlacklist');
const fontSize = document.getElementById('fontSize');
const compactMode = document.getElementById('compactMode');

// 状态管理
let allTopics = [];
let readTopicIds = new Set();
let autoRefreshEnabled = true;
let config = { ...defaultConfig };
let currentUser = null;
let userDropdownVisible = false;

// 初始化 DOM 元素
initElements({
  topicList, statusIndicator, topicCount: topicCountEl, refreshBtn, settingsBtn,
  userBtn, backToFeedBtn, settingsView, resetSettingsBtn,
  categoryBlockList, pollingInterval, keywordBlacklist,
  fontSize, compactMode
});

/**
 * AI配置变更回调
 */
function handleAIConfigChange(newConfig) {
  config = { ...config, ...newConfig };
  saveConfig(config);
  window.config = config;
}

/**
 * 初始化入口
 */
async function init() {
  // 加载存储数据
  const storedData = await getAllData();
  config = storedData.config;
  readTopicIds = storedData.readTopicIds;

  // 设置全局config供AI模块使用
  window.config = config;

  // 初始化 UI
  renderCategoryBlockList(categoryBlockList, config.blockCategories, handleCategoryToggle);
  loadConfigToUI();
  applyAppearance(config);

  // 初始化AI面板
  initAIPanel(config, handleAIConfigChange);

  // 初始化分类筛选
  initCategoryFilter();

  // 绑定图标
  bindRefreshIcon();

  // 初始化用户状态
  await checkAndUpdateUserStatus();

  // 绑定事件
  bindEvents();

  // 初始化
  showSkeleton();
  await loadTopics();

  if (autoRefreshEnabled && config.pollingInterval > 0) {
    startAutoRefresh();
  }

  initContextMenu();
}

/**
 * 切换分类标签显示/隐藏
 */
function toggleCategoryVisibility() {
  const isExpanded = categoryTags.style.display !== 'none';

  if (isExpanded) {
    // 收起
    categoryTags.style.display = 'none';
    toggleCategoryBtn.textContent = '展开 ∨';
    localStorage.setItem('categoryFilterCollapsed', 'true');
  } else {
    // 展开
    categoryTags.style.display = '';
    toggleCategoryBtn.textContent = '收起 ∨';
    localStorage.setItem('categoryFilterCollapsed', 'false');
  }
}

/**
 * 初始化分类筛选 - 默认显示全部分类
 */
function initCategoryFilter() {
  // 默认选中全部分类
  const defaultSlugs = CATEGORIES.map(c => c.slug);

  // 从存储获取用户上次的选择
  const storedSettings = JSON.parse(localStorage.getItem('categoryFilterState') || '{}');
  let selectedCategories = storedSettings.selectedSlugs && storedSettings.selectedSlugs.length > 0
    ? storedSettings.selectedSlugs
    : defaultSlugs;

  // 验证存储的分类是否有效
  const validSlugs = new Set(defaultSlugs);
  const isValid = selectedCategories.every(slug => validSlugs.has(slug));

  // 如果存储的分类无效（包含不存在的 slug）或只有 1 个分类，则重置为全部分类
  if (!isValid || selectedCategories.length <= 1) {
    selectedCategories = defaultSlugs;
    localStorage.setItem('categoryFilterState', JSON.stringify({ selectedSlugs: defaultSlugs }));
  }

  // 获取折叠状态
  const isCollapsed = localStorage.getItem('categoryFilterCollapsed') === 'true';

  // 根据折叠状态设置初始显示
  if (isCollapsed) {
    categoryTags.style.display = 'none';
    toggleCategoryBtn.textContent = '展开 ∨';
  } else {
    categoryTags.style.display = '';
    toggleCategoryBtn.textContent = '收起 ∨';
  }

  // 渲染所有分类标签
  renderCategoryTags(categoryTags, CATEGORIES, selectedCategories, handleCategoryTagToggle);

  // 绑定收起/展开按钮
  toggleCategoryBtn.onclick = toggleCategoryVisibility;

  // 保存到全局
  window.selectedCategorySlugs = selectedCategories;
}

/**
 * 处理分类标签切换
 */
function handleCategoryTagToggle(slug) {
  if (!categoryTags) return;

  let selectedSlugs = window.selectedCategorySlugs || CATEGORIES.map(c => c.slug);

  if (selectedSlugs.includes(slug)) {
    // 如果已经选中，至少保留一个分类
    if (selectedSlugs.length > 1) {
      selectedSlugs = selectedSlugs.filter(s => s !== slug);
    }
  } else {
    selectedSlugs.push(slug);
  }

  window.selectedCategorySlugs = selectedSlugs;

  // 保存到 localStorage
  localStorage.setItem('categoryFilterState', JSON.stringify({ selectedSlugs }));

  // 更新 UI
  renderCategoryTags(categoryTags, CATEGORIES, selectedSlugs, handleCategoryTagToggle);

  // 刷新列表
  handleManualRefresh();
}

/**
 * 检查并更新用户状态
 */
async function checkAndUpdateUserStatus() {
  userBtn.innerHTML = '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

  const res = await checkUserStatus();

  if (res && res.loggedIn && res.user) {
    currentUser = res.user;
    updateUserButton(true, currentUser);
  } else if (res && res.rateLimited) {
    currentUser = null;
    updateUserButton(false, null);
    const retryAfter = res.retryAfter || 60;
    showToast(`请求过于频繁，请 ${retryAfter} 秒后再试`);
  } else {
    currentUser = null;
    updateUserButton(false, null);
  }
}

/**
 * 加载主题
 */
async function loadTopics() {
  try {
    setLoading(true);
    console.log('[Main] 开始加载主题...');
    // 始终请求 latest.json，然后在客户端过滤
    const res = await fetchTopics('latest', null, CATEGORIES);
    console.log('[Main] API 返回结果:', { success: res.success, topicsCount: res.topics?.length, error: res.error });

    if (res && res.success && res.topics && res.topics.length > 0) {
      // 建立用户映射
      if (res.users) {
        window.allUsersMap = new Map(res.users.map(u => [u.id, u]));
        console.log('[Main] 用户映射已建立:', window.allUsersMap.size, '个用户');
      } else {
        console.warn('[Main] 警告: API 未返回 users 数组');
      }

      // 调试：统计各分类的帖子数量
      const categoryCount = {};
      const unknownIds = {};
      res.topics.forEach(t => {
        // 使用 == 进行宽松比较（兼容字符串和数字）
        const cat = CATEGORIES.find(c => c && String(c.id) === String(t.category_id));
        const slug = cat ? cat.slug : 'unknown';
        categoryCount[slug] = (categoryCount[slug] || 0) + 1;
        if (!cat) {
          unknownIds[t.category_id] = (unknownIds[t.category_id] || 0) + 1;
        }
      });
      console.log('[Main] API 返回的分类统计:', categoryCount);
      console.log('[Main] 未匹配的 category_id 及数量:', unknownIds);
      console.log('[Main] CATEGORIES 中的 ID:', CATEGORIES.map(c => c.id + ''));

      // 临时：显示所有帖子（不按分类过滤）
      allTopics = res.topics;

      // 打印每个帖子的 category_id（用于调试）
      console.log('[Main] 前10个帖子的 category_id:', res.topics.slice(0, 10).map(t => ({ id: t.id, category_id: t.category_id, title: t.title?.slice(0, 20) })));

      checkNotifications(allTopics);
      renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick);
      updateTopicCount(allTopics.length);
      console.log('[Main] 渲染完成，共', allTopics.length, '条主题 (从', res.topics.length, '条中筛选)');
    } else if (res && res.success && res.topics && res.topics.length === 0) {
      console.warn('[Main] 主题列表为空');
      topicList.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-tertiary)">暂无内容 (可能被过滤)</div>`;
      updateTopicCount(0);
    } else {
      throw new Error(res?.error || '获取数据失败');
    }
  } catch (e) {
    console.error('[Main] 加载失败:', e);
    // 显示错误信息和重试按钮
    topicList.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-tertiary)">
        <div style="margin-bottom:16px">加载失败: ${e.message || '网络错误'}</div>
        <button id="retryBtn" style="
          background:var(--primary);
          color:white;
          border:none;
          padding:8px 24px;
          border-radius:8px;
          cursor:pointer;
          font-size:14px;
        ">点击重试</button>
      </div>
    `;
    document.getElementById('retryBtn')?.addEventListener('click', handleManualRefresh);
  } finally {
    setLoading(false);
  }
}

/**
 * 检查通知
 */
function checkNotifications(topics) {
  if (!config.notifyKeywords) return;
  const keywords = config.notifyKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
  const newTopics = topics.filter(t => (new Date() - new Date(t.created_at)) < 14400000 && !readTopicIds.has(t.id));

  newTopics.forEach(t => {
    const title = t.title.toLowerCase();
    if (keywords.some(k => title.includes(k))) {
      chrome.runtime.sendMessage({ type: 'SHOW_NOTIFICATION', text: t.title });
    }
  });
}

/**
 * 处理主题点击
 */
function handleTopicClick(topic, e) {
  const url = `https://linux.do/t/${topic.id}`;
  markAsRead(topic.id, topic.highest_post_number);

  const behavior = config.clickBehavior;
  if (behavior === 'background' || e.ctrlKey || e.metaKey || e.button === 1) {
    chrome.tabs.create({ url, active: false });
  } else {
    chrome.tabs.create({ url, active: true });
  }
}

/**
 * 标记为已读
 */
function markAsRead(id, postNumber) {
  readTopicIds.add(id);

  if (config.syncReadStatus && postNumber) {
    markReadOnSite(id, postNumber);
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

  saveReadTopics(readTopicIds);
  renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick);
}

/**
 * 处理分类切换
 */
function handleCategoryToggle(slug) {
  if (config.blockCategories.includes(slug)) {
    config.blockCategories = config.blockCategories.filter(s => s !== slug);
  } else {
    config.blockCategories.push(slug);
  }
  saveConfig(config);
  // 更新屏蔽列表视觉状态
  renderCategoryBlockList(categoryBlockList, config.blockCategories, handleCategoryToggle);
  renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick);
}

/**
 * 绑定事件
 */
function bindEvents() {
  refreshBtn.onclick = handleManualRefresh;

  // Header tabs 切换 - 简化逻辑，不再联动筛选栏
  document.querySelectorAll('.header-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.header-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      handleManualRefresh();
    };
  });

  // 点击其他地方关闭右键菜单
  document.addEventListener('click', (e) => {
    const m = document.getElementById('customContextMenu');
    if (m && !e.target.closest('.custom-menu') && !e.target.closest('.topic-item')) {
      m.style.display = 'none';
    }
  });

  // 用户按钮
  userBtn.onclick = (e) => {
    e.stopPropagation();
    if (userDropdownVisible) {
      hideUserDropdown();
      userDropdownVisible = false;
    } else {
      showUserDropdown(currentUser, handleUserAction);
      userDropdownVisible = true;
    }
  };

  // 设置页面切换
  settingsBtn.onclick = () => toggleSettingsView(true);
  backToFeedBtn.onclick = () => toggleSettingsView(false);

  // 重置设置
  resetSettingsBtn.onclick = () => {
    if (confirm('确定要恢复默认设置吗？所有个性化配置将被重置。')) {
      config = { ...defaultConfig };
      updateConfigFromUI();
      loadConfigToUI();
      applyAppearance(config);
      // 重置分类筛选
      localStorage.removeItem('categoryFilterState');
      localStorage.removeItem('categoryFilterCollapsed');
      initCategoryFilter();
      renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick);
      if (autoRefreshEnabled) startAutoRefresh();
    }
  };

  // 设置变更
  [pollingInterval, keywordBlacklist, fontSize].forEach(el => {
    el.onchange = updateConfigFromUI;
  });
}

/**
 * 处理用户下拉菜单操作
 */
function handleUserAction(action) {
  hideUserDropdown();
  userDropdownVisible = false;

  switch (action) {
    case 'login':
      chrome.tabs.create({ url: 'https://linux.do/login' });
      break;
    case 'profile':
      if (currentUser) {
        chrome.tabs.create({ url: `https://linux.do/u/${currentUser.username}` });
      }
      break;
    case 'logout':
      doLogout();
      break;
  }
}

/**
 * 执行退出登录
 */
async function doLogout() {
  await logout();
  currentUser = null;
  updateUserButton(false, null);
  await clearUserCache();
  location.reload();
}

/**
 * 切换设置页面显示
 * @param {boolean} show - true 显示设置页，false 显示主页
 */
function toggleSettingsView(show) {
  if (show) {
    settingsView.classList.add('visible');
  } else {
    settingsView.classList.remove('visible');
  }
}

/**
 * 加载配置到 UI
 */
function loadConfigToUI() {
  pollingInterval.value = config.pollingInterval;
  keywordBlacklist.value = config.keywordBlacklist || '';
  fontSize.value = config.fontSize || 'medium';
  compactMode.checked = config.compactMode || false;

  // 更新分类标签状态
  document.querySelectorAll('.selectable-tag').forEach(tag => {
    const slug = tag.dataset.slug;
    if (config.blockCategories.includes(slug)) {
      tag.classList.add('blocked');
    } else {
      tag.classList.remove('blocked');
    }
  });
}

/**
 * 保存配置
 */
function updateConfigFromUI() {
  config = {
    ...config,
    pollingInterval: parseInt(pollingInterval.value) || 60,
    keywordBlacklist: keywordBlacklist.value,
    fontSize: fontSize.value,
    compactMode: compactMode.checked
  };
  saveConfig(config);
  applyAppearance(config);
  renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick);
}

// 定时器 ID
let refreshTimer = null;

/**
 * 手动刷新
 */
async function handleManualRefresh() {
  await loadTopics();
}

/**
 * 启动自动刷新
 */
function startAutoRefresh() {
  stopAutoRefresh();
  if (config.pollingInterval > 0) {
    refreshTimer = setInterval(() => {
      loadTopics();
    }, config.pollingInterval * 1000);
    console.log('[Main] 自动刷新已启动，间隔', config.pollingInterval, '秒');
  }
}

/**
 * 停止自动刷新
 */
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 启动
init();
