// API 工具模块 - 通过 background service worker 发送所有网络请求
// Manifest V3 要求跨域请求必须通过 background service worker

const BASE_URL = 'https://linux.do';

// 缓存配置
const CACHE_CONFIG = {
  USER_STATUS_TTL: 5 * 60 * 1000, // 5分钟
  RATE_LIMIT_COOLDOWN: 5 * 1000,  // 5秒
  KEYS: {
    USER_STATUS: 'cachedUserStatus',
    RATE_LIMIT_UNTIL: 'rateLimitUntil'
  }
};

/**
 * 通过 background service worker 发送 API 请求
 * @param {string} endpoint - API 端点
 * @param {number} retries - 重试次数
 * @returns {Promise<{success: boolean, topics?: array, users?: array, current_user?: object, error?: string}>}
 */
export async function fetchWithRetry(endpoint, retries = 2) {
  console.log(`[API] 请求开始: ${endpoint}`);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_API',
      endpoint: endpoint,
      retries: retries
    });

    console.log(`[API] 响应结果:`, response);
    return response;
  } catch (error) {
    console.error(`[API] 请求失败 [${endpoint}]:`, error);
    return { success: false, error: error.message, topics: [], users: [] };
  }
}

/**
 * 通过 background service worker 获取帖子详情
 * @param {number} topicId - 主题 ID
 * @returns {Promise<{success: boolean, posts?: array, topic?: object, error?: string}>}
 */
export async function fetchPosts(topicId) {
  console.log(`[API] 获取帖子详情: ${topicId}`);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_POSTS',
      topicId: topicId
    });

    console.log(`[API] 帖子响应:`, response);
    return response;
  } catch (error) {
    console.error(`[API] 获取帖子失败 [${topicId}]:`, error);
    return { success: false, error: error.message, posts: [] };
  }
}

/**
 * 获取主题列表
 * @param {string} categoryFilter - 分类过滤器
 * @param {string} subCategoryFilter - 子分类过滤器
 * @param {object} categories - 分类映射
 * @returns {Promise<{success: boolean, topics?: array, users?: array}>}
 */
export async function fetchTopics(categoryFilter, subCategoryFilter, categories) {
  let endpoint = '/latest.json';

  if (categoryFilter === 'top') {
    endpoint = '/top.json';
  } else if (categoryFilter === 'categories' && subCategoryFilter) {
    const subCat = categories.find(c => c.id == subCategoryFilter);
    if (subCat) {
      endpoint = `/c/${subCat.slug}/${subCategoryFilter}.json`;
    }
  }

  return fetchWithRetry(endpoint);
}

/**
 * 检查用户登录状态（带缓存和防封机制）
 * @returns {Promise<{loggedIn: boolean, user?: object, rateLimited?: boolean, retryAfter?: number}>}
 */
export async function checkUserStatus() {
  const now = Date.now();

  // 1. 检查是否在冷却期（429错误后）
  const rateLimitData = await chrome.storage.local.get(CACHE_CONFIG.KEYS.RATE_LIMIT_UNTIL);
  if (rateLimitData[CACHE_CONFIG.KEYS.RATE_LIMIT_UNTIL] &&
      now < rateLimitData[CACHE_CONFIG.KEYS.RATE_LIMIT_UNTIL]) {
    const remaining = Math.ceil((rateLimitData[CACHE_CONFIG.KEYS.RATE_LIMIT_UNTIL] - now) / 1000);
    return { loggedIn: false, user: null, rateLimited: true, retryAfter: remaining };
  }

  // 2. 尝试从缓存读取
  const cachedData = await chrome.storage.local.get(CACHE_CONFIG.KEYS.USER_STATUS);
  if (cachedData[CACHE_CONFIG.KEYS.USER_STATUS]) {
    const cache = cachedData[CACHE_CONFIG.KEYS.USER_STATUS];
    const cacheAge = now - cache.timestamp;

    if (cacheAge < CACHE_CONFIG.USER_STATUS_TTL && cache.user) {
      return cache;
    } else if (cacheAge < CACHE_CONFIG.USER_STATUS_TTL && !cache.user) {
      return cache;
    }
  }

  // 3. 发起网络请求
  const result = await chrome.runtime.sendMessage({ type: 'CHECK_USER_STATUS' });

  // 4. 保存结果到缓存
  const cacheToSave = { ...result, timestamp: now };
  await chrome.storage.local.set({ [CACHE_CONFIG.KEYS.USER_STATUS]: cacheToSave });

  // 5. 如果是 429 错误，设置冷却期
  if (result.rateLimited) {
    const cooldownUntil = now + CACHE_CONFIG.RATE_LIMIT_COOLDOWN;
    await chrome.storage.local.set({ [CACHE_CONFIG.KEYS.RATE_LIMIT_UNTIL]: cooldownUntil });
  }

  return result;
}

/**
 * 清除用户缓存
 */
export async function clearUserCache() {
  await chrome.runtime.sendMessage({ type: 'CLEAR_USER_CACHE' });
}

/**
 * 退出登录
 */
export async function logout() {
  await chrome.runtime.sendMessage({ type: 'LOGOUT' });
}

/**
 * 站内已读上报
 * @param {number} topicId - 主题 ID
 * @param {number} postNumber - 帖子编号
 */
export async function markReadOnSite(topicId, postNumber) {
  chrome.runtime.sendMessage({
    type: 'MARK_READ_ON_SITE',
    topicId: topicId,
    postNumber: postNumber
  });
}

export { BASE_URL };
