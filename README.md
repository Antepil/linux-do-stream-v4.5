# Linux.do Stream Extension (v4.2) 🐧✨

一款专为 Linux.do 社区设计的 Chrome 侧边栏插件，旨在提供极致丝滑、高度可定制的推文流浏览体验。

![Version](https://img.shields.io/badge/version-4.2.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Chrome-orange.svg)
![Style](https://img.shields.io/badge/style-Apple%20HIG-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🌟 核心特性

### 🎨 极致视觉体验 (Apple HIG Style)
- **多主题支持**：内置 **亮色 (Light)**、**暗色 (Dark)** 及 **跟随系统 (System)** 模式。全量 CSS 变量驱动，秒级无缝切换，完美适配 OLED 屏幕。
- **性能巅峰**：开启 **GPU 硬件加速**，所有动画均通过 `requestAnimationFrame` 同步，确保 60FPS 的丝滑交互。
- **骨架屏加载**：引入 **Skeleton Screen** 动画，彻底消除数据刷新时的视觉闪烁感。
- **隐形滚动条**：极致纯净的界面设计，仅在交互时提供细微反馈。

### 🛠️ 强大的全功能设置面板
- **核心网络控制**：
  - **自定义刷新频率**：支持 15s、30s、1min、5min 及手动刷新。
  - **节流模式 (Low Data Mode)**：一键关闭头像和摘要加载，仅看纯文字标题，极速省流。
- **内容过滤与降噪 (Content Filtering)**：
  - **可视化分类屏蔽**：一键点击标签（如“搞七捻三”、“福利羊毛”）即可屏蔽特定板块。
  - **关键词黑名单**：支持标题关键词过滤（如“拼车”、“aff”），彻底告别噪音。
  - **高热度筛选**：开启后仅显示回复数 > 10 的优质帖子。
- **交互与阅读体验**：
  - **Hover Intent 预览**：带 350ms 防抖判定的丝滑下拉摘要预览。
  - **点击行为定制**：支持“新标签页跳转”或“后台静默打开”。
  - **已读状态处理**：支持点击后“变灰”、“直接隐藏”或“不做处理”。

### 🔔 智能提醒系统
- **图标角标 (Badge)**：在浏览器图标上实时显示未读帖子数量。
- **关键词强提醒**：匹配特定关键词（如“OpenAI”、“送号”、“抽奖”）时，立即发送系统级通知。

## 🚀 安装指南

### 开发者模式安装 (推荐)
1. **下载/克隆代码**：
   ```bash
   git clone https://github.com/Antepil/linux-do-stream-extension.git
   ```
2. **打开 Chrome 扩展程序**：
   在浏览器地址栏输入 `chrome://extensions/` 并回车。
3. **开启开发者模式**：
   点击右上角的“开发者模式”开关。
4. **加载插件**：
   点击“加载已解压的扩展程序”，选择本项目文件夹。
5. **开始使用**：
   点击工具栏中的插件图标，即可在侧边栏开启 Linux.do 之旅。

## 🛠️ 技术架构

- **Manifest V3**：遵循最新的 Chrome 扩展规范，安全且高效。
- **Side Panel API**：实现原生侧边栏集成，不占用网页空间。
- **CSS Variables & Media Queries**：实现高性能的主题切换与响应式设计。
- **Chrome Storage API**：持久化存储用户配置与已读状态。
- **Background Service Worker**：处理跨域 API 请求、Cookie 传递与系统级通知。

## 📝 更新日志

### v4.2.0 (2025-12-31)
- **[新增]** 亮色/暗色/跟随系统主题切换功能。
- **[重构]** 全量 CSS 变量系统，优化黑暗模式对比度。

### v4.1.0
- **[新增]** 可视化分类屏蔽标签组，点击即可过滤。
- **[新增]** 一键恢复默认设置功能。

### v4.0.0
- **[新增]** 全功能设置面板，涵盖网络、过滤、交互、通知及外观。
- **[优化]** 性能调优，实现 60FPS 丝滑预览动画。

## 🤝 贡献说明

欢迎提交 Issue 或 Pull Request 来帮助改进本项目。

## 许可证

MIT License

---

*声明：本项目为第三方开发，与 Linux.do 官方无直接关联。使用前请确保已登录 Linux.do 账号以获取最佳体验。*

**享受来自 Linux.do 社区的精彩内容！** 🐧🌊
