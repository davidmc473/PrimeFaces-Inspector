import { state } from '../core/state.js';
import { t } from '../core/i18n.js';
import { icon } from './icons.js';
import { escHtml } from './utils.js';

export function renderHeaderInfo() {
  const bar = state.panelEl && state.panelEl.querySelector('#pfi-info-bar');
  if (!bar) return;

  if (!state.pageInfo.hasPrimeFaces) {
    bar.className = 'pfi-info-bar pfi-info-warn';
    bar.innerHTML = `
      <span class="pfi-info-icon">${icon('alert-triangle', 12)}</span>
      <span>${escHtml(t('pfNotDetected'))}</span>
    `;
    return;
  }

  const versionTxt = state.pageInfo.version || '?';
  const lines = [`<span class="pfi-info-main">${escHtml(t('pfDetected', versionTxt))}</span>`];

  if (state.pageInfo.hasPrimeFacesExt) {
    lines.push(`<span class="pfi-info-sub">${escHtml(t('pfExtDetected', state.pageInfo.versionExt || '?'))}</span>`);
  } else {
    lines.push(`<span class="pfi-info-sub pfi-info-muted">${escHtml(t('pfExtNotDetected'))}</span>`);
  }
  if (!state.pageInfo.hasJQuery) {
    lines.push(`<span class="pfi-info-sub pfi-info-warn-text">${escHtml(t('jqueryMissing'))}</span>`);
  }

  bar.className = 'pfi-info-bar pfi-info-ok';
  bar.innerHTML = `
    <span class="pfi-info-icon">${icon('check-circle', 12)}</span>
    <div class="pfi-info-lines">${lines.join('')}</div>
  `;
}
