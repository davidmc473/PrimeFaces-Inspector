import { state } from '../core/state.js';
import { t } from '../core/i18n.js';
import { icon } from './icons.js';
import { escHtml, escAttr } from './utils.js';
import { startEventMonitor, stopEventMonitor } from '../core/messaging.js';

/* ──────────────────────────────────────────────────────────────
   Monitor: timeline de peticiones Ajax + eventos en vivo.
   Overlay con dos pestañas sobre el panel, al estilo de config.
   ────────────────────────────────────────────────────────────── */

const MAX_AJAX_ENTRIES = 100;
const MAX_EVENT_ENTRIES = 200;

let activeTab = 'ajax';
const expandedIds = new Set();

/* ── Entrada de datos (llamado desde index.js) ── */

export function onAjaxStart(data) {
  state.ajaxLog.unshift({ ...data, pending: true });
  if (state.ajaxLog.length > MAX_AJAX_ENTRIES) state.ajaxLog.length = MAX_AJAX_ENTRIES;
  renderIfOpen('ajax');
}

export function onAjaxDone(data) {
  const entry = state.ajaxLog.find(e => e.id === data.id);
  if (!entry) return;
  Object.assign(entry, data, { pending: false });
  renderIfOpen('ajax');
}

export function onEventFired(data) {
  state.eventLog.unshift(data);
  if (state.eventLog.length > MAX_EVENT_ENTRIES) state.eventLog.length = MAX_EVENT_ENTRIES;
  renderIfOpen('events');
}

/* ── Overlay ── */

function getOverlay() {
  return state.panelEl ? state.panelEl.querySelector('.pfi-monitor-overlay') : null;
}

export function toggleMonitor() {
  const existing = getOverlay();
  if (existing) { existing.remove(); return; }
  showMonitor();
}

export function showMonitor() {
  if (!state.panelEl) return;
  const prev = getOverlay();
  if (prev) prev.remove();

  const overlay = document.createElement('div');
  overlay.className = 'pfi-monitor-overlay';
  overlay.innerHTML = `
    <div class="pfi-overlay-header">
      <button class="pfi-icon-btn" data-role="close" title="${escAttr(t('back'))}">${icon('arrow-left', 14)}</button>
      <span class="pfi-overlay-title">${icon('activity', 14)} ${escHtml(t('monTitle'))}</span>
      <button class="pfi-icon-btn" data-role="clear" title="${escAttr(t('monClear'))}">${icon('trash', 14)}</button>
    </div>
    <div class="pfi-mon-tabs">
      <button class="pfi-mon-tab" data-tab="ajax">${escHtml(t('monTabAjax'))} <span class="pfi-mon-tab-count" data-role="count-ajax"></span></button>
      <button class="pfi-mon-tab" data-tab="events">${escHtml(t('monTabEvents'))} <span class="pfi-mon-tab-count" data-role="count-events"></span></button>
      <button class="pfi-mon-live-btn" data-role="live" title="${escAttr(t('monLiveStart'))}"></button>
    </div>
    <div class="pfi-mon-body" data-role="body"></div>
  `;
  state.panelEl.appendChild(overlay);

  overlay.querySelector('[data-role="close"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-role="clear"]').addEventListener('click', () => {
    if (activeTab === 'ajax') { state.ajaxLog = []; expandedIds.clear(); }
    else state.eventLog = [];
    renderMonitor();
  });
  overlay.querySelectorAll('.pfi-mon-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab');
      renderMonitor();
    });
  });
  overlay.querySelector('[data-role="live"]').addEventListener('click', () => {
    state.eventMonitorOn = !state.eventMonitorOn;
    if (state.eventMonitorOn) { startEventMonitor(); activeTab = 'events'; }
    else stopEventMonitor();
    renderMonitor();
  });

  renderMonitor();
}

function renderIfOpen(tab) {
  const overlay = getOverlay();
  if (!overlay) return;
  updateTabCounts(overlay);
  if (activeTab === tab) renderBody(overlay);
}

function updateTabCounts(overlay) {
  const ca = overlay.querySelector('[data-role="count-ajax"]');
  const ce = overlay.querySelector('[data-role="count-events"]');
  if (ca) ca.textContent = state.ajaxLog.length || '';
  if (ce) ce.textContent = state.eventLog.length || '';
}

function renderMonitor() {
  const overlay = getOverlay();
  if (!overlay) return;

  overlay.querySelectorAll('.pfi-mon-tab').forEach(btn => {
    btn.classList.toggle('pfi-mon-tab-active', btn.getAttribute('data-tab') === activeTab);
  });
  updateTabCounts(overlay);

  const liveBtn = overlay.querySelector('[data-role="live"]');
  liveBtn.innerHTML = state.eventMonitorOn
    ? icon('pause', 12) + ' ' + escHtml(t('monLiveOn'))
    : icon('play', 12) + ' ' + escHtml(t('monLiveOff'));
  liveBtn.classList.toggle('pfi-mon-live-active', state.eventMonitorOn);
  liveBtn.title = state.eventMonitorOn ? t('monLiveStop') : t('monLiveStart');

  renderBody(overlay);
}

function renderBody(overlay) {
  const body = overlay.querySelector('[data-role="body"]');
  if (!body) return;
  if (activeTab === 'ajax') renderAjaxTab(body);
  else renderEventsTab(body);
}

/* ── Pestaña Ajax ── */

function fmtTime(ts) {
  const d = new Date(ts);
  const pad = (n, w) => String(n).padStart(w, '0');
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}.${pad(d.getMilliseconds(), 3)}`;
}

function ajaxStatusClass(e) {
  if (e.pending) return 'pfi-mon-st-pending';
  return e.ok ? 'pfi-mon-st-ok' : 'pfi-mon-st-err';
}

function ajaxStatusText(e) {
  if (e.pending) return t('monPending');
  if (e.ok) return String(e.status);
  return e.errorName || String(e.status);
}

/** Payload urlencoded → una línea por parámetro, legible */
function prettyRequestBody(body) {
  try {
    return String(body).split('&').map(pair => {
      try { return decodeURIComponent(pair.replace(/\+/g, ' ')); } catch (e) { return pair; }
    }).join('\n');
  } catch (e) {
    return String(body);
  }
}

function detailRow(label, value, mono = true) {
  if (value === null || value === undefined || value === '') return '';
  return `<div class="pfi-detail-row">
    <span class="pfi-detail-label">${escHtml(label)}</span>
    <span class="pfi-detail-value${mono ? ' pfi-mono' : ''}">${escHtml(String(value))}</span>
  </div>`;
}

function renderAjaxTab(body) {
  if (state.ajaxLog.length === 0) {
    body.innerHTML = `<div class="pfi-empty">${escHtml(t('monAjaxEmpty'))}</div>`;
    return;
  }
  body.innerHTML = state.ajaxLog.map(e => {
    const expanded = expandedIds.has(e.id);
    const duration = e.pending ? '…' : `${e.durationMs} ms`;
    const main = e.source || '—';
    const evBadge = e.event ? `<span class="pfi-mon-event-badge">${escHtml(e.event)}</span>` : '';
    let detail = '';
    if (expanded) {
      const updatesApplied = (e.updates && e.updates.length)
        ? e.updates.filter(u => !/ViewState|ViewRoot/.test(u)).join(', ') || e.updates.join(', ')
        : null;
      detail = `<div class="pfi-mon-detail">
        ${detailRow('source', e.source)}
        ${detailRow('event', e.event)}
        ${detailRow('process', e.process)}
        ${detailRow('update', e.update)}
        ${detailRow(t('monStatus'), e.pending ? t('monPending') : (e.ok ? `${e.status} OK` : (e.errorName || e.status)), false)}
        ${e.errorMessage ? detailRow(t('monErrorMsg'), e.errorMessage, false) : ''}
        ${e.redirect ? detailRow('redirect', e.redirect) : ''}
        ${e.pending ? '' : detailRow(t('monDuration'), `${e.durationMs} ms`, false)}
        ${updatesApplied ? detailRow(t('monUpdatesApplied'), updatesApplied) : ''}
        <details class="pfi-mon-payload">
          <summary>${escHtml(t('monRequest'))}</summary>
          <pre class="pfi-result-pre">${escHtml(prettyRequestBody(e.requestBody))}</pre>
        </details>
        ${e.responseBody ? `<details class="pfi-mon-payload">
          <summary>${escHtml(t('monResponse'))}</summary>
          <pre class="pfi-result-pre">${escHtml(e.responseBody)}</pre>
        </details>` : ''}
      </div>`;
    }
    return `<div class="pfi-mon-row${expanded ? ' pfi-mon-expanded' : ''}" data-id="${escAttr(e.id)}">
      <div class="pfi-mon-row-head" data-role="head">
        <span class="pfi-mon-status ${ajaxStatusClass(e)}" title="${escAttr(ajaxStatusText(e))}"></span>
        <span class="pfi-mon-main pfi-mono" title="${escAttr(main)}">${escHtml(main)}</span>
        ${evBadge}
        <span class="pfi-mon-duration">${escHtml(duration)}</span>
        <span class="pfi-mon-ts">${fmtTime(e.ts)}</span>
      </div>
      ${detail}
    </div>`;
  }).join('');

  body.querySelectorAll('.pfi-mon-row [data-role="head"]').forEach(head => {
    head.addEventListener('click', () => {
      const id = head.parentElement.getAttribute('data-id');
      if (expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id);
      renderBody(getOverlay());
    });
  });
}

/* ── Pestaña Eventos ── */

function renderEventsTab(body) {
  if (state.eventLog.length === 0) {
    const hint = state.eventMonitorOn ? t('monEventsEmpty') : t('monEventsPaused');
    body.innerHTML = `<div class="pfi-empty">${escHtml(hint)}</div>`;
    return;
  }
  body.innerHTML = state.eventLog.map(e => `
    <div class="pfi-mon-row pfi-mon-event-row">
      <div class="pfi-mon-row-head">
        <span class="pfi-event-badge pfi-event-badge-${e.source === 'jquery' ? 'jquery' : 'inline'}">${escHtml(e.source === 'jquery' ? t('sourceJquery') : t('sourceInline'))}</span>
        <span class="pfi-mon-evname pfi-mono">${escHtml(e.event)}</span>
        <span class="pfi-mon-main pfi-mono" title="${escAttr(e.widgetVar || e.ownerId || '')}">${escHtml(e.widgetVar || e.ownerId || '—')}</span>
        <span class="pfi-mon-ts">${fmtTime(e.ts)}</span>
      </div>
      ${e.detail ? `<div class="pfi-mon-event-detail pfi-mono">${escHtml(e.detail)}</div>` : ''}
    </div>
  `).join('');
}
