
// Universal AI chat exporter - GPT, Meta AI, ChatGPT, Gemini, Grok, Claude
(() => {
  const SELECTORS = {
    'chatgpt': '[data-message-author-role] .markdown',
    'gemini': 'message-content, .model-response-text',
    'claude': '[data-is-streaming] .font-claude-message',
    'meta': '[data-testid="bot-message"]',
    'grok': '[data-testid="message"]'
  };
  function detect() {
    const url = location.hostname;
    if (url.includes('chatgpt.com') || url.includes('openai')) return 'chatgpt';
    if (url.includes('gemini.google')) return 'gemini';
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('meta.ai')) return 'meta';
    if (url.includes('grok') || url.includes('x.com')) return 'grok';
    return 'unknown';
  }
  function extract() {
    const platform = detect();
    const sel = SELECTORS[platform] || 'article, .message';
    const nodes = document.querySelectorAll(sel);
    const messages = Array.from(nodes).map(n=>({text:n.innerText.slice(0,5000), html:n.innerHTML.slice(0,10000)}));
    return {platform, url: location.href, exportedAt: new Date().toISOString(), messages};
  }
  window.__FOREVER_AI_EXPORT__ = () => {
    const data = extract();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-chat-${data.platform}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };
  // auto add button on AI sites
  if (detect() !== 'unknown') {
    const btn = document.createElement('button');
    btn.textContent = '⬇ Export Chat (Forever)';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#000;color:#0f0;border:1px solid #0f0;padding:8px 12px;border-radius:6px;cursor:pointer;';
    btn.onclick = () => window.__FOREVER_AI_EXPORT__();
    document.documentElement.appendChild(btn);
  }
})();
