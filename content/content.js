/**
 * PrimeFaces Inspector – Content Script
 * Inyecta el panel de inspección y gestiona la comunicación con pageScript.js
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════
     Estado global
     ══════════════════════════════════════════ */
  let panelEl = null;
  let widgetsData = [];
  let filteredData = [];
  let searchTerm = '';
  let filterType = '';
  let currentHighlight = null;
  let currentTargetHighlight = null;
  let selectionMode = false;
  let config = {
    highlightUpdates: true,
    highlightProcess: true,
    theme: 'dark',           // 'dark' | 'light'
    persistPanel: true,      // mantener el panel abierto entre navegaciones
    panelOpen: false,        // estado en vivo (lo controla la propia extensión)
    detailWidgetVar: null    // widgetVar del detalle abierto, si lo hay
  };

  /* ══════════════════════════════════════════
     Iconos de componentes PrimeFaces
     ══════════════════════════════════════════ */
  const COMPONENT_ICONS = {
    DataTable: '📊', CommandButton: '🔘', CommandLink: '🔗',
    Dialog: '🗔', Panel: '📋', TabView: '📑',
    InputText: '✏️', InputTextarea: '📝', Calendar: '📅',
    SelectOneMenu: '📃', SelectBooleanCheckbox: '☑️', SelectManyCheckbox: '☑️',
    AutoComplete: '🔍', FileUpload: '📁', Tree: '🌳',
    TreeTable: '🌲', AccordionPanel: '📂', Menu: '☰',
    Menubar: '☰', ContextMenu: '📋', Growl: '🔔',
    Messages: '💬', OverlayPanel: '🗗', Tooltip: '💡',
    ProgressBar: '📊', Chart: '📈', Schedule: '📆',
    Carousel: '🎠', Galleria: '🖼️', Editor: '📝',
    Spinner: '🔢', Slider: '🎚️', Rating: '⭐',
    ColorPicker: '🎨', Chips: '🏷️', PickList: '↔️',
    OrderList: '↕️', DataList: '📋', DataGrid: '📊',
    DataScroller: '📜', Paginator: '📄', Fieldset: '📦',
    ConfirmDialog: '❓', Sidebar: '📑', Inplace: '✎',
    BlockUI: '🚫', Poll: '🔄', RemoteCommand: '⚡',
    OutputPanel: '📤', AjaxStatus: '🔄', Fragment: '🧩',
    Default: '🧩'
  };

  function getIcon(type) {
    for (const [key, icon] of Object.entries(COMPONENT_ICONS)) {
      if (type && type.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return COMPONENT_ICONS.Default;
  }

  /* ══════════════════════════════════════════
     Acciones de Client API por tipo de widget
     ══════════════════════════════════════════ */
  const ACTION_ICONS = {
    refresh: '🔄', clear: '🧹', close: '✖',
    show: '👁', hide: '🙈', toggle: '🔀'
  };

  function getActionsForType(type) {
    const actions = ['refresh'];
    if (!type) return actions;
    const t = type.toLowerCase();
    if (t.includes('autocomplete')) {
      actions.push('clear', 'close');
    }
    if (t.includes('confirmdialog') || t.includes('dialog') || t.includes('overlaypanel')) {
      actions.push('show', 'hide');
    }
    if (t.includes('sidebar')) {
      actions.push('show', 'hide', 'toggle');
    }
    return actions;
  }

  /* ══════════════════════════════════════════
     Cargar / guardar configuración
     ══════════════════════════════════════════ */
  function loadConfig(cb) {
    try {
      chrome.storage.local.get(['pfInspectorConfig'], (result) => {
        if (result.pfInspectorConfig) {
          Object.assign(config, result.pfInspectorConfig);
        }
        if (typeof cb === 'function') cb();
      });
    } catch (e) {
      if (typeof cb === 'function') cb();
    }
  }
  function saveConfig() {
    try {
      chrome.storage.local.set({ pfInspectorConfig: config });
    } catch (e) { /* ignore */ }
  }

  // Cargar config y, si procede, restaurar el panel automáticamente
  loadConfig(() => {
    if (config.persistPanel && config.panelOpen) {
      // Esperar a que el body exista (document_idle suele garantizarlo)
      if (document.body) {
        createPanel();
      } else {
        document.addEventListener('DOMContentLoaded', createPanel, { once: true });
      }
    }
  });

  /* ══════════════════════════════════════════
     Inyectar pageScript.js en la página
     ══════════════════════════════════════════ */
  function injectPageScript() {
    if (document.getElementById('pf-inspector-page-script')) return;
    const s = document.createElement('script');
    s.id = 'pf-inspector-page-script';
    s.src = chrome.runtime.getURL('inject/pageScript.js');
    (document.head || document.documentElement).appendChild(s);
  }

  /* ══════════════════════════════════════════
     Comunicación con pageScript.js
     ══════════════════════════════════════════ */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || !event.data.type) return;

    switch (event.data.type) {
      case 'PF_INSPECTOR_DATA':
        widgetsData = event.data.data || [];
        applyFilters();
        renderList();
        // Restaurar vista de detalle si estaba abierta antes de navegar
        if (config.persistPanel && config.detailWidgetVar && panelEl) {
          const stillOpen = panelEl.querySelector('.pfi-detail-overlay');
          if (!stillOpen) {
            const w = widgetsData.find(x => x.widgetVar === config.detailWidgetVar);
            if (w) showDetail(w, /*fromRestore*/ true);
          }
        }
        break;

      case 'PF_INSPECTOR_AJAX':
        handleAjaxProcess(event.data.data);
        break;

      case 'PF_INSPECTOR_UPDATE':
        handleAjaxUpdate(event.data.data);
        break;

      case 'PF_INSPECTOR_EXEC_RESULT':
        handleExecResult(event.data.data);
        break;
    }
  });

  function requestWidgets() {
    window.postMessage({ type: 'PF_INSPECTOR_COLLECT' }, '*');
  }

  /** Envía petición para ejecutar un método del Client API */
  function executeWidgetAction(widgetVar, method) {
    window.postMessage({ type: 'PF_INSPECTOR_EXEC_API', widgetVar, method }, '*');
  }

  /** Muestra toast con resultado de ejecución */
  function handleExecResult(data) {
    if (!panelEl) return;
    const container = panelEl.querySelector('.pfi-actions-toast-area');
    if (!container) return;

    // Eliminar toast previo
    const prev = container.querySelector('.pfi-action-toast');
    if (prev) prev.remove();

    const toast = document.createElement('div');
    if (data.success) {
      toast.className = 'pfi-action-toast pfi-toast-ok';
      toast.textContent = `✓ ${data.widgetVar}.${data.method}() ejecutado`;
    } else {
      toast.className = 'pfi-action-toast pfi-toast-err';
      toast.textContent = `✗ Error: ${data.error}`;
    }
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  /* ══════════════════════════════════════════
     Highlights de elementos
     ══════════════════════════════════════════ */
  function clearHighlight() {
    if (currentHighlight) {
      currentHighlight.classList.remove('pfi-highlight-hover');
      currentHighlight = null;
    }
  }

  function highlightElement(id) {
    clearHighlight();
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('pfi-highlight-hover');
      currentHighlight = el;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function clearTargetHighlight() {
    if (currentTargetHighlight) {
      currentTargetHighlight.classList.remove('pfi-highlight-target');
      currentTargetHighlight = null;
    }
  }

  function highlightTarget(id) {
    clearTargetHighlight();
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('pfi-highlight-target');
      currentTargetHighlight = el;
    }
  }

  /** Flash temporal de un color en un elemento */
  function flashElement(el, className, durationMs) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    setTimeout(() => {
      el.classList.remove(className);
    }, durationMs || 800);
  }

  /* ── Ajax process highlight (verde) ── */
  function handleAjaxProcess(data) {
    if (!config.highlightProcess) return;
    if (!data) return;
    const processStr = data.process || '';
    if (!processStr) return;
    const ids = processStr.split(/\s+/);
    ids.forEach(id => {
      if (id.startsWith('@')) return;
      const el = document.getElementById(id);
      if (el) flashElement(el, 'pfi-highlight-process', 800);
    });
  }

  /* ── Ajax update highlight (fucsia) ── */
  function handleAjaxUpdate(updatedIds) {
    if (!config.highlightUpdates) return;
    if (!updatedIds || !Array.isArray(updatedIds)) return;
    updatedIds.forEach(id => {
      if (id === 'javax.faces.ViewState') return;
      if (id === 'javax.faces.ViewRoot') return;
      const el = document.getElementById(id);
      if (el) flashElement(el, 'pfi-highlight-update', 800);
    });
  }

  /* ══════════════════════════════════════════
     Filtrado
     ══════════════════════════════════════════ */
  function applyFilters() {
    filteredData = widgetsData.filter(w => {
      const matchesSearch = !searchTerm ||
        w.widgetVar.toLowerCase().includes(searchTerm) ||
        w.id.toLowerCase().includes(searchTerm) ||
        w.type.toLowerCase().includes(searchTerm);
      const matchesType = !filterType || w.type === filterType;
      return matchesSearch && matchesType;
    });
  }

  function getUniqueTypes() {
    const types = new Set();
    widgetsData.forEach(w => types.add(w.type));
    return Array.from(types).sort();
  }

  /* ══════════════════════════════════════════
     Tema claro / oscuro
     ══════════════════════════════════════════ */
  function applyTheme() {
    if (!panelEl) return;
    if (config.theme === 'light') {
      panelEl.classList.add('pfi-theme-light');
    } else {
      panelEl.classList.remove('pfi-theme-light');
    }
  }

  /* ══════════════════════════════════════════
     Modo Selección
     ══════════════════════════════════════════ */
  function toggleSelectionMode() {
    if (selectionMode) {
      deactivateSelectionMode();
    } else {
      activateSelectionMode();
    }
  }

  function activateSelectionMode() {
    selectionMode = true;
    const btn = document.getElementById('pfi-btn-select');
    if (btn) btn.classList.add('pfi-btn-active');

    // Marcar todos los elementos de widgets en la página
    widgetsData.forEach(w => {
      const el = document.getElementById(w.id);
      if (el && !panelEl.contains(el)) {
        el.classList.add('pfi-selection-candidate');
      }
    });

    // Añadir listeners globales
    document.addEventListener('mouseover', onSelectionMouseOver, true);
    document.addEventListener('mouseout', onSelectionMouseOut, true);
    document.addEventListener('click', onSelectionClick, true);
    document.addEventListener('keydown', onSelectionKeyDown, true);
  }

  function deactivateSelectionMode() {
    selectionMode = false;
    const btn = document.getElementById('pfi-btn-select');
    if (btn) btn.classList.remove('pfi-btn-active');

    // Quitar marcas de candidato
    document.querySelectorAll('.pfi-selection-candidate').forEach(el => {
      el.classList.remove('pfi-selection-candidate');
    });

    // Quitar highlights de tarjetas
    if (panelEl) {
      const sel = panelEl.querySelector('.pfi-card-selected');
      if (sel) sel.classList.remove('pfi-card-selected');
    }

    clearHighlight();

    // Quitar listeners
    document.removeEventListener('mouseover', onSelectionMouseOver, true);
    document.removeEventListener('mouseout', onSelectionMouseOut, true);
    document.removeEventListener('click', onSelectionClick, true);
    document.removeEventListener('keydown', onSelectionKeyDown, true);
  }

  /** Encuentra qué widget corresponde a un elemento DOM (o ancestro) */
  function findWidgetForElement(el) {
    let current = el;
    while (current && current !== document.body) {
      if (current.id) {
        const widget = widgetsData.find(w => w.id === current.id);
        if (widget) return widget;
      }
      current = current.parentElement;
    }
    return null;
  }

  /** Resalta la tarjeta correspondiente en la lista del panel */
  function highlightCardInList(widgetVar) {
    if (!panelEl) return;
    // Limpiar selección anterior
    const prev = panelEl.querySelector('.pfi-card-selected');
    if (prev) prev.classList.remove('pfi-card-selected');

    // Resaltar nueva tarjeta
    const card = panelEl.querySelector(`.pfi-card[data-widget-var="${widgetVar}"]`);
    if (card) {
      card.classList.add('pfi-card-selected');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function onSelectionMouseOver(e) {
    // Ignorar hover sobre el panel
    if (panelEl && panelEl.contains(e.target)) return;

    const widget = findWidgetForElement(e.target);
    if (widget) {
      highlightElement(widget.id);
      highlightCardInList(widget.widgetVar);
    }
  }

  function onSelectionMouseOut(e) {
    if (panelEl && panelEl.contains(e.target)) return;
    // Solo limpiar si no estamos entrando en otro widget
    // Dejamos el highlight hasta que entre en otro o salga completamente
  }

  function onSelectionClick(e) {
    // Ignorar clicks en el panel
    if (panelEl && panelEl.contains(e.target)) return;

    const widget = findWidgetForElement(e.target);
    if (widget) {
      e.preventDefault();
      e.stopPropagation();
      deactivateSelectionMode();
      showDetail(widget);
    }
  }

  function onSelectionKeyDown(e) {
    if (e.key === 'Escape') {
      deactivateSelectionMode();
    }
  }

  /* ══════════════════════════════════════════
     Construir UI del Panel
     ══════════════════════════════════════════ */
  function createPanel() {
    if (panelEl) {
      panelEl.style.display = 'flex';
      applyTheme();
      config.panelOpen = true;
      saveConfig();
      return;
    }

    panelEl = document.createElement('div');
    panelEl.id = 'pf-inspector-panel';

    panelEl.innerHTML = `
      <div class="pfi-header pfi-drag-handle">
        <svg class="pfi-logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="#00d4ff" stroke-width="2" fill="#0090ff33"/>
          <text x="12" y="16" text-anchor="middle" fill="#00d4ff" font-size="12" font-weight="bold" font-family="sans-serif">PF</text>
        </svg>
        <span class="pfi-title">PrimeFaces Inspector</span>
        <span class="pfi-count" id="pfi-count"></span>
        <button class="pfi-header-btn" id="pfi-btn-select" title="Modo Selección">◎</button>
        <button class="pfi-header-btn" id="pfi-btn-config" title="Configuración">⚙</button>
        <button class="pfi-header-btn" id="pfi-btn-refresh" title="Actualizar lista">⟳</button>
        <button class="pfi-header-btn" id="pfi-btn-close" title="Cerrar">✕</button>
      </div>
      <div class="pfi-toolbar">
        <input type="text" class="pfi-search" id="pfi-search" placeholder="Buscar widgetVar, id, tipo…">
        <select class="pfi-filter" id="pfi-filter">
          <option value="">Todos</option>
        </select>
      </div>
      <div class="pfi-list" id="pfi-list"></div>
    `;

    document.body.appendChild(panelEl);

    // Eventos del header
    document.getElementById('pfi-btn-close').addEventListener('click', closePanel);
    document.getElementById('pfi-btn-refresh').addEventListener('click', () => {
      requestWidgets();
    });
    document.getElementById('pfi-btn-config').addEventListener('click', showConfig);
    document.getElementById('pfi-btn-select').addEventListener('click', toggleSelectionMode);
    document.getElementById('pfi-search').addEventListener('input', (e) => {
      searchTerm = e.target.value.toLowerCase().trim();
      applyFilters();
      renderList();
    });
    document.getElementById('pfi-filter').addEventListener('change', (e) => {
      filterType = e.target.value;
      applyFilters();
      renderList();
    });

    // Drag
    makeDraggable(panelEl, panelEl.querySelector('.pfi-drag-handle'));

    // Aplicar tema
    applyTheme();

    // Colectar widgets
    injectPageScript();
    setTimeout(requestWidgets, 300);

    // Marcar como abierto (persistencia entre navegaciones)
    config.panelOpen = true;
    saveConfig();
  }

  function closePanel() {
    if (selectionMode) deactivateSelectionMode();
    if (panelEl) {
      panelEl.style.display = 'none';
      clearHighlight();
      clearTargetHighlight();
    }
    // Persistir cierre
    config.panelOpen = false;
    config.detailWidgetVar = null;
    saveConfig();
  }

  function destroyPanel() {
    if (selectionMode) deactivateSelectionMode();
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }
  }

  /* ══════════════════════════════════════════
     Renderizar lista de tarjetas
     ══════════════════════════════════════════ */
  function renderList() {
    const listEl = document.getElementById('pfi-list');
    const countEl = document.getElementById('pfi-count');
    const filterEl = document.getElementById('pfi-filter');
    if (!listEl) return;

    // Actualizar contador
    if (countEl) countEl.textContent = `${filteredData.length}/${widgetsData.length}`;

    // Actualizar filtro de tipos
    if (filterEl) {
      const currentVal = filterEl.value;
      const types = getUniqueTypes();
      filterEl.innerHTML = '<option value="">Todos</option>';
      types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (t === currentVal) opt.selected = true;
        filterEl.appendChild(opt);
      });
    }

    // Limpiar lista
    listEl.innerHTML = '';

    if (filteredData.length === 0) {
      listEl.innerHTML = '<div class="pfi-empty">No se encontraron widgets de PrimeFaces.</div>';
      return;
    }

    filteredData.forEach(w => {
      const card = document.createElement('div');
      card.className = 'pfi-card';
      card.setAttribute('data-widget-var', w.widgetVar);
      card.innerHTML = `
        <div class="pfi-card-icon" title="${escHtml(w.type)}">${getIcon(w.type)}</div>
        <div class="pfi-card-body">
          <div class="pfi-card-wvar">${escHtml(w.widgetVar)}</div>
          <div class="pfi-card-id">${escHtml(w.id)}</div>
        </div>
      `;

      // Hover → resaltar componente
      card.addEventListener('mouseenter', () => highlightElement(w.id));
      card.addEventListener('mouseleave', () => clearHighlight());

      // Click → detalle
      card.addEventListener('click', () => showDetail(w));

      listEl.appendChild(card);
    });
  }

  /* ══════════════════════════════════════════
     Vista de detalle de un widget
     ══════════════════════════════════════════ */
  function showDetail(w, fromRestore) {
    // Eliminar detalle anterior si existe
    const existing = panelEl.querySelector('.pfi-detail-overlay');
    if (existing) existing.remove();

    // Persistir el widget en detalle (excepto cuando es una restauración)
    if (!fromRestore) {
      config.detailWidgetVar = w.widgetVar;
      saveConfig();
    }

    const overlay = document.createElement('div');
    overlay.className = 'pfi-detail-overlay';

    // ── Eventos HTML ──
    let eventsHtml = '';
    if (w.events && w.events.length > 0) {
      eventsHtml = w.events.map(ev => {
        let paramsHtml = '';
        if (ev.parsedParams && ev.parsedParams.length > 0) {
          paramsHtml = `
            <table class="pfi-param-table">
              <thead><tr><th>Letra</th><th>Significado</th><th>Descripción</th><th>Valor</th></tr></thead>
              <tbody>
                ${ev.parsedParams.map(p => `
                  <tr>
                    <td>${escHtml(p.letter)}</td>
                    <td>${escHtml(p.name)}</td>
                    <td style="color:#888;font-size:10px">${escHtml(p.desc)}</td>
                    <td>${escHtml(p.value || '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }
        return `
          <div class="pfi-event-block">
            <div class="pfi-event-name">${escHtml(ev.event)}</div>
            <div class="pfi-event-raw">${escHtml(ev.raw)}</div>
            ${paramsHtml}
          </div>
        `;
      }).join('');
    } else {
      eventsHtml = '<div style="color:#555;font-size:11px;">Sin eventos inline detectados.</div>';
    }

    // ── Target HTML ──
    let targetHtml = '';
    if (w.targetId) {
      targetHtml = `
        <div class="pfi-detail-section">
          <h4>Target</h4>
          <div class="pfi-detail-row">
            <span class="pfi-detail-label">Target ID</span>
            <span class="pfi-detail-value pfi-target-link" data-target-id="${escAttr(w.targetId)}">${escHtml(w.targetId)}</span>
          </div>
        </div>
      `;
    }

    // ── Client API completa ──
    let apiHtml = '';
    if (w.clientAPI && w.clientAPI.length > 0) {
      apiHtml = `
        <div class="pfi-detail-section">
          <h4>Client API</h4>
          <div class="pfi-api-list">
            ${w.clientAPI.map(m => `<span class="pfi-api-tag">${escHtml(m)}()</span>`).join('')}
          </div>
        </div>
      `;
    }

    // ── Acciones ejecutables ──
    const actions = getActionsForType(w.type);
    let actionsHtml = '';
    if (actions.length > 0) {
      const buttonsHtml = actions.map(action => {
        const icon = ACTION_ICONS[action] || '▶';
        return `<button class="pfi-action-btn" data-action="${escAttr(action)}" data-wvar="${escAttr(w.widgetVar)}">
          <span class="pfi-action-icon">${icon}</span>${escHtml(action)}()
        </button>`;
      }).join('');

      actionsHtml = `
        <div class="pfi-detail-section">
          <h4>Acciones</h4>
          <div class="pfi-actions-grid">${buttonsHtml}</div>
          <div class="pfi-actions-toast-area"></div>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="pfi-detail-header">
        <button class="pfi-back-btn" id="pfi-detail-back" title="Volver">←</button>
        <span class="pfi-detail-title">${getIcon(w.type)} ${escHtml(w.widgetVar)}</span>
      </div>
      <div class="pfi-detail-body">
        <div class="pfi-detail-section">
          <h4>Información General</h4>
          <div class="pfi-detail-row">
            <span class="pfi-detail-label">widgetVar</span>
            <span class="pfi-detail-value">${escHtml(w.widgetVar)}</span>
          </div>
          <div class="pfi-detail-row">
            <span class="pfi-detail-label">ID</span>
            <span class="pfi-detail-value">${escHtml(w.id)}</span>
          </div>
          <div class="pfi-detail-row">
            <span class="pfi-detail-label">Tipo</span>
            <span class="pfi-detail-value">${escHtml(w.type)}</span>
          </div>
        </div>
        ${targetHtml}
        ${actionsHtml}
        ${apiHtml}
        <div class="pfi-detail-section">
          <h4>Eventos</h4>
          ${eventsHtml}
        </div>
      </div>
    `;

    panelEl.appendChild(overlay);

    // Botón volver
    overlay.querySelector('#pfi-detail-back').addEventListener('click', () => {
      overlay.remove();
      config.detailWidgetVar = null;
      saveConfig();
    });

    // Target hover → highlight
    const targetLink = overlay.querySelector('.pfi-target-link');
    if (targetLink) {
      targetLink.addEventListener('mouseenter', () => {
        highlightTarget(targetLink.getAttribute('data-target-id'));
      });
      targetLink.addEventListener('mouseleave', () => {
        clearTargetHighlight();
      });
    }

    // Botones de acción → ejecutar Client API
    overlay.querySelectorAll('.pfi-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const wvar = btn.getAttribute('data-wvar');
        executeWidgetAction(wvar, action);
      });
    });
  }

  /* ══════════════════════════════════════════
     Panel de Configuración
     ══════════════════════════════════════════ */
  function showConfig() {
    const existing = panelEl.querySelector('.pfi-config-overlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'pfi-config-overlay';

    overlay.innerHTML = `
      <div class="pfi-detail-header">
        <button class="pfi-back-btn" id="pfi-config-back" title="Volver">←</button>
        <span class="pfi-detail-title">⚙ Configuración</span>
      </div>
      <div class="pfi-config-body">
        <div class="pfi-config-item">
          <div>
            <span class="pfi-config-label">Tema oscuro / claro</span>
            <div class="pfi-desc">Cambiar entre modo oscuro y modo claro del panel.</div>
          </div>
          <label class="pfi-toggle" for="pfi-cfg-theme">
            <input type="checkbox" id="pfi-cfg-theme" ${config.theme === 'light' ? 'checked' : ''}>
            <span class="pfi-slider"></span>
          </label>
        </div>
        <div class="pfi-config-item">
          <div>
            <span class="pfi-config-label">Highlight Actualizaciones (fucsia)</span>
            <div class="pfi-desc">Resaltar en fucsia los elementos actualizados por Ajax response.</div>
          </div>
          <label class="pfi-toggle" for="pfi-cfg-updates">
            <input type="checkbox" id="pfi-cfg-updates" ${config.highlightUpdates ? 'checked' : ''}>
            <span class="pfi-slider"></span>
          </label>
        </div>
        <div class="pfi-config-item">
          <div>
            <span class="pfi-config-label">Highlight Process (verde)</span>
            <div class="pfi-desc">Resaltar en verde los elementos procesados al llamar PrimeFaces.ab().</div>
          </div>
          <label class="pfi-toggle" for="pfi-cfg-process">
            <input type="checkbox" id="pfi-cfg-process" ${config.highlightProcess ? 'checked' : ''}>
            <span class="pfi-slider"></span>
          </label>
        </div>
        <div class="pfi-config-item">
          <div>
            <span class="pfi-config-label">Persistir panel al navegar</span>
            <div class="pfi-desc">Mantener el panel abierto y refrescarlo automáticamente al cambiar de página.</div>
          </div>
          <label class="pfi-toggle" for="pfi-cfg-persist">
            <input type="checkbox" id="pfi-cfg-persist" ${config.persistPanel ? 'checked' : ''}>
            <span class="pfi-slider"></span>
          </label>
        </div>
      </div>
    `;

    panelEl.appendChild(overlay);

    overlay.querySelector('#pfi-config-back').addEventListener('click', () => {
      overlay.remove();
    });
    overlay.querySelector('#pfi-cfg-theme').addEventListener('change', (e) => {
      config.theme = e.target.checked ? 'light' : 'dark';
      applyTheme();
      saveConfig();
    });
    overlay.querySelector('#pfi-cfg-updates').addEventListener('change', (e) => {
      config.highlightUpdates = e.target.checked;
      saveConfig();
    });
    overlay.querySelector('#pfi-cfg-process').addEventListener('change', (e) => {
      config.highlightProcess = e.target.checked;
      saveConfig();
    });
    overlay.querySelector('#pfi-cfg-persist').addEventListener('change', (e) => {
      config.persistPanel = e.target.checked;
      saveConfig();
    });
  }

  /* ══════════════════════════════════════════
     Drag del panel
     ══════════════════════════════════════════ */
  function makeDraggable(element, handle) {
    let isDragging = false;
    let startX, startY, origX, origY;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.pfi-header-btn')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = (origX + dx) + 'px';
      element.style.top = (origY + dy) + 'px';
      element.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  /* ══════════════════════════════════════════
     Utilidades HTML
     ══════════════════════════════════════════ */
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escAttr(str) {
    return escHtml(str);
  }

  /* ══════════════════════════════════════════
     Mensajes desde popup / background
     ══════════════════════════════════════════ */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'togglePanel') {
      if (panelEl && panelEl.style.display !== 'none') {
        closePanel();
      } else {
        createPanel();
      }
      sendResponse({ ok: true });
    }
  });

  /* ══════════════════════════════════════════
     MutationObserver para detectar reemplazos DOM
     ══════════════════════════════════════════ */
  const observer = new MutationObserver((mutations) => {
    if (!config.highlightUpdates) return;
    mutations.forEach(mut => {
      if (mut.type === 'childList' && mut.addedNodes.length > 0) {
        mut.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.id) {
            const isWidget = widgetsData.some(w => w.id === node.id);
            if (isWidget) {
              flashElement(node, 'pfi-highlight-update', 800);
            }
          }
        });
      }
    });
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

})();
