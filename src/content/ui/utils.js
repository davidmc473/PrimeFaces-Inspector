export function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escAttr(str) {
  return escHtml(str);
}

export function cssEsc(str) {
  if (window.CSS && CSS.escape) return CSS.escape(str);
  return String(str).replace(/"/g, '\\"');
}
