// API 工具模块 - 封装所有网络请求逻辑

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
 * 通用 API 请求函数（带重试和增强请求头）
 * @param {string} endpoint - API 端点
 * @param {number} retries - 重试次数
 * @returns {Promise<{success: boolean, topics?: array, users?: array, current_user?: object, error?: string}>}
 */
export async function fetchWithRetry(endpoint, retries = 2) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const jsonUrl = url.includes('.json') ? url : `${url}.json`;

  console.log(`[API] 请求开始: ${jsonUrl}`);

  try {
    console.log(`[API] 发起 fetch 请求...`);
    const response = await fetch(jsonUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': navigator.userAgent
      },
      credentials: 'include'
    });

    console.log(`[API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      if (response.status === 403 && retries > 0) {
        console.log(`[API] 403 错误，剩余重试次数: ${retries}`);
        return fetchWithRetry(url, retries - 1);
      }
      if (response.status === 429) {
        console.warn('[API] 触发速率限制 (429)');
        throw new Error('Too Many Requests (429)');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`[API] 原始响应数据结构:`, {
      hasTopicList: !!data.topic_list,
      hasTopics: !!data.topics,
      isArray: Array.isArray(data),
      topicListKeys: data.topic_list ? Object.keys(data.topic_list) : [],
      usersCount: data.users?.length || 0,
      currentUser: data.current_user
    });

    let topics = [];

    if (data.topic_list && data.topic_list.topics) {
      console.log(`[API] 从 topic_list.topics 提取数据，共 ${data.topic_list.topics.length} 条`);
      topics = data.topic_list.topics;
    } else if (data.topics) {
      console.log(`[API] 从 topics 提取数据，共 ${data.topics.length} 条`);
      topics = data.topics;
    } else if (Array.isArray(data)) {
      console.log(`[API] 从根数组提取数据，共 ${data.length} 条`);
      topics = data;
    } else {
      console.warn('[API] 无法识别的数据结构:', data);
    }

    // 打印第一条数据示例用于调试
    if (topics.length > 0) {
      console.log('[API] 第一条数据示例:', {
        id: topics[0].id,
        title: topics[0].title,
        category_id: topics[0].category_id,
        posters: topics[0].posters?.length || 0
      });
    } else {
      console.warn('[API] 警告: topics 数组为空');
    }

    return {
      success: true,
      topics,
      users: data.users,
      current_user: data.current_user
    };
  } catch (error) {
    console.error(`[API] 请求失败 [${jsonUrl}]:`, error);
    return { success: false, error: error.message, topics: [], users: [] };
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
  const result = await fetchUserFromAPI();

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
 * 从 API 获取当前登录用户
 * @private
 */
async function fetchUserFromAPI() {
  const apiUrl = `${BASE_URL}/session/current.json?_t=${Date.now()}`;

  try {
    // 获取 linux.do 的所有 Cookie
    const cookies = await chrome.cookies.getAll({ url: BASE_URL });
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // 构建请求头
    const requestHeaders = {
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json',
      'Discourse-Present': 'true',
      'Cookie': cookieHeader
    };

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: requestHeaders,
      credentials: 'include'
    });

    // 处理 429 错误
    if (response.status === 429) {
      return { loggedIn: false, user: null, rateLimited: true, error: 'Too Many Requests' };
    }

    if (!response.ok) {
      return { loggedIn: false, user: null, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (data.current_user !== null && data.current_user !== undefined) {
      return { loggedIn: true, user: data.current_user };
    } else {
      return { loggedIn: false, user: null };
    }
  } catch (error) {
    return { loggedIn: false, user: null, error: error.message };
  }
}

/**
 * 清除用户缓存
 */
export async function clearUserCache() {
  await chrome.storage.local.remove([CACHE_CONFIG.KEYS.USER_STATUS, CACHE_CONFIG.KEYS.RATE_LIMIT_UNTIL]);
}

/**
 * 退出登录
 */
export async function logout() {
  try {
    await fetch(`${BASE_URL}/logout`, {
      method: 'GET',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include'
    });
  } catch (error) {
    console.error('退出登录失败:', error);
  }
}

/**
 * 站内已读上报
 * @param {number} topicId - 主题 ID
 * @param {number} postNumber - 帖子编号
 */
export async function markReadOnSite(topicId, postNumber) {
  const formData = new FormData();
  formData.append('topic_id', topicId);
  formData.append('post_number', postNumber);

  fetch(`${BASE_URL}/topics/read`, {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: formData,
    credentials: 'include'
  }).catch(err => console.error('Mark read failed:', err));
}

export { BASE_URL };
