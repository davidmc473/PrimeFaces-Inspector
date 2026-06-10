import { config } from '../core/config.js';
import { t } from '../core/i18n.js';
import { highlightElement, clearHighlight, clearTargetHighlight, clearEventRowHighlights } from '../core/highlights.js';
import { icon, getComponentIcon } from './icons.js';
import { escHtml, escAttr, cssEsc } from './utils.js';
import { renderDetailHtml, wireDetailEvents } from './widget-detail.js';

export function buildCard(w, callbacks) {
  const card = document.createElement('div');
  card.className = 'pfi-card';
  card.setAttribute('data-widget-var', w.widgetVar);

  card.innerHTML = `
    <div class="pfi-card-head" data-role="head">
      <div class="pfi-card-icon" title="${escAttr(w.type)}">${getComponentIcon(w.type)}</div>
      <div class="pfi-card-body">
        <div class="pfi-card-wvar">${escHtml(w.widgetVar)}</div>
        <div class="pfi-card-id">${escHtml(w.id)}</div>
      </div>
      <button class="pfi-chevron" type="button" aria-expanded="false"
              title="${escAttr(t('expand'))}" data-role="chevron">
        ${icon('chevron-right', 14)}
      </button>
    </div>
    <div class="pfi-card-detail" data-role="detail" hidden></div>
  `;

  card.addEventListener('mouseenter', () => highlightElement(w.id));
  card.addEventListener('mouseleave', clearHighlight);

  const head = card.querySelector('[data-role="head"]');
  const chev = card.querySelector('[data-role="chevron"]');

  head.addEventListener('click', (e) => {
    if (e.target.closest('.pfi-chevron')) return;
    callbacks.toggleCard(w.widgetVar);
  });
  chev.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.toggleCard(w.widgetVar);
  });

  return card;
}

export function expandCard(panelEl, widgetsData, widgetVar, scrollIntoView, callbacks) {
  if (!panelEl) return;

  panelEl.querySelectorAll('.pfi-card.pfi-expanded').forEach(c => {
    if (c.getAttribute('data-widget-var') !== widgetVar) {
      c.classList.remove('pfi-expanded');
      const d = c.querySelector('[data-role="detail"]');
      const ch = c.querySelector('[data-role="chevron"]');
      if (d) { d.hidden = true; d.innerHTML = ''; }
      if (ch) ch.setAttribute('aria-expanded', 'false');
    }
  });

  const card = panelEl.querySelector(`.pfi-card[data-widget-var="${cssEsc(widgetVar)}"]`);
  if (!card) return;
  const w = widgetsData.find(x => x.widgetVar === widgetVar);
  if (!w) return;

  const detail = card.querySelector('[data-role="detail"]');
  const chev   = card.querySelector('[data-role="chevron"]');
  detail.innerHTML = renderDetailHtml(w);
  detail.hidden = false;
  card.classList.add('pfi-expanded');
  if (chev) chev.setAttribute('aria-expanded', 'true');

  wireDetailEvents(detail, w, callbacks);

  if (scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function collapseCard(panelEl, widgetVar) {
  if (!panelEl) return;
  const card = panelEl.querySelector(`.pfi-card[data-widget-var="${cssEsc(widgetVar)}"]`);
  if (card) {
    card.classList.remove('pfi-expanded');
    const detail = card.querySelector('[data-role="detail"]');
    const chev   = card.querySelector('[data-role="chevron"]');
    if (detail) { detail.hidden = true; detail.innerHTML = ''; }
    if (chev)   chev.setAttribute('aria-expanded', 'false');
  }
  clearEventRowHighlights();
  clearTargetHighlight();
}
