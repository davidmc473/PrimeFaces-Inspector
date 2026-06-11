import { state } from '../core/state.js';
import { config, saveConfig, applyDynamicColors } from '../core/config.js';
import { t } from '../core/i18n.js';
import { clearHighlight, clearTargetHighlight, clearEventRowHighlights } from '../core/highlights.js';
import { requestWidgets, executeWidgetAction, executeInlineEvent, injectPageScript } from '../core/messaging.js';
import { icon } from './icons.js';
import { escHtml, escAttr } from './utils.js';
import { renderHeaderInfo } from './infobar.js';
import { buildSearchBar, wireSearchEvents } from './search.js';
import { applyFilters, renderList } from './widget-list.js';
import { expandCard } from './widget-card.js';
import { showConfig } from './config-panel.js';
import { showToast, showResultModal } from './toast.js';
import { toggleSelectionMode, deactivateSelectionMode } from './selection.js';
import { initTooltips } from './tooltip.js';

function applyTheme() {
  if (!state.panelEl) return;
  if (config.theme === 'light') state.panelEl.classList.add('pfi-theme-light');
  else state.panelEl.classList.remove('pfi-theme-light');
}

function makeDraggable(element, handle) {
  let isDragging = false, startX, startY, origX, origY;
  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('.pfi-icon-btn, .pfi-header-btn')) return;
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    const rect = element.getBoundingClientRect();
    origX = rect.left; origY = rect.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    element.style.left  = (origX + (e.clientX - startX)) + 'px';
    element.style.top   = (origY + (e.clientY - startY)) + 'px';
    element.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => { isDragging = false; });
}

function buildCallbacks() {
  return {
    executeWidgetAction,
    executeInlineEvent,
    showConfig: () => showConfig(buildConfigCallbacks()),
    showToast,
    showResultModal,
    expandCard: (widgetVar, scroll) => {
      expandCard(state.panelEl, state.widgetsData, widgetVar, scroll, buildCallbacks());
      config.detailWidgetVar = widgetVar;
      saveConfig();
    },
  };
}

function buildConfigCallbacks() {
  return {
    applyTheme,
    reloadPanel: () => {
      const wasDetail = config.detailWidgetVar;
      destroyPanel();
      createPanel();
      config.detailWidgetVar = wasDetail;
      saveConfig();
    },
  };
}

export function createPanel() {
  if (state.panelEl) {
    state.panelEl.style.display = 'flex';
    applyTheme();
    config.panelOpen = true;
    saveConfig();
    return;
  }

  state.panelEl = document.createElement('div');
  state.panelEl.id = 'pf-inspector-panel';
  state.panelEl.innerHTML = `
    <div class="pfi-header pfi-drag-handle">
      <svg class="pfi-logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="var(--accent)" stroke-width="1.5" fill="var(--accent-bg)"/>
        <text x="12" y="16" text-anchor="middle" fill="var(--accent)" font-size="10" font-weight="700" font-family="sans-serif">PF</text>
      </svg>
      <span class="pfi-title">${escHtml(t('title'))}</span>
      <span class="pfi-count" id="pfi-count"></span>
      <button class="pfi-header-btn" id="pfi-btn-select"  title="${escAttr(t('btnSelect'))}">${icon('crosshair', 14)}</button>
      <button class="pfi-header-btn" id="pfi-btn-config"  title="${escAttr(t('btnConfig'))}">${icon('settings', 14)}</button>
      <button class="pfi-header-btn" id="pfi-btn-refresh" title="${escAttr(t('btnRefresh'))}">${icon('rotate-ccw', 14)}</button>
      <button class="pfi-header-btn" id="pfi-btn-close"   title="${escAttr(t('btnClose'))}">${icon('x', 14)}</button>
    </div>
    <div class="pfi-info-bar" id="pfi-info-bar"></div>
  `;

  const searchBar = buildSearchBar(buildCallbacks());
  state.panelEl.appendChild(searchBar);

  const listEl = document.createElement('div');
  listEl.className = 'pfi-list';
  listEl.id = 'pfi-list';
  state.panelEl.appendChild(listEl);

  const toastStack = document.createElement('div');
  toastStack.className = 'pfi-toast-stack';
  toastStack.id = 'pfi-toast-stack';
  state.panelEl.appendChild(toastStack);

  document.body.appendChild(state.panelEl);

  state.panelEl.querySelector('#pfi-btn-close').addEventListener('click', closePanel);
  state.panelEl.querySelector('#pfi-btn-refresh').addEventListener('click', requestWidgets);
  state.panelEl.querySelector('#pfi-btn-config').addEventListener('click', () => showConfig(buildConfigCallbacks()));
  state.panelEl.querySelector('#pfi-btn-select').addEventListener('click', () => {
    toggleSelectionMode({ expandCard: buildCallbacks().expandCard });
  });

  wireSearchEvents(state.panelEl, buildCallbacks());
  makeDraggable(state.panelEl, state.panelEl.querySelector('.pfi-drag-handle'));
  initTooltips(state.panelEl);
  applyTheme();
  applyDynamicColors();
  injectPageScript();
  setTimeout(requestWidgets, 300);

  config.panelOpen = true;
  saveConfig();
}

export function closePanel() {
  if (state.selectionMode) deactivateSelectionMode();
  if (state.panelEl) {
    state.panelEl.style.display = 'none';
    clearHighlight();
    clearTargetHighlight();
    clearEventRowHighlights();
  }
  config.panelOpen = false;
  saveConfig();
}

export function destroyPanel() {
  if (state.selectionMode) deactivateSelectionMode();
  if (state.panelEl) { state.panelEl.remove(); state.panelEl = null; }
}

function togglePfDependentUi() {
  if (!state.panelEl) return;
  const hasPf = state.pageInfo.hasPrimeFaces;
  const toolbar = state.panelEl.querySelector('.pfi-toolbar');
  const selectBtn = state.panelEl.querySelector('#pfi-btn-select');
  if (toolbar) toolbar.style.display = hasPf ? '' : 'none';
  if (selectBtn) selectBtn.style.display = hasPf ? '' : 'none';
  if (!hasPf && state.selectionMode) deactivateSelectionMode();
}

export function refreshPanel() {
  applyFilters();
  renderList(buildCallbacks());
  renderHeaderInfo();
  togglePfDependentUi();
}
