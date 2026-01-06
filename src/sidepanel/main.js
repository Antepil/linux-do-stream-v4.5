// 主入口文件 - 侧边栏调度逻辑

import { getAllData, saveConfig, saveReadTopics, saveUserSettings, getConfig, defaultConfig } from '../utils/storage.js';
import { fetchTopics, checkUserStatus, clearUserCache, logout, markReadOnSite } from '../utils/api.js';
import {
  initElements,
  showSkeleton,
  renderTopics,
  renderCategoryBlockList,
  fillSubCategories,
  updateUserButton,
  showUserDropdown,
  hideUserDropdown,
  applyAppearance,
  updateTopicCount,
  setLoading,
  bindRefreshIcon,
  bindAutoRefreshIcon,
  initContextMenu,
  CATEGORIES
} from './ui-render.js';
import { showToast } from '../utils/formatters.js';

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
const userBtn = document.getElementById('userBtn');
const settingsBtn = document.getElementById('settingsBtn');
const backToFeedBtn = document.getElementById('backToFeedBtn');
const settingsView = document.getElementById('settingsView');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');
const categoryBlockList = document.getElementById('categoryBlockList');

// 设置项元素
const pollingInterval = document.getElementById('pollingInterval');
const lowDataMode = document.getElementById('lowDataMode');
const keywordBlacklist = document.getElementById('keywordBlacklist');
const qualityFilter = document.getElementById('qualityFilter');
const hoverPreview = document.getElementById('hoverPreview');
const readStatusAction = document.getElementById('readStatusAction');
const showBadge = document.getElementById('showBadge');
const notifyKeywords = document.getElementById('notifyKeywords');
const fontSize = document.getElementById('fontSize');
const compactMode = document.getElementById('compactMode');

// 状态管理
let allTopics = [];
let readTopicIds = new Set();
let autoRefreshEnabled = true;
let progressTimer = null;
let currentProgress = 0;
let config = { ...defaultConfig };
let currentUser = null;
let userDropdownVisible = false;

// 初始化 DOM 元素
initElements({
  topicList, statusIndicator, topicCountEl, refreshBtn, autoRefreshToggle,
  categoryFilter, subCategoryFilter, sortFilter, refreshProgress,
  userBtn, settingsBtn, backToFeedBtn, settingsView, resetSettingsBtn,
  categoryBlockList, pollingInterval, lowDataMode, keywordBlacklist,
  qualityFilter, hoverPreview, readStatusAction, showBadge, notifyKeywords,
  fontSize, compactMode
});

/**
 * 初始化入口
 */
async function init() {
  // 加载存储数据
  const storedData = await getAllData();
  config = storedData.config;
  readTopicIds = storedData.readTopicIds;

  // 初始化 UI
  fillSubCategories(subCategoryFilter);
  renderCategoryBlockList(categoryBlockList, config.blockCategories, handleCategoryToggle);
  loadConfigToUI();
  applyAppearance(config);

  // 加载用户设置
  if (storedData.userSettings) {
    const s = storedData.userSettings;
    autoRefreshEnabled = s.autoRefreshEnabled !== false;
    categoryFilter.value = s.categoryFilter || 'all';
    subCategoryFilter.value = s.subCategoryFilter || CATEGORIES[0].id;
    sortFilter.value = s.sortFilter || 'latest';
    if (autoRefreshEnabled) autoRefreshToggle.classList.add('active');
    toggleSubCategoryVisibility();
  }

  // 绑定图标
  bindRefreshIcon();
  bindAutoRefreshIcon();

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
    const res = await fetchTopics(categoryFilter.value, subCategoryFilter.value, CATEGORIES);

    if (res && res.success && res.topics) {
      // 建立用户映射
      if (res.users) {
        window.allUsersMap = new Map(res.users.map(u => [u.id, u]));
      }

      allTopics = res.topics;
      checkNotifications(allTopics);
      renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick, handleContextMenu);
      updateTopicCount(allTopics.length);
    } else {
      throw new Error(res.error || '获取数据失败');
    }
  } catch (e) {
    console.error('加载失败:', e);
    topicList.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-tertiary)">加载失败: ${e.message}</div>`;
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
  renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick, handleContextMenu);
}

/**
 * 处理右键菜单
 */
function handleContextMenu(topic) {
  // 上下文菜单由 ui-render 处理
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
  saveConfig();
  renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick, handleContextMenu);
}

/**
 * 绑定事件
 */
function bindEvents() {
  refreshBtn.onclick = handleManualRefresh;
  autoRefreshToggle.onclick = toggleAutoRefresh;
  categoryFilter.onchange = () => { toggleSubCategoryVisibility(); handleManualRefresh(); saveSettings(); };
  subCategoryFilter.onchange = () => { handleManualRefresh(); saveSettings(); };
  sortFilter.onchange = () => { renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick, handleContextMenu); saveSettings(); };

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
      saveConfig();
      loadConfigToUI();
      applyAppearance(config);
      renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick, handleContextMenu);
      if (autoRefreshEnabled) startAutoRefresh();
    }
  };

  // 设置变更
  [pollingInterval, lowDataMode, keywordBlacklist, qualityFilter, hoverPreview, readStatusAction, showBadge, notifyKeywords, fontSize, compactMode].forEach(el => {
    el.onchange = saveConfig;
  });

  document.querySelectorAll('input[name="clickBehavior"], input[name="themeMode"]').forEach(el => {
    el.onchange = saveConfig;
  });

  // 点击其他地方关闭右键菜单
  document.onclick = () => {
    const m = document.getElementById('customContextMenu');
    if (m) m.style.display = 'none';
  };
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
 * 加载配置到 UI
 */
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

/**
 * 保存配置
 */
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

  saveConfig(config);
  applyAppearance(config);
  renderTopics(allTopics, config, readTopicIds, window.allUsersMap, handleTopicClick, handleContextMenu);
  if (autoRefreshEnabled) startAutoRefresh();
}

/**
 * 保存设置
 */
function saveSettings() {
  saveUserSettings({
    autoRefreshEnabled,
    categoryFilter: categoryFilter.value,
    subCategoryFilter: subCategoryFilter.value,
    sortFilter: sortFilter.value
  });
}

/**
 * 切换子分类可见性
 */
function toggleSubCategoryVisibility() {
  subCategoryContainer.style.display = categoryFilter.value === 'categories' ? 'block' : 'none';
}

/**
 * 手动刷新
 */
async function handleManualRefresh() {
  currentProgress = 0;
  refreshProgress.style.width = '0%';
  await loadTopics();
}

/**
 * 启动自动刷新
 */
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

/**
 * 停止自动刷新
 */
function stopAutoRefresh() {
  clearInterval(progressTimer);
  refreshProgress.style.width = '0%';
}

/**
 * 切换自动刷新
 */
function toggleAutoRefresh() {
  autoRefreshEnabled = !autoRefreshEnabled;
  autoRefreshToggle.classList.toggle('active');
  autoRefreshEnabled ? startAutoRefresh() : stopAutoRefresh();
  saveSettings();
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

// 启动
init();
