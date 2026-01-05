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

// 检查用户登录状态 - 使用 Discourse 标准 API
async function checkUserStatus() {
  const apiUrl = `${BASE_URL}/session/current.json`;

  console.log('[UserAuth] === 开始检查登录状态 ===');
  console.log('[UserAuth] 请求 URL:', apiUrl);

  try {
    // 获取 linux.do 的所有 Cookie
    const cookies = await chrome.cookies.getAll({ url: BASE_URL });
    const cookieNames = cookies.map(c => c.name);
    console.log('[UserAuth] 获取到 Cookie 数量:', cookies.length);
    console.log('[UserAuth] Cookie 名称:', cookieNames.join(', '));

    // 构建 Cookie 请求头
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    console.log('[UserAuth] 发起 fetch 请求...');

    // 使用 Discourse 标准 API 获取当前登录用户
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookieHeader,
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0'
      }
    });

    console.log('[UserAuth] HTTP 状态码:', response.status);
    console.log('[UserAuth] HTTP 状态文本:', response.statusText);

    // 读取响应文本（先不解析 JSON）
    const responseText = await response.text();
    console.log('[UserAuth] 原始响应长度:', responseText.length, '字符');
    console.log('[UserAuth] 原始响应内容 (前500字符):', responseText.substring(0, 500));

    // 解析 JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('[UserAuth] JSON 解析成功');
      console.log('[UserAuth] 响应对象键:', Object.keys(data));
    } catch (e) {
      console.error('[UserAuth] JSON 解析失败:', e);
      return { loggedIn: false, user: null, error: 'JSON解析失败' };
    }

    // 详细检查 current_user 字段
    console.log('[UserAuth] data.current_user 值:', data.current_user);
    console.log('[UserAuth] data.current_user 类型:', typeof data.current_user);
    console.log('[UserAuth] data.current_user 是否为 null:', data.current_user === null);

    // 判断逻辑：必须有 current_user 字段且不为 null
    if (data.current_user !== null && data.current_user !== undefined) {
      console.log('[UserAuth] current_user 存在，检测到已登录用户');
      console.log('[UserAuth] 用户名:', data.current_user.username);
      console.log('[UserAuth] 用户ID:', data.current_user.id);
      console.log('[UserAuth] 信任等级:', data.current_user.trust_level);
      console.log('[UserAuth] === 检查完成：已登录 ===');
      return { loggedIn: true, user: data.current_user };
    } else {
      console.log('[UserAuth] current_user 为 null 或 undefined，视为未登录');
      console.log('[UserAuth] === 检查完成：未登录 ===');
      return { loggedIn: false, user: null };
    }
  } catch (error) {
    console.error('[UserAuth] 请求异常:', error);
    console.error('[UserAuth] 错误名称:', error.name);
    console.error('[UserAuth] 错误消息:', error.message);
    console.log('[UserAuth] === 检查完成：异常 ===');
    return { loggedIn: false, user: null, error: error.message };
  }
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
