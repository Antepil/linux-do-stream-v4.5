// AI 总结弹窗组件

import { filterPostsByDepth, buildSummaryPrompt, detectContentType } from '../utils/ai.js';
import { fetchPosts } from '../utils/api.js';
import { showToast } from '../utils/formatters.js';

const AI_ICON = `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58s9.14-3.47 12.65 0L21 3v7.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z"/></svg>`;

let currentSummary = null;
let currentTopic = null;

/**
 * 初始化 AI 面板
 * @param {object} config - 当前配置
 * @param {Function} onConfigChange - 配置变更回调
 */
export function initAIPanel(config, onConfigChange) {
  createAIModal();
  createAISettingsSection(config, onConfigChange);
}

/**
 * 创建 AI 总结弹窗
 */
function createAIModal() {
  if (document.getElementById('aiSummaryModal')) return;

  const modal = document.createElement('div');
  modal.id = 'aiSummaryModal';
  modal.className = 'ai-modal-overlay';
  modal.innerHTML = `
    <div class="ai-modal-content">
      <div class="ai-modal-header">
        <h3>${AI_ICON} AI 总结</h3>
        <button class="modal-close" id="aiModalClose">&times;</button>
      </div>

      <div class="ai-modal-body">
        <div class="ai-topic-title" id="aiTopicTitle"></div>

        <div class="ai-depth-selector">
          <label>总结深度</label>
          <div class="radio-group">
            <label data-depth="summary">
              <input type="radio" name="aiDepth" value="summary"><span>仅摘要</span>
            </label>
            <label data-depth="hot">
              <input type="radio" name="aiDepth" value="hot"><span>热门回复</span>
            </label>
            <label data-depth="all">
              <input type="radio" name="aiDepth" value="all"><span>全部回复</span>
            </label>
          </div>
        </div>

        <div id="aiLoadingState" class="ai-loading hidden">
          <div class="ai-spinner"></div>
          <p id="aiLoadingText">正在获取帖子内容...</p>
          <div class="ai-progress-bar">
            <div class="ai-progress-fill" id="aiProgressFill"></div>
          </div>
        </div>

        <div id="aiSummaryContent" class="ai-summary-content hidden">
          <div class="ai-summary-meta">
            <span id="aiSummaryMeta"></span>
          </div>
          <div class="ai-summary-text" id="aiSummaryText"></div>
          <div class="ai-summary-actions">
            <button id="aiCopyBtn" class="icon-btn" title="复制">${COPY_ICON}</button>
            <button id="aiRegenerateBtn" class="icon-btn" title="重新总结">${REGENERATE_ICON}</button>
          </div>
        </div>

        <div id="aiErrorState" class="ai-error hidden">
          <p id="aiErrorText"></p>
          <button id="aiRetryBtn" class="btn-primary">重试</button>
        </div>

        <div id="aiEmptyState" class="ai-empty">
          <p>点击下方按钮开始 AI 总结</p>
        </div>
      </div>

      <div class="ai-modal-footer">
        <button id="aiSummarizeBtn" class="btn-primary full-width">
          ${AI_ICON} 开始总结
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  bindAIModalEvents();
}

/**
 * 创建 AI 设置面板区块
 */
function createAISettingsSection(config, onConfigChange) {
  if (document.getElementById('aiSettingsSection')) return;

  const section = document.createElement('div');
  section.id = 'aiSettingsSection';
  section.className = 'settings-section';
  section.innerHTML = `
    <h3>AI 总结</h3>

    <div class="setting-item">
      <label>启用 AI 总结</label>
      <input type="checkbox" id="aiEnabled" class="setting-toggle" ${config.aiEnabled ? 'checked' : ''}>
    </div>

    <div class="setting-item vertical">
      <label>API 地址</label>
      <input type="text" id="aiApiUrl" class="setting-input"
             placeholder="https://api.openai.com/v1" value="${escapeHtml(config.aiApiUrl || 'https://api.minimax.io/anthropic')}">
    </div>

    <div class="setting-item vertical">
      <label>API Key</label>
      <input type="password" id="aiApiKey" class="setting-input"
             placeholder="sk-..." value="${escapeHtml(config.aiApiKey || '')}">
    </div>

    <div class="setting-item vertical">
      <label>模型</label>
      <select id="aiModel" class="setting-select">
        <option value="MiniMax-M2.1" ${config.aiModel === 'MiniMax-M2.1' ? 'selected' : ''}>MiniMax-M2.1</option>
        <option value="gpt-4o" ${config.aiModel === 'gpt-4o' ? 'selected' : ''}>GPT-4o</option>
        <option value="gpt-4-turbo" ${config.aiModel === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo</option>
        <option value="gpt-4" ${config.aiModel === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
        <option value="gpt-3.5-turbo" ${config.aiModel === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
      </select>
    </div>

    <div class="setting-item">
      <label>Temperature</label>
      <input type="range" id="aiTemperature" min="0" max="1" step="0.1"
             value="${config.aiTemperature}" style="width:100px">
      <span id="aiTempValue">${config.aiTemperature}</span>
    </div>

    <div class="setting-item">
      <label>默认深度</label>
      <select id="aiSummaryDepth" class="setting-select">
        <option value="smart" ${config.aiSummaryDepth === 'smart' ? 'selected' : ''}>智能推荐</option>
        <option value="summary" ${config.aiSummaryDepth === 'summary' ? 'selected' : ''}>仅摘要</option>
        <option value="hot" ${config.aiSummaryDepth === 'hot' ? 'selected' : ''}>热门回复</option>
        <option value="all" ${config.aiSummaryDepth === 'all' ? 'selected' : ''}>全部回复</option>
      </select>
    </div>
  `;

  // 插入到设置面板中（通知与提醒之前）
  const notifySection = document.querySelector('#settingsView .settings-section:nth-of-type(3)');
  if (notifySection) {
    notifySection.before(section);
  } else {
    const settingsContent = document.querySelector('#settingsView .settings-content');
    if (settingsContent) {
      settingsContent.appendChild(section);
    }
  }

  bindAISettingsEvents(config, onConfigChange);
}

const COPY_ICON = `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
const REGENERATE_ICON = `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 绑定弹窗事件
 */
function bindAIModalEvents() {
  const modal = document.getElementById('aiSummaryModal');
  if (!modal) return;

  const closeBtn = document.getElementById('aiModalClose');
  const summarizeBtn = document.getElementById('aiSummarizeBtn');
  const copyBtn = document.getElementById('aiCopyBtn');
  const regenerateBtn = document.getElementById('aiRegenerateBtn');
  const retryBtn = document.getElementById('aiRetryBtn');

  // 关闭弹窗
  closeBtn.onclick = () => closeAISummaryModal();
  modal.onclick = (e) => {
    if (e.target === modal) closeAISummaryModal();
  };

  // ESC 关闭
  document.addEventListener('keydown', handleModalKeydown);

  // 总结按钮
  summarizeBtn.onclick = async () => {
    const depth = document.querySelector('input[name="aiDepth"]:checked')?.value || 'hot';
    if (currentTopic) {
      await handleSummarize(currentTopic, depth);
    }
  };

  // 复制
  copyBtn.onclick = () => {
    if (currentSummary?.summary) {
      navigator.clipboard.writeText(currentSummary.summary);
      showToast('已复制到剪贴板');
    }
  };

  // 重新总结
  regenerateBtn.onclick = async () => {
    const depth = document.querySelector('input[name="aiDepth"]:checked')?.value || 'hot';
    if (currentTopic) {
      await handleSummarize(currentTopic, depth, true);
    }
  };

  // 重试
  retryBtn.onclick = async () => {
    const depth = document.querySelector('input[name="aiDepth"]:checked')?.value || 'hot';
    if (currentTopic) {
      await handleSummarize(currentTopic, depth);
    }
  };
}

function handleModalKeydown(e) {
  if (e.key === 'Escape') {
    closeAISummaryModal();
  }
}

/**
 * 绑定设置面板事件
 */
function bindAISettingsEvents(config, onConfigChange) {
  const ids = ['aiEnabled', 'aiApiUrl', 'aiApiKey', 'aiModel', 'aiTemperature', 'aiSummaryDepth'];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    if (el.type === 'checkbox' || el.tagName === 'SELECT') {
      el.onchange = () => saveAIConfig(onConfigChange);
    } else {
      el.oninput = () => saveAIConfig(onConfigChange);
    }
  });

  // Temperature 滑块值显示
  const tempSlider = document.getElementById('aiTemperature');
  if (tempSlider) {
    tempSlider.oninput = () => {
      document.getElementById('aiTempValue').textContent = tempSlider.value;
    };
  }
}

function saveAIConfig(onConfigChange) {
  const newConfig = {
    aiEnabled: document.getElementById('aiEnabled')?.checked || false,
    aiApiUrl: document.getElementById('aiApiUrl')?.value.trim() || '',
    aiApiKey: document.getElementById('aiApiKey')?.value.trim() || '',
    aiModel: document.getElementById('aiModel')?.value || 'gpt-3.5-turbo',
    aiTemperature: parseFloat(document.getElementById('aiTemperature')?.value || 0.7),
    aiSummaryDepth: document.getElementById('aiSummaryDepth')?.value || 'smart'
  };

  if (onConfigChange) {
    onConfigChange(newConfig);
  }
  showToast('AI 配置已保存');
}

/**
 * 处理总结请求
 */
async function handleSummarize(topic, depth, regenerate = false) {
  const config = window.config || {};
  const modal = document.getElementById('aiSummaryModal');

  // 切换到加载状态
  document.getElementById('aiEmptyState').classList.add('hidden');
  document.getElementById('aiLoadingState').classList.remove('hidden');
  document.getElementById('aiSummaryContent').classList.add('hidden');
  document.getElementById('aiErrorState').classList.add('hidden');

  const loadingText = document.getElementById('aiLoadingText');
  const progressFill = document.getElementById('aiProgressFill');

  try {
    // 阶段 1: 获取帖子
    loadingText.textContent = '正在获取帖子内容...';
    progressFill.style.width = '30%';

    const postsRes = await fetchPosts(topic.id);
    if (!postsRes.success) {
      throw new Error(postsRes.error || '获取帖子失败');
    }

    // 检查 posts 数组
    if (!postsRes.posts || postsRes.posts.length === 0) {
      throw new Error('该帖子暂无回复内容');
    }

    console.log('[AI] 获取到帖子数:', postsRes.posts.length);

    progressFill.style.width = '60%';

    // 阶段 2: 调用 AI
    loadingText.textContent = '正在 AI 总结...';

    // 检查 AI 配置
    if (!config.aiApiUrl || !config.aiApiKey) {
      throw new Error('请先在设置中配置 AI API');
    }

    // 确定实际使用的深度
    const actualDepth = depth === 'smart' ? 'hot' : depth;

    // 过滤帖子
    const filteredPosts = filterPostsByDepth(postsRes.posts, actualDepth, postsRes.topic || topic);

    if (filteredPosts.length === 0) {
      throw new Error('没有可总结的帖子内容');
    }

    // 构建 Prompt
    const prompt = buildSummaryPrompt(
      postsRes.topic?.title || topic.title,
      filteredPosts,
      actualDepth
    );

    console.log('[AI] 发送请求到 background.js');

    // 通过 background.js 发送 API 请求（避免 CORS）
    const summaryRes = await chrome.runtime.sendMessage({
      type: 'CALL_AI_API',
      config: {
        aiApiUrl: config.aiApiUrl,
        aiApiKey: config.aiApiKey,
        aiModel: config.aiModel,
        aiTemperature: config.aiTemperature
      },
      prompt: prompt
    });

    progressFill.style.width = '100%';

    if (!summaryRes || !summaryRes.success) {
      throw new Error(summaryRes?.error || 'AI 总结失败');
    }

    // 显示结果
    currentSummary = summaryRes;
    currentTopic = topic;

    const depthLabel = { summary: '仅摘要', hot: '热门回复', all: '全部回复' };
    document.getElementById('aiSummaryMeta').textContent =
      `基于 ${summaryRes.postCount || filteredPosts.length} 条帖子 · ${depthLabel[actualDepth] || depth}模式`;
    document.getElementById('aiSummaryText').textContent = summaryRes.summary;

    document.getElementById('aiLoadingState').classList.add('hidden');
    document.getElementById('aiSummaryContent').classList.remove('hidden');

  } catch (error) {
    console.error('[AI] 总结失败:', error);
    document.getElementById('aiLoadingState').classList.add('hidden');
    document.getElementById('aiErrorState').classList.remove('hidden');
    document.getElementById('aiErrorText').textContent = error.message || '未知错误';
  }
}

/**
 * 打开 AI 总结弹窗
 */
export function openAISummaryModal(topic) {
  const modal = document.getElementById('aiSummaryModal');
  if (!modal) return;

  currentTopic = topic;

  // 设置标题
  const titleEl = document.getElementById('aiTopicTitle');
  if (titleEl) {
    titleEl.textContent = topic.title;
    titleEl.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; line-height: 1.4;';
  }

  // 获取推荐深度
  const config = window.config || {};
  const detection = detectContentType(topic.title, []);
  const defaultDepth = (config.aiSummaryDepth || 'smart') === 'smart'
    ? detection.recommended
    : config.aiSummaryDepth;

  // 设置单选按钮
  const radio = document.querySelector(`input[name="aiDepth"][value="${defaultDepth}"]`);
  if (radio) {
    radio.checked = true;
  } else {
    const hotRadio = document.querySelector('input[name="aiDepth"][value="hot"]');
    if (hotRadio) hotRadio.checked = true;
  }

  // 重置状态
  document.getElementById('aiEmptyState').classList.remove('hidden');
  document.getElementById('aiLoadingState').classList.add('hidden');
  document.getElementById('aiSummaryContent').classList.add('hidden');
  document.getElementById('aiErrorState').classList.add('hidden');

  // 显示弹窗
  modal.classList.add('visible');
}

/**
 * 关闭 AI 总结弹窗
 */
export function closeAISummaryModal() {
  const modal = document.getElementById('aiSummaryModal');
  if (modal) {
    modal.classList.remove('visible');
  }
  currentSummary = null;
  currentTopic = null;
}

/**
 * 获取 AI 按钮图标
 */
export function getAIButtonHtml(topicId) {
  return `
    <button class="ai-btn" data-topic-id="${topicId}" title="AI 总结">
      ${AI_ICON}
    </button>
  `;
}
