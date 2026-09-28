/**
 * 嵌入页面共用：从父页面借字体。站点只把颜色变量同步进 iframe，@font-face 不会过来；
 * 同源时把父页面样式表里的字体规则抄一份，沙盒里的中文就和正文一样是霞鹜文楷。
 */
export function borrowFonts() {
  let parentDoc;
  try { parentDoc = window.parent !== window ? window.parent.document : null; } catch { return; }
  if (!parentDoc) return;
  const rules = [];
  const absolute = (text, base) => text.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, url) =>
    /^(data:|https?:|blob:)/.test(url) ? match : `url("${new URL(url, base).href}")`);
  const collect = (list, base) => {
    for (const rule of list) {
      if (rule.type === 5) rules.push(absolute(rule.cssText, base));
      else if (rule.type === 3 && rule.styleSheet) { try { collect(rule.styleSheet.cssRules, rule.styleSheet.href ?? base); } catch { /* 跨域样式表读不到 */ } }
      else if (rule.cssRules) collect(rule.cssRules, base);
    }
  };
  for (const sheet of parentDoc.styleSheets) {
    try { collect(sheet.cssRules, sheet.href ?? parentDoc.baseURI); } catch { /* 跨域样式表读不到 */ }
  }
  if (!rules.length) return;
  const style = document.createElement('style');
  style.dataset.borrowed = 'fonts';
  style.textContent = rules.join('\n');
  document.head.append(style);
}

/** 在父页面里找到以某段文字开头的二级标题并滚过去（给嵌入页里的“去第 N 课”链接用）。 */
export function jumpToHeading(prefix) {
  try {
    const doc = window.parent.document;
    const heading = [...doc.querySelectorAll('.prose h2, .prose h3')].find(h => h.textContent.trim().startsWith(prefix));
    if (!heading) return false;
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  } catch { return false; }
}

export const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
