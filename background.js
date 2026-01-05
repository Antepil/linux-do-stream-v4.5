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
      users: data.users // 包含用户信息以提取信任等级
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
