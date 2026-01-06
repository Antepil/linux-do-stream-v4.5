// 全局工具函数（供右键菜单调用）
window.copyText = async function(text) {
  await navigator.clipboard.writeText(text);
};

window.toggleRead = function(id) {
  // 触发自定义事件，由 main.js 处理
  window.dispatchEvent(new CustomEvent('toggleRead', { detail: { id } }));
};
