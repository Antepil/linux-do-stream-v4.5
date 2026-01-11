// AI 总结核心逻辑模块

/**
 * 从 HTML cooked 内容提取纯文本
 * @param {string} cooked - HTML 内容
 * @returns {string} 纯文本
 */
export function extractTextFromHtml(cooked) {
  if (!cooked) return '';
  const div = document.createElement('div');
  div.innerHTML = cooked;
  return div.textContent || div.innerText || '';
}

/**
 * 根据深度过滤帖子
 * @param {array} posts - 帖子数组
 * @param {string} depth - 深度模式: 'summary' | 'hot' | 'all'
 * @param {object} topic - 主题信息
 * @returns {array} 过滤后的帖子
 */
export function filterPostsByDepth(posts, depth, topic = {}) {
  if (depth === 'all') {
    return posts;
  }

  if (depth === 'summary') {
    // 仅摘要：只返回楼主的帖子（post_number === 1）
    return posts.filter(p => p.post_number === 1);
  }

  if (depth === 'hot') {
    // 热门回复：按点赞数取前 10
    return posts
      .filter(p => (p.like_count || 0) >= 2)
      .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
      .slice(0, 10);
  }

  // 默认返回全部
  return posts;
}

/**
 * 构建总结 Prompt
 * @param {string} title - 帖子标题
 * @param {array} posts - 帖子数组
 * @param {string} depth - 深度模式
 * @returns {string} 完整的 Prompt
 */
export function buildSummaryPrompt(title, posts, depth) {
  const depthInstructions = {
    summary: '重点提取楼主的核心问题和主要观点，以及最有价值的回复。总结控制在100字以内。',
    hot: '总结热门回复的主要观点和讨论焦点。控制150字以内。',
    all: '全面总结帖子讨论内容，包括问题、解决方案、各方观点。控制200字以内。'
  };

  const postList = posts.map((p, i) => {
    const text = extractTextFromHtml(p.cooked).substring(0, 500);
    const likes = p.like_count || 0;
    return `[${p.post_number}楼 @${p.username}] (${likes}赞) ${text}`;
  }).join('\n\n');

  return `请用中文总结以下论坛帖子的讨论内容：

标题：${title}

${depthInstructions[depth] || depthInstructions.all}

帖子内容：
${postList}

请用简洁的 bullet points 格式总结关键要点：`;
}

/**
 * 检测内容类型并推荐深度
 * @param {string} title - 帖子标题
 * @param {array} posts - 帖子数组（可选）
 * @returns {object} { type, recommended }
 */
export function detectContentType(title, posts = []) {
  const t = title.toLowerCase();

  if (t.includes('求助') || t.includes('问题') || t.includes('怎么') ||
      t.includes('请问') || t.includes('为什么') || t.includes('报错')) {
    return { type: 'question', recommended: 'hot' };
  }
  if (t.includes('讨论') || t.includes('看法') || t.includes('聊聊') ||
      t.includes('觉得') || t.includes('大家')) {
    return { type: 'discussion', recommended: 'all' };
  }
  if (t.includes('分享') || t.includes('教程') || t.includes('安装') ||
      t.includes('配置') || t.includes('搭建')) {
    return { type: 'tutorial', recommended: 'summary' };
  }
  if (t.includes('评测') || t.includes('对比') || t.includes('哪个好')) {
    return { type: 'review', recommended: 'hot' };
  }

  return { type: 'general', recommended: 'smart' };
}

/**
 * 调用 AI API 进行总结
 * @param {array} posts - 帖子数组
 * @param {object} topic - 主题信息
 * @param {object} config - AI 配置
 * @param {string} depth - 深度模式
 * @returns {Promise<object>} { success, summary, error, usage, postCount, depth }
 */
export async function summarizeWithAI(posts, topic, config, depth = 'smart') {
  const { aiApiUrl, aiApiKey, aiModel, aiTemperature } = config;

  // 验证配置
  if (!aiApiUrl || !aiApiKey) {
    return { success: false, error: '请先在设置中配置 AI API' };
  }

  // 确定实际使用的深度
  const actualDepth = depth === 'smart' ? 'hot' : depth;

  // 过滤帖子
  const filteredPosts = filterPostsByDepth(posts, actualDepth, topic);

  if (filteredPosts.length === 0) {
    return { success: false, error: '没有可总结的帖子内容' };
  }

  // 构建 Prompt
  const prompt = buildSummaryPrompt(topic.title, filteredPosts, actualDepth);

  // 标准化 URL（移除尾部斜杠）
  const baseUrl = aiApiUrl.replace(/\/$/, '');

  // 检测 API 类型
  const isMiniMax = baseUrl.includes('minimax') || baseUrl.includes('api.minimax.io');
  const isAnthropic = baseUrl.includes('anthropic') || baseUrl.includes('/anthropic');

  let endpoint, requestBody, headers;

  if (isMiniMax) {
    // MiniMax API 格式
    endpoint = `${baseUrl}/v1/text/chatcompletion_v2`;
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiApiKey}`
    };
    requestBody = {
      model: aiModel || 'MiniMax-M2.1',
      messages: [
        { role: 'system', content: '你是一个乐于助人的助手，请用简洁的中文总结论坛帖子的讨论内容。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1024,
      temperature: aiTemperature || 0.9
    };
  } else if (isAnthropic) {
    // Anthropic API 格式
    endpoint = `${baseUrl}/v1/messages`;
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': aiApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    requestBody = {
      model: aiModel || 'MiniMax-M2.1',
      max_tokens: 800,
      temperature: aiTemperature,
      messages: [{ role: 'user', content: prompt }]
    };
  } else {
    // OpenAI 兼容格式
    endpoint = `${baseUrl}/v1/chat/completions`;
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiApiKey}`
    };
    requestBody = {
      model: aiModel || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: aiTemperature,
      max_tokens: 800
    };
  }

  console.log('[AI] 请求 API:', endpoint);
  console.log('[AI] 模型:', aiModel);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI] API 错误响应:', errorText);
      let errorMsg = `API 错误: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMsg = errorData.error.message;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        } else if (errorData.base_resp?.msg) {
          errorMsg = errorData.base_resp.msg;
        }
      } catch (e) {}
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    console.log('[AI] 响应结构:', JSON.stringify(data).substring(0, 500));

    // 解析响应
    let summary = '';
    if (isMiniMax) {
      // MiniMax 响应格式: { base_resp: { status_msg: "Success", ... }, choices: [...] }
      summary = data.choices?.[0]?.message?.content || data.choices?.[0]?.content || '';
    } else if (isAnthropic) {
      summary = data.content?.[0]?.text || '';
    } else {
      summary = data.choices?.[0]?.message?.content || '';
    }

    return {
      success: true,
      summary,
      usage: data.usage,
      postCount: filteredPosts.length,
      depth: actualDepth
    };
  } catch (error) {
    console.error('[AI] API 调用失败:', error);
    return { success: false, error: error.message || '网络请求失败' };
  }
}
