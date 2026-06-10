import { state } from '../core/state.js';
import { t } from '../core/i18n.js';
import { icon } from './icons.js';
import { escHtml, escAttr } from './utils.js';

export function showToast(opts) {
  if (!state.panelEl) return;
  const stack = state.panelEl.querySelector('#pfi-toast-stack');
  if (!stack) return;

  const toast = document.createElement('div');
  toast.className = 'pfi-toast ' + (opts.success ? 'pfi-toast-ok' : 'pfi-toast-err');

  const textSpan = document.createElement('span');
  textSpan.className = 'pfi-toast-text';
  textSpan.textContent = opts.text || '';
  toast.appendChild(textSpan);

  if (opts.fullResult && opts.fullResult.length > 0) {
    const viewBtn = document.createElement('button');
    viewBtn.className = 'pfi-toast-btn';
    viewBtn.innerHTML = icon('maximize-2', 12) + ' ' + escHtml(t('viewFull'));
    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showResultModal(opts.title || '', opts.fullResult);
    });
    toast.appendChild(viewBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'pfi-toast-btn pfi-toast-close';
  closeBtn.innerHTML = icon('x', 12);
  closeBtn.addEventListener('click', () => toast.remove());
  toast.appendChild(closeBtn);

  stack.appendChild(toast);
  const hideMs = opts.fullResult ? 8000 : 5000;
  setTimeout(() => {
    toast.classList.add('pfi-toast-leaving');
    setTimeout(() => toast.remove(), 300);
  }, hideMs);
}

export function showResultModal(title, content) {
  if (!state.panelEl) return;
  const prev = state.panelEl.querySelector('.pfi-result-modal');
  if (prev) prev.remove();

  const modal = document.createElement('div');
  modal.className = 'pfi-result-modal';
  modal.innerHTML = `
    <div class="pfi-overlay-header">
      <button class="pfi-icon-btn" data-role="close" title="${escAttr(t('back'))}">${icon('arrow-left', 14)}</button>
      <span class="pfi-overlay-title">${escHtml(title || t('resultTitle'))}</span>
      <button class="pfi-icon-btn" data-role="copy" title="${escAttr(t('copyResult'))}">${icon('copy', 14)}</button>
    </div>
    <div class="pfi-result-body"><pre class="pfi-result-pre">${escHtml(content)}</pre></div>
  `;
  state.panelEl.appendChild(modal);
  modal.querySelector('[data-role="close"]').addEventListener('click', () => modal.remove());
  modal.querySelector('[data-role="copy"]').addEventListener('click', () => {
    try {
      navigator.clipboard.writeText(content);
      showToast({ success: true, text: t('copied') });
    } catch (e) { /* ignore */ }
  });
}
