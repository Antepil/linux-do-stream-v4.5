// Storage 工具模块 - 封装 chrome.storage.local 操作

// 默认配置
export const DEFAULT_CONFIG = {
  pollingInterval: 30,
  lowDataMode: false,
  blockCategories: [],
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
  syncReadStatus: true,
  aiEnabled: true,
  aiApiUrl: '',
  aiApiKey: '',
  aiModel: 'MiniMax-M2.1',
  aiTemperature: 0.7,
  aiSummaryDepth: 'smart'
};

/**
 * 获取完整配置
 * @returns {Promise<object>}
 */
export async function getConfig() {
  const result = await chrome.storage.local.get(['config']);
  return result.config ? { ...DEFAULT_CONFIG, ...result.config } : { ...DEFAULT_CONFIG };
}

/**
 * 保存配置
 * @param {object} config - 配置对象
 */
export async function saveConfig(config) {
  await chrome.storage.local.set({ config });
}

/**
 * 获取已读主题 ID 集合
 * @returns {Promise<Set<number>>}
 */
export async function getReadTopics() {
  const result = await chrome.storage.local.get(['readTopicIds']);
  return result.readTopicIds ? new Set(result.readTopicIds) : new Set();
}

/**
 * 保存已读主题 ID
 * @param {Set<number>} readTopicIds
 */
export async function saveReadTopics(readTopicIds) {
  await chrome.storage.local.set({ readTopicIds: Array.from(readTopicIds) });
}

/**
 * 获取用户界面设置
 * @returns {Promise<object>}
 */
export async function getUserSettings() {
  const result = await chrome.storage.local.get(['userSettings']);
  return result.userSettings || null;
}

/**
 * 保存用户界面设置
 * @param {object} settings
 */
export async function saveUserSettings(settings) {
  await chrome.storage.local.set({ userSettings: settings });
}

/**
 * 获取所有存储数据（用于初始化）
 * @returns {Promise<{config: object, readTopicIds: Set, userSettings: object}>}
 */
export async function getAllData() {
  const result = await chrome.storage.local.get(['config', 'readTopicIds', 'userSettings']);

  return {
    config: result.config ? { ...DEFAULT_CONFIG, ...result.config } : { ...DEFAULT_CONFIG },
    readTopicIds: result.readTopicIds ? new Set(result.readTopicIds) : new Set(),
    userSettings: result.userSettings || null
  };
}

/**
 * 清除所有存储数据
 */
export async function clearAll() {
  await chrome.storage.local.clear();
}

export { DEFAULT_CONFIG as defaultConfig };
