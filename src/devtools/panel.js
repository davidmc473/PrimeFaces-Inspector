/* Panel "PrimeFaces" de las DevTools (punto 4.1 de docs/MEJORAS.md).
   Corre en el documento del panel (contexto devtools), sin acceso al DOM
   de la página: habla con el content script de la pestaña inspeccionada a
   través del background (puerto 'pfi-devtools'), que hace de relay en
   ambos sentidos. Complementa al panel flotante inyectado, no lo sustituye:
   las acciones que necesitan la página (resaltar, ejecutar Client API…)
   se delegan en él. */
import { icon, getComponentIcon } from '../content/ui/icons.js';
import { escHtml, escAttr } from '../content/ui/utils.js';
import en from '../i18n/en.js';
import es from '../i18n/es.js';

/* El panel no tiene acceso a la config del content script (storage de la
   página), así que el idioma se resuelve por el del navegador. */
const dict = (navigator.language || 'en').toLowerCase().startsWith('es') ? es : en;
function t(key, ...args) {
  let s = dict[key] !== undefined ? dict[key] : (en[key] !== undefined ? en[key] : key);
  args.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}

const tabId = chrome.devtools.inspectedWindow.tabId;

let port = null;
let widgets = [];
let pageInfo = null;      // null = aún sin respuesta de la página
let cannotInspect = false;
let searchTerm = '';
let typeFilter = '';
let expandedVar = null;
let ajaxTimer = null;

/* ── Conexión con el background (relay hacia el content script) ── */

function connect() {
  port = chrome.runtime.connect({ name: 'pfi-devtools' });
  port.postMessage({ type: 'init', tabId });
  port.onMessage.addListener(onRelayMessage);
  // El service worker MV3 puede dormirse y cerrar el puerto: reconectar.
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(connect, 400);
  });
}

function sendToPage(message) {
  if (!port) return;
  try { port.postMessage({ type: 'toTab', message }); } catch (e) { /* reconectando */ }
}

function collect() {
  cannotInspect = false;
  sendToPage({ action: 'pfiDevtoolsCollect' });
}

function onRelayMessage(msg) {
  if (!msg) return;
  if (msg.type === 'pfiError') {
    cannotInspect = true;
    renderInfo();
    return;
  }
  if (msg.kind === 'data') {
    widgets = msg.data || [];
    if (msg.info) pageInfo = msg.info;
    cannotInspect = false;
    renderInfo();
    renderTypeOptions();
    renderList();
  } else if (msg.kind === 'ajax') {
    // Tras un Ajax la página puede haber creado/destruido widgets
    clearTimeout(ajaxTimer);
    ajaxTimer = setTimeout(collect, 500);
  }
}

/* ── Esqueleto estático ── */

function buildSkeleton() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="dtp-header">
      <svg class="dtp-logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="var(--accent)" stroke-width="1.5" fill="var(--accent-bg)"/>
        <text x="12" y="16" text-anchor="middle" fill="var(--accent)" font-size="10" font-weight="700" font-family="sans-serif">PF</text>
      </svg>
      <span class="dtp-title">${escHtml(t('title'))}</span>
      <span class="dtp-count" id="dtp-count"></span>
      <button class="dtp-btn" id="dtp-btn-floating" title="${escAttr(t('dtBtnFloating'))}">${icon('maximize-2', 14)}</button>
      <button class="dtp-btn" id="dtp-btn-refresh" title="${escAttr(t('btnRefresh'))}">${icon('rotate-ccw', 14)}</button>
    </div>
    <div class="dtp-info" id="dtp-info"></div>
    <div class="dtp-toolbar" id="dtp-toolbar">
      <div class="dtp-search-wrap">
        ${icon('search', 13)}
        <input type="text" id="dtp-search" placeholder="${escAttr(t('searchPlaceholder'))}" spellcheck="false">
      </div>
      <select id="dtp-type" title="${escAttr(t('filterButton'))}"></select>
    </div>
    <div class="dtp-list" id="dtp-list"></div>
  `;

  app.querySelector('#dtp-btn-refresh').addEventListener('click', collect);
  app.querySelector('#dtp-btn-floating').addEventListener('click', () => {
    sendToPage({ action: 'togglePanel' });
  });
  app.querySelector('#dtp-search').addEventListener('input', (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderList();
  });
  app.querySelector('#dtp-type').addEventListener('change', (e) => {
    typeFilter = e.target.value;
    renderList();
  });

  // Delegación de eventos de la lista (cards y botones de acción)
  app.querySelector('#dtp-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (btn) {
      const card = btn.closest('.dtp-card');
      const w = widgets.find(x => x.widgetVar === card.dataset.var);
      if (!w) return;
      if (btn.dataset.act === 'highlight') {
        sendToPage({ action: 'pfiDevtoolsHighlight', id: w.id });
      } else if (btn.dataset.act === 'open') {
        sendToPage({ action: 'pfiDevtoolsOpenDetail', widgetVar: w.widgetVar });
      }
      return;
    }
    const head = e.target.closest('.dtp-card-head');
    if (head) {
      const card = head.closest('.dtp-card');
      expandedVar = (expandedVar === card.dataset.var) ? null : card.dataset.var;
      renderList();
    }
  });
}

/* ── Render de regiones ── */

function renderInfo() {
  const bar = document.getElementById('dtp-info');
  if (cannotInspect) {
    bar.className = 'dtp-info dtp-info-warn';
    bar.innerHTML = `${icon('alert-triangle', 12)}<span>${escHtml(t('dtCannotInspect'))}</span>`;
    return;
  }
  if (!pageInfo) {
    bar.className = 'dtp-info dtp-info-muted';
    bar.innerHTML = `${icon('clock', 12)}<span>${escHtml(t('dtConnecting'))}</span>`;
    return;
  }
  if (!pageInfo.hasPrimeFaces) {
    bar.className = 'dtp-info dtp-info-warn';
    bar.innerHTML = `${icon('alert-triangle', 12)}<span>${escHtml(t('pfNotDetected'))}</span>`;
    return;
  }
  const parts = [`<span class="dtp-info-main">${escHtml(t('pfDetected', pageInfo.version || '?'))}</span>`];
  if (pageInfo.hasPrimeFacesExt) {
    parts.push(`<span class="dtp-info-sub">${escHtml(t('pfExtDetected', pageInfo.versionExt || '?'))}</span>`);
  }
  if (!pageInfo.hasJQuery) {
    parts.push(`<span class="dtp-info-sub dtp-warn-text">${escHtml(t('jqueryMissing'))}</span>`);
  }
  bar.className = 'dtp-info dtp-info-ok';
  bar.innerHTML = `${icon('check-circle', 12)}${parts.join('')}`;
}

function renderTypeOptions() {
  const sel = document.getElementById('dtp-type');
  const types = Array.from(new Set(widgets.map(w => w.type))).sort();
  if (typeFilter && !types.includes(typeFilter)) typeFilter = '';
  sel.innerHTML = `<option value="">${escHtml(t('filterAll'))}</option>` +
    types.map(ty => `<option value="${escAttr(ty)}" ${ty === typeFilter ? 'selected' : ''}>${escHtml(ty)}</option>`).join('');
}

function filteredWidgets() {
  return widgets.filter(w => {
    const matchesSearch = !searchTerm ||
      w.widgetVar.toLowerCase().includes(searchTerm) ||
      w.id.toLowerCase().includes(searchTerm) ||
      w.type.toLowerCase().includes(searchTerm);
    const matchesType = !typeFilter || w.type === typeFilter;
    return matchesSearch && matchesType;
  });
}

function renderList() {
  const listEl = document.getElementById('dtp-list');
  const data = filteredWidgets();
  document.getElementById('dtp-count').textContent = `${data.length}/${widgets.length}`;

  if (data.length === 0) {
    listEl.innerHTML = `<div class="dtp-empty">${escHtml(t('noWidgets'))}</div>`;
    return;
  }
  listEl.innerHTML = data.map(w => {
    const expanded = expandedVar === w.widgetVar;
    return `
      <div class="dtp-card ${expanded ? 'dtp-expanded' : ''}" data-var="${escAttr(w.widgetVar)}">
        <div class="dtp-card-head">
          <span class="dtp-card-icon">${getComponentIcon(w.type, 16)}</span>
          <span class="dtp-wvar">${escHtml(w.widgetVar)}</span>
          <span class="dtp-type-badge">${escHtml(w.type)}</span>
          <span class="dtp-card-id" title="${escAttr(w.id)}">${escHtml(w.id)}</span>
          <span class="dtp-card-actions">
            <button class="dtp-btn" data-act="highlight" title="${escAttr(t('dtHighlight'))}">${icon('crosshair', 13)}</button>
            <button class="dtp-btn" data-act="open" title="${escAttr(t('dtOpenDetail'))}">${icon('maximize-2', 13)}</button>
            <span class="dtp-chevron">${icon('chevron-right', 13)}</span>
          </span>
        </div>
        ${expanded ? renderDetail(w) : ''}
      </div>
    `;
  }).join('');
}

function renderDetail(w) {
  const rows = [
    [t('labelWidgetVar'), w.widgetVar],
    [t('labelId'), w.id],
    [t('labelType'), w.type],
  ];
  if (w.targetId) rows.push([t('labelTargetId'), w.targetId]);

  const metaEntries = Object.entries(w.metadata || {});
  const metaHtml = metaEntries.length === 0
    ? `<div class="dtp-detail-empty">${escHtml(t('dtMetaEmpty'))}</div>`
    : `<table class="dtp-table">${metaEntries.map(([k, v]) =>
        `<tr><td>${escHtml(k)}</td><td><code>${escHtml(String(v))}</code></td></tr>`).join('')}</table>`;

  const api = (w.clientAPI || []).filter(m => m.callable !== false);
  const apiHtml = api.length === 0
    ? `<div class="dtp-detail-empty">${escHtml(t('dtNoMethods'))}</div>`
    : `<div class="dtp-chips">${api.map(m =>
        `<span class="dtp-chip"><code>${escHtml(m.name)}(${m.arity})</code></span>`).join('')}</div>`;

  const events = w.events || [];
  const eventsHtml = events.length === 0
    ? `<div class="dtp-detail-empty">${escHtml(t('eventsEmpty'))}</div>`
    : events.map(ev => `
        <div class="dtp-event">
          <span class="dtp-event-src dtp-src-${escAttr(ev.source)}">${escHtml(ev.source === 'jquery' ? t('sourceJquery') : t('sourceInline'))}</span>
          <span class="dtp-event-name">${escHtml(ev.event)}</span>
          <code class="dtp-event-raw" title="${escAttr(ev.raw)}">${escHtml(ev.raw)}</code>
        </div>`).join('');

  return `
    <div class="dtp-detail">
      <table class="dtp-table dtp-table-main">${rows.map(([k, v]) =>
        `<tr><td>${escHtml(k)}</td><td><code>${escHtml(v)}</code></td></tr>`).join('')}</table>
      <div class="dtp-section">${escHtml(t('sectionMetadata'))}</div>
      ${metaHtml}
      <div class="dtp-section">${escHtml(t('sectionClientApi'))} <span class="dtp-section-count">${api.length}</span></div>
      ${apiHtml}
      <div class="dtp-section">${escHtml(t('sectionEvents'))} <span class="dtp-section-count">${events.length}</span></div>
      ${eventsHtml}
    </div>
  `;
}

/* ── Arranque ── */

if (chrome.devtools.panels.themeName === 'dark') {
  document.documentElement.classList.add('theme-dark');
}

buildSkeleton();
renderInfo();
renderList();
connect();
collect();
// La página puede tardar en cargar el content script: reintentar al inicio
setTimeout(() => { if (!pageInfo && !cannotInspect) collect(); }, 1200);

// Al navegar/recargar la pestaña, el content script se reinyecta: recolectar
chrome.devtools.network.onNavigated.addListener(() => {
  pageInfo = null;
  widgets = [];
  expandedVar = null;
  renderInfo();
  renderList();
  setTimeout(collect, 700);
  setTimeout(() => { if (!pageInfo && !cannotInspect) collect(); }, 2500);
});
