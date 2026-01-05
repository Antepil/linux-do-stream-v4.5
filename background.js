// Linux.do 主题流 v4.0 - 全能版后台服务

const BASE_URL = 'https://linux.do';

// 监听来自侧边栏的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_API') {
    fetchWithRetry(message.endpoint).then(sendResponse);
    return true;
  }

  if (message.type === 'UPDATE_BADGE') {
    updateBadge(message.count);
    return true;
  }

  if (message.type === 'SHOW_NOTIFICATION') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: 'Linux.do 强提醒',
      message: message.text,
      priority: 2
    });
    return true;
  }

  // 检查用户登录状态
  if (message.type === 'CHECK_USER_STATUS') {
    checkUserStatus().then(sendResponse);
    return true;
  }

  // 清除用户缓存（手动刷新时）
  if (message.type === 'CLEAR_USER_CACHE') {
    clearUserCache();
    sendResponse({ success: true });
    return true;
  }

  // 退出登录
  if (message.type === 'LOGOUT') {
    logout().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // 站内已读上报
  if (message.type === 'MARK_READ_ON_SITE') {
    const formData = new FormData();
    formData.append('topic_id', message.topicId);
    formData.append('post_number', message.postNumber);

    fetch(`${BASE_URL}/topics/read`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData,
      credentials: 'include'
    })
    .then(res => res.json())
    .then(data => console.log('Mark read success:', data))
    .catch(err => console.error('Mark read failed:', err));
    return true;
  }
});

// 更新图标角标
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count > 99 ? '99+' : count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#FF3B30' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// 带有重试和增强请求头的抓取函数
async function fetchWithRetry(endpoint, retries = 2) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const jsonUrl = url.includes('.json') ? url : `${url}.json`;

  try {
    const response = await fetch(jsonUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      },
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 403 && retries > 0) {
        return fetchWithRetry(url, retries - 1);
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    let topics = [];

    if (data.topic_list && data.topic_list.topics) {
      topics = data.topic_list.topics;
    } else if (data.topics) {
      topics = data.topics;
    } else if (Array.isArray(data)) {
      topics = data;
    }

    return {
      success: true,
      topics,
      users: data.users,
      current_user: data.current_user
    };
  } catch (error) {
    console.error(`抓取失败 [${jsonUrl}]:`, error);
    return { success: false, error: error.message, topics: [], users: [] };
  }
}

// 点击图标打开侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// 配置常量
const USER_CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const RATE_LIMIT_COOLDOWN = 60 * 1000; // 429冷却时间：1分钟

// 缓存键名
const CACHE_KEYS = {
  USER_STATUS: 'cachedUserStatus',
  RATE_LIMIT_UNTIL: 'rateLimitUntil'
};

// 检查用户登录状态 - 使用缓存和防封机制
async function checkUserStatus() {
  console.log('[UserAuth] === 开始检查登录状态 ===');

  const now = Date.now();

  // 1. 检查是否在冷却期（429错误后）
  const rateLimitData = await chrome.storage.local.get(CACHE_KEYS.RATE_LIMIT_UNTIL);
  if (rateLimitData[CACHE_KEYS.RATE_LIMIT_UNTIL] && now < rateLimitData[CACHE_KEYS.RATE_LIMIT_UNTIL]) {
    const remaining = Math.ceil((rateLimitData[CACHE_KEYS.RATE_LIMIT_UNTIL] - now) / 1000);
    console.log('[UserAuth] 冷却期中，剩余', remaining, '秒');
    return { loggedIn: false, user: null, rateLimited: true, retryAfter: remaining };
  }

  // 2. 尝试从缓存读取
  const cachedData = await chrome.storage.local.get(CACHE_KEYS.USER_STATUS);
  if (cachedData[CACHE_KEYS.USER_STATUS]) {
    const cache = cachedData[CACHE_KEYS.USER_STATUS];
    const cacheAge = now - cache.timestamp;

    if (cacheAge < USER_CACHE_TTL && cache.user) {
      console.log('[UserAuth] 使用缓存，缓存年龄:', Math.round(cacheAge / 1000), '秒');
      return cache;
    } else if (cacheAge < USER_CACHE_TTL && !cache.user) {
      // 缓存显示未登录且未过期，直接返回
      console.log('[UserAuth] 缓存显示未登录，缓存年龄:', Math.round(cacheAge / 1000), '秒');
      return cache;
    }
    console.log('[UserAuth] 缓存已过期，需要重新请求');
  }

  // 3. 发起网络请求
  console.log('[UserAuth] 发起网络请求...');
  const result = await fetchUserFromAPI();

  // 4. 保存结果到缓存
  const cacheToSave = {
    ...result,
    timestamp: now
  };
  await chrome.storage.local.set({ [CACHE_KEYS.USER_STATUS]: cacheToSave });

  // 5. 如果是 429 错误，设置冷却期
  if (result.rateLimited) {
    const cooldownUntil = now + RATE_LIMIT_COOLDOWN;
    await chrome.storage.local.set({ [CACHE_KEYS.RATE_LIMIT_UNTIL]: cooldownUntil });
    console.log('[UserAuth] 429错误，已设置冷却期到:', new Date(cooldownUntil).toLocaleTimeString());
  }

  console.log('[UserAuth] === 检查完成 ===');
  return result;
}

// 从 API 获取用户状态
async function fetchUserFromAPI() {
  // 添加时间戳防止缓存
  const apiUrl = `${BASE_URL}/session/current.json?_t=${Date.now()}`;
  console.log('[UserAuth] 请求 URL:', apiUrl);

  try {
    // 获取 linux.do 的所有 Cookie
    const cookies = await chrome.cookies.getAll({ url: BASE_URL });
    const cookieNames = cookies.map(c => c.name);
    console.log('[UserAuth] 获取到 Cookie 数量:', cookies.length);
    console.log('[UserAuth] Cookie 名称:', cookieNames.join(', '));

    // 构建 Cookie 请求头
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // 强制注入 Discourse 必需的 Headers
    const requestHeaders = {
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json',
      'Discourse-Present': 'true',
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0'
    };

    console.log('[UserAuth] === 最终发送的 Headers ===');
    console.log('[UserAuth]', JSON.stringify(requestHeaders, null, 2));

    // 使用 Discourse 标准 API 获取当前登录用户
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: requestHeaders,
      credentials: 'include'
    });

    console.log('[UserAuth] HTTP 状态码:', response.status);
    console.log('[UserAuth] HTTP 状态文本:', response.statusText);

    // 处理 429 错误
    if (response.status === 429) {
      console.warn('[UserAuth] 触发速率限制 (429)');
      return { loggedIn: false, user: null, rateLimited: true, error: 'Too Many Requests' };
    }

    if (!response.ok) {
      console.error('[UserAuth] HTTP 错误:', response.status, response.statusText);
      return { loggedIn: false, user: null, error: `HTTP ${response.status}` };
    }

    // 读取响应文本
    const responseText = await response.text();
    console.log('[UserAuth] 原始响应长度:', responseText.length, '字符');
    console.log('[UserAuth] 原始响应内容:', responseText);

    // 解析 JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[UserAuth] JSON 解析失败:', e);
      return { loggedIn: false, user: null, error: 'JSON解析失败' };
    }

    // 判断逻辑：必须有 current_user 字段且不为 null
    if (data.current_user !== null && data.current_user !== undefined) {
      console.log('[UserAuth] 已登录，用户:', data.current_user.username);
      console.log('[UserAuth] 用户详细信息:', JSON.stringify(data.current_user, null, 2));
      return { loggedIn: true, user: data.current_user };
    } else {
      console.log('[UserAuth] 未登录 (current_user 为 null/undefined)');
      console.log('[UserAuth] 响应中的所有键:', Object.keys(data));
      return { loggedIn: false, user: null };
    }
  } catch (error) {
    console.error('[UserAuth] 请求异常:', error);
    return { loggedIn: false, user: null, error: error.message };
  }
}

// 清除用户缓存（用户手动刷新时调用）
async function clearUserCache() {
  await chrome.storage.local.remove([CACHE_KEYS.USER_STATUS, CACHE_KEYS.RATE_LIMIT_UNTIL]);
  console.log('[UserAuth] 缓存已清除');
}

// 退出登录
async function logout() {
  try {
    await fetch(`${BASE_URL}/logout`, {
      method: 'GET',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include'
    });
    console.log('退出登录成功');
  } catch (error) {
    console.error('退出登录失败:', error);
  }
}
