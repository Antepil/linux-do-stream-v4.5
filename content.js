// 内容脚本：从 linux.do 页面提取主题数据

(function() {
  'use strict';
  
  // 仅在 linux.do 主页或 latest 页面运行
  if (!window.location.hostname.includes('linux.do')) {
    return;
  }
  
  console.log('Linux.do 主题流内容脚本已加载');
  
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
