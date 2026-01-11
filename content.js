// 内容脚本：从 linux.do 页面提取主题数据，并在页面上下文中发送 API 请求

(function() {
  'use strict';

  // 仅在 linux.do 主页或 latest 页面运行
  if (!window.location.hostname.includes('linux.do')) {
    return;
  }

  const BASE_URL = 'https://linux.do';

  console.log('Linux.do 主题流内容脚本已加载');

  // 在页面上下文中发送 API 请求（绕过 CORS）
  async function fetchFromPageContext(endpoint) {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    const jsonUrl = url.includes('.json') ? url : `${url}.json`;

    console.log('[ContentScript] 请求:', jsonUrl);

    try {
      const response = await fetch(jsonUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
          'X-Requested-With': 'XMLHttpRequest',
          'Discourse-Present': 'true'
        },
        credentials: 'include'
      });

      console.log('[ContentScript] 响应:', response.status, response.statusText);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}`, topics: [], users: [] };
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
      console.error('[ContentScript] 请求失败:', error);
      return { success: false, error: error.message, topics: [], users: [] };
    }
  }

  // 获取帖子详情
  async function fetchPostsFromPageContext(topicId) {
    const url = `${BASE_URL}/t/${topicId}/posts.json`;

    console.log('[ContentScript] 获取帖子:', url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Discourse-Present': 'true'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}`, posts: [] };
      }

      const data = await response.json();
      console.log('[ContentScript] 帖子响应数据结构:', Object.keys(data));

      // 兼容两种数据结构：data.posts 或 data.post_stream.posts
      const posts = data.posts || (data.post_stream && data.post_stream.posts) || [];
      console.log('[ContentScript] 获取到帖子数:', posts.length);

      return {
        success: true,
        posts: posts,
        topic: data.topic || data.post_stream?.topic
      };
    } catch (error) {
      console.error('[ContentScript] 获取帖子失败:', error);
      return { success: false, error: error.message, posts: [] };
    }
  }

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[ContentScript] 收到消息:', message.type);

    if (message.type === 'FETCH_API') {
      fetchFromPageContext(message.endpoint).then(sendResponse);
      return true; // 异步响应
    }

    if (message.type === 'FETCH_POSTS') {
      fetchPostsFromPageContext(message.topicId).then(sendResponse);
      return true;
    }

    if (message.type === 'PING') {
      sendResponse({ success: true, url: window.location.href });
      return false;
    }
  });

  // 尝试从页面数据中提取主题
  function extractTopicsFromPage() {
    try {
      // 方法1: 从 Discourse 的 preloaded 数据中提取
      const preloadedData = document.querySelector('script[data-discourse-entrypoint="discourse"]');
      if (preloadedData) {
        const dataNode = document.querySelector('[data-preloaded]');
        if (dataNode) {
          const data = JSON.parse(dataNode.getAttribute('data-preloaded'));
          if (data.topic_list) {
            const topicListData = JSON.parse(data.topic_list);
            if (topicListData.topic_list && topicListData.topic_list.topics) {
              console.log('从 preloaded 数据中提取到主题');
              return topicListData.topic_list.topics;
            }
          }
        }
      }

      // 方法2: 从 DOM 中提取主题信息
      const topicRows = document.querySelectorAll('tr[data-topic-id]');
      if (topicRows.length > 0) {
        console.log('从 DOM 中提取到主题');
        const topics = [];
        topicRows.forEach(row => {
          const topicId = row.getAttribute('data-topic-id');
          const titleEl = row.querySelector('.title a');
          const postsEl = row.querySelector('.posts');
          const viewsEl = row.querySelector('.views');

          if (titleEl && topicId) {
            topics.push({
              id: parseInt(topicId),
              title: titleEl.textContent.trim(),
              posts_count: postsEl ? parseInt(postsEl.textContent) || 0 : 0,
              views: viewsEl ? parseInt(viewsEl.textContent.replace(/[^0-9]/g, '')) || 0 : 0,
              created_at: new Date().toISOString(),
              last_posted_at: new Date().toISOString()
            });
          }
        });
        return topics;
      }

      return null;
    } catch (error) {
      console.error('提取主题数据失败:', error);
      return null;
    }
  }

  // 发送数据到后台
  function sendTopicsToBackground(topics) {
    if (topics && topics.length > 0) {
      chrome.runtime.sendMessage({
        type: 'FETCH_FROM_PAGE',
        topics: topics
      }).then(response => {
        console.log('主题数据已发送到后台');
      }).catch(error => {
        console.error('发送数据失败:', error);
      });
    }
  }

  // 页面加载完成后提取数据
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const topics = extractTopicsFromPage();
        sendTopicsToBackground(topics);
      }, 1000);
    });
  } else {
    setTimeout(() => {
      const topics = extractTopicsFromPage();
      sendTopicsToBackground(topics);
    }, 1000);
  }

  // 监听页面变化（SPA 路由切换）
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(() => {
        const topics = extractTopicsFromPage();
        sendTopicsToBackground(topics);
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

})();
