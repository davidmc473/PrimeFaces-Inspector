/**
 * PrimeFaces Inspector – Content Script
 * Inyecta el panel de inspección y gestiona la comunicación con pageScript.js
 */
(function () {
  'use strict';

  // Evitar doble inyección (la extensión puede inyectarse manualmente desde el background)
  if (window.__pfInspectorLoaded) return;
  window.__pfInspectorLoaded = true;

  const GITHUB_URL = 'https://github.com/davidmc473/primefaces-chrome-extension';
  const EXT_VERSION = (chrome.runtime && chrome.runtime.getManifest)
    ? chrome.runtime.getManifest().version
    : '0.2.0';

  /* ══════════════════════════════════════════
     i18n — las cadenas viven en /i18n/<lang>.js
     y se exponen como window.__PF_I18N[lang]
     ══════════════════════════════════════════ */
  const I18N = (window.__PF_I18N && typeof window.__PF_I18N === 'object')
    ? window.__PF_I18N
    : { en: {}, es: {} };

  function resolveLang() {
    const cfg = config.language;
    if (cfg === 'en' || cfg === 'es') return cfg;
    const nav = (navigator.language || 'en').toLowerCase();
    return nav.startsWith('es') ? 'es' : 'en';
  }
  function t(key, ...args) {
    const lang = resolveLang();
    const dict = I18N[lang] || I18N.en || {};
    const fallback = I18N.en || {};
    let s = dict[key] !== undefined ? dict[key] : (fallback[key] !== undefined ? fallback[key] : key);
    args.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
    return s;
  }

  /* ══════════════════════════════════════════
     Estado global
     ══════════════════════════════════════════ */
  let panelEl = null;
  let widgetsData = [];
  let pageInfo = {
    hasPrimeFaces: false,
    version: null,
    hasPrimeFacesExt: false,
    versionExt: null,
    hasJQuery: false,
    widgetCount: 0
  };
  let filteredData = [];
  let searchTerm = '';
  /** Conjunto de tipos seleccionados; vacío = todos */
  let selectedTypes = new Set();
  let currentHighlight = null;
  let currentTargetHighlight = null;
  /** Highlights desde hover de filas de eventos (varios IDs) */
  let eventRowHighlights = [];
  let selectionMode = false;
  let ctrlShiftFired = false;

  const DEFAULT_COLOR_UPDATE = '#ff00aa';
  const DEFAULT_COLOR_PROCESS = '#00c850';

  let config = {
    highlightUpdates: true,
    highlightProcess: true,
    colorUpdate: DEFAULT_COLOR_UPDATE,
    colorProcess: DEFAULT_COLOR_PROCESS,
    theme: 'dark',
    persistPanel: true,
    panelOpen: false,
    /** widgetVar actualmente expandido en el acordeón (null = ninguno) */
    detailWidgetVar: null,
    language: 'auto',
    /** Mostrar eventos enlazados con jQuery en el detalle. Por defecto: desactivado */
    showJqueryEvents: false
  };

  /* ══════════════════════════════════════════
     Iconos de componentes PrimeFaces
     ══════════════════════════════════════════ */
  const COMPONENT_ICONS = {
    DataTable: '📊', CommandButton: '🔘', CommandLink: '🔗',
    Dialog: '🗔', Panel: '📋', TabView: '📑',
    InputNumber: '🔢', InputMask: '🎭',
    InputText: '✏️', InputTextarea: '📝', Calendar: '📅',
    DatePicker: '📅', TimePicker: '⏰',
    SelectOneMenu: '📃', SelectBooleanCheckbox: '☑️', SelectManyCheckbox: '☑️',
    AutoComplete: '🔍', FileUpload: '📁', Tree: '🌳',
    TreeTable: '🌲', AccordionPanel: '📂', Menu: '☰',
    Menubar: '☰', ContextMenu: '📋', Growl: '🔔',
    Messages: '💬', Message: '💬', OverlayPanel: '🗗', Tooltip: '💡',
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

  // Orden por longitud descendente para que coincidencias largas (InputNumber,
  // InputTextarea, ConfirmDialog) ganen sobre cortas (InputText, Dialog).
  const COMPONENT_ICON_KEYS = Object.keys(COMPONENT_ICONS)
    .filter(k => k !== 'Default')
    .sort((a, b) => b.length - a.length);

  function getIcon(type) {
    if (!type) return COMPONENT_ICONS.Default;
    const low = type.toLowerCase();
    for (const key of COMPONENT_ICON_KEYS) {
      if (low.includes(key.toLowerCase())) return COMPONENT_ICONS[key];
    }
    return COMPONENT_ICONS.Default;
  }


  /* ══════════════════════════════════════════
     Acciones de Client API por tipo de widget
     ══════════════════════════════════════════ */
  const ACTION_ICONS = {
    clear: '🧹', close: '✖',
    show: '👁', hide: '🙈', toggle: '🔀',
    enable: '✓', disable: '⊘',
    focus: '🎯', blur: '🌫',
    select: '☑', unselect: '☐',
    selectAll: '☑☑', unselectAll: '☐☐',
    open: '📂', expand: '⤢', collapse: '⤡',
    reset: '↺', reload: '🔁', play: '▶', pause: '⏸', stop: '⏹',
    next: '⏭', prev: '⏮', first: '⏮', last: '⏭',
    showAll: '👁', hideAll: '🙈'
  };

  /**
   * Devuelve la lista de acciones "destacadas" para un tipo concreto.
   * NOTA: además de éstas, el detalle muestra como botones todos los métodos
   *       del Client API que sean ejecutables (arity 0 y no destructivos).
   */
  function getActionsForType(type) {
    const actions = [];
    if (!type) return actions;
    const ty = type.toLowerCase();
    if (ty.includes('autocomplete')) {
      actions.push('clear', 'close');
    }
    if (ty.includes('confirmdialog') || ty.includes('dialog') || ty.includes('overlaypanel')) {
      actions.push('show', 'hide');
    }
    if (ty.includes('sidebar')) {
      actions.push('show', 'hide', 'toggle');
    }
    return actions;
  }

  /** Devuelve un icono apropiado para un método del Client API */
  function getActionIcon(name) {
    if (ACTION_ICONS[name]) return ACTION_ICONS[name];
    const low = name.toLowerCase();
    if (low.startsWith('show')) return '👁';
    if (low.startsWith('hide')) return '🙈';
    if (low.startsWith('toggle')) return '🔀';
    if (low.startsWith('clear') || low.startsWith('reset')) return '🧹';
    if (low.startsWith('enable')) return '✓';
    if (low.startsWith('disable')) return '⊘';
    if (low.startsWith('select')) return '☑';
    if (low.startsWith('unselect') || low.startsWith('deselect')) return '☐';
    if (low.startsWith('open')) return '📂';
    if (low.startsWith('close')) return '✖';
    if (low.startsWith('expand')) return '⤢';
    if (low.startsWith('collapse')) return '⤡';
    if (low.startsWith('focus')) return '🎯';
    if (low.startsWith('blur')) return '🌫';
    if (low.startsWith('refresh') || low.startsWith('reload') || low.startsWith('update')) return '🔁';
    if (low.startsWith('next') || low.startsWith('forward')) return '⏭';
    if (low.startsWith('prev') || low.startsWith('back')) return '⏮';
    if (low.startsWith('save')) return '💾';
    if (low.startsWith('load')) return '⬇';
    if (low.startsWith('print')) return '🖨';
    if (low.startsWith('search') || low.startsWith('filter')) return '🔍';
    if (low.startsWith('sort')) return '⇅';
    if (low.startsWith('start') || low.startsWith('play')) return '▶';
    if (low.startsWith('stop')) return '⏹';
    if (low.startsWith('pause')) return '⏸';
    return '▶';
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
        applyDynamicColors();
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

  /** Convierte hex (#rrggbb / #rgb) en {r,g,b} */
  function hexToRgb(hex) {
    if (!hex) return { r: 255, g: 0, b: 170 };
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const num = parseInt(h, 16);
    if (isNaN(num)) return { r: 255, g: 0, b: 170 };
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  /** Inyecta CSS dinámico con los colores actuales de updates y process */
  function applyDynamicColors() {
    let style = document.getElementById('pf-inspector-dynamic-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'pf-inspector-dynamic-style';
      (document.head || document.documentElement).appendChild(style);
    }
    const u = hexToRgb(config.colorUpdate);
    const p = hexToRgb(config.colorProcess);
    style.textContent = `
@keyframes pfi-flash-update-dyn {
  0% { background-color: rgba(${u.r},${u.g},${u.b},.20); box-shadow: inset 0 0 0 2px rgba(${u.r},${u.g},${u.b},.85); }
  100% { background-color: transparent; box-shadow: inset 0 0 0 2px transparent; }
}
.pfi-highlight-update {
  animation: pfi-flash-update-dyn .8s ease-out forwards !important;
}
@keyframes pfi-flash-process-dyn {
  0% { background-color: rgba(${p.r},${p.g},${p.b},.20); box-shadow: inset 0 0 0 2px rgba(${p.r},${p.g},${p.b},.85); }
  100% { background-color: transparent; box-shadow: inset 0 0 0 2px transparent; }
}
.pfi-highlight-process {
  animation: pfi-flash-process-dyn .8s ease-out forwards !important;
}
    `;
  }

  // Cargar config y, si procede, restaurar el panel automáticamente
  loadConfig(() => {
    if (config.persistPanel && config.panelOpen) {
      if (document.body) {
        createPanel();
      } else {
        document.addEventListener('DOMContentLoaded', createPanel, { once: true });
      }
    }
    // Atajo global Ctrl+Shift para modo selección
    document.addEventListener('keydown', onGlobalKeyDown, true);
    document.addEventListener('keyup', onGlobalKeyUp, true);
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
        if (event.data.info) pageInfo = Object.assign({
          hasPrimeFaces: false, version: null,
          hasPrimeFacesExt: false, versionExt: null,
          hasJQuery: false, widgetCount: 0
        }, event.data.info);
        applyFilters();
        renderList();
        renderHeaderInfo();
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
    window.postMessage({
      type: 'PF_INSPECTOR_COLLECT',
      showJqueryEvents: !!config.showJqueryEvents
    }, '*');
  }

  /** ID único para correlacionar resultados con su llamada */
  let __pfiCallSeq = 0;
  /** Callbacks pendientes por callId (para inyectar resultado en mini-form) */
  const pendingResultCallbacks = new Map();

  function executeWidgetAction(widgetVar, method, args, callback) {
    const callId = 'c' + (++__pfiCallSeq);
    if (typeof callback === 'function') {
      pendingResultCallbacks.set(callId, callback);
      // Limpiar callback huérfano tras 10s
      setTimeout(() => pendingResultCallbacks.delete(callId), 10000);
    }
    window.postMessage({
      type: 'PF_INSPECTOR_EXEC_API',
      widgetVar, method,
      args: Array.isArray(args) ? args : [],
      callId
    }, '*');
  }

  /** Ejecuta un evento inline (atributo on*) sobre el elemento indicado */
  function executeInlineEvent(ownerId, eventAttr, widgetVar) {
    window.postMessage({
      type: 'PF_INSPECTOR_EXEC_EVENT',
      ownerId, eventAttr, widgetVar
    }, '*');
  }

  /**
   * Muestra un toast persistente en el stack del panel (fuera de la zona que se
   * re-renderiza al refrescar widgets). Soporta resultados largos con botón "ver".
   */
  function showToast(opts) {
    if (!panelEl) return;
    const stack = panelEl.querySelector('#pfi-toast-stack');
    if (!stack) return;

    const toast = document.createElement('div');
    toast.className = 'pfi-action-toast ' + (opts.success ? 'pfi-toast-ok' : 'pfi-toast-err');

    // Texto principal
    const textSpan = document.createElement('span');
    textSpan.className = 'pfi-toast-text';
    textSpan.textContent = opts.text || '';
    toast.appendChild(textSpan);

    // Botón "ver completo" para resultados largos
    if (opts.fullResult && opts.fullResult.length > 0) {
      const viewBtn = document.createElement('button');
      viewBtn.className = 'pfi-toast-view-btn';
      viewBtn.textContent = '⛶ ' + t('viewFull');
      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showResultModal(opts.title || '', opts.fullResult);
      });
      toast.appendChild(viewBtn);
    }

    // Botón cerrar
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pfi-toast-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => toast.remove());
    toast.appendChild(closeBtn);

    stack.appendChild(toast);
    // Auto-hide después de 5s (más tiempo que antes)
    const hideMs = opts.fullResult ? 8000 : 5000;
    setTimeout(() => {
      toast.classList.add('pfi-toast-leaving');
      setTimeout(() => toast.remove(), 300);
    }, hideMs);
  }

  /** Muestra un modal con el resultado completo formateado */
  function showResultModal(title, content) {
    if (!panelEl) return;
    // Cerrar modal previo si existe
    const prev = panelEl.querySelector('.pfi-result-modal');
    if (prev) prev.remove();

    const modal = document.createElement('div');
    modal.className = 'pfi-result-modal';
    modal.innerHTML = `
      <div class="pfi-detail-header">
        <button class="pfi-back-btn" data-role="close" title="${escAttr(t('back'))}">←</button>
        <span class="pfi-detail-title">${escHtml(title || t('resultTitle'))}</span>
        <button class="pfi-header-btn" data-role="copy" title="${escAttr(t('copyResult'))}">⎘</button>
      </div>
      <div class="pfi-result-body"><pre class="pfi-result-pre">${escHtml(content)}</pre></div>
    `;
    panelEl.appendChild(modal);
    modal.querySelector('[data-role="close"]').addEventListener('click', () => modal.remove());
    modal.querySelector('[data-role="copy"]').addEventListener('click', () => {
      try {
        navigator.clipboard.writeText(content);
        showToast({ success: true, text: t('copied') });
      } catch (e) { /* ignore */ }
    });
  }

  function handleExecResult(data) {
    if (!panelEl) return;

    // Si la llamada tenía un callback asociado (mini-form), invocarlo en lugar
    // de (o además de) mostrar toast.
    if (data.callId && pendingResultCallbacks.has(data.callId)) {
      const cb = pendingResultCallbacks.get(data.callId);
      pendingResultCallbacks.delete(data.callId);
      try { cb(data); } catch (e) { /* ignore */ }
      // No mostramos toast cuando hay callback (el mini-form ya muestra el resultado)
      return;
    }

    if (data.success) {
      const fullResult = data.hasResult ? String(data.result == null ? '' : data.result) : '';
      let text;
      if (data.hasResult) {
        let resTxt = fullResult;
        if (resTxt.length > 80) resTxt = resTxt.slice(0, 80) + '…';
        text = t('execOkResult', data.widgetVar, data.method, resTxt);
      } else {
        text = t('execOk', data.widgetVar, data.method);
      }
      showToast({
        success: true,
        text: text,
        // Pasar el resultado completo solo si es lo bastante largo como para
        // que el botón "ver completo" tenga sentido
        fullResult: fullResult.length > 80 ? fullResult : null,
        title: "PF('" + data.widgetVar + "')." + data.method + "()"
      });
      // Refrescar metadatos tras la acción
      setTimeout(requestWidgets, 80);
    } else {
      showToast({ success: false, text: t('execErr', data.error) });
    }
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

  /** Resalta uno o varios IDs (separados por espacios o comas) en el hover de filas de eventos */
  function highlightEventRow(value) {
    clearEventRowHighlights();
    if (!value) return;
    // Soportar separadores: espacios, comas, punto-y-coma
    const ids = String(value).split(/[\s,;]+/);
    ids.forEach(rawId => {
      const id = rawId && rawId.trim();
      if (!id) return;
      // Saltar comodines @form / @this / @all / @parent ...
      if (id.startsWith('@')) return;
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('pfi-highlight-target');
        eventRowHighlights.push(el);
      }
    });
    if (eventRowHighlights.length > 0) {
      eventRowHighlights[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  function clearEventRowHighlights() {
    eventRowHighlights.forEach(el => el.classList.remove('pfi-highlight-target'));
    eventRowHighlights = [];
  }

  function flashElement(el, className, durationMs) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    setTimeout(() => {
      el.classList.remove(className);
    }, durationMs || 800);
  }

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
      const matchesType = selectedTypes.size === 0 || selectedTypes.has(w.type);
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
     Atajos globales: Ctrl+Shift → modo selección
     ══════════════════════════════════════════ */
  function onGlobalKeyDown(e) {
    if (!panelEl) return; // Solo si el panel está abierto
    // Activación: Ctrl+Shift sin otras teclas
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
      // Solo cuando el evento es de Control o Shift (no de otra letra combinada)
      if (e.key === 'Control' || e.key === 'Shift') {
        if (!ctrlShiftFired) {
          ctrlShiftFired = true;
          toggleSelectionMode();
        }
      }
    }
  }
  function onGlobalKeyUp(e) {
    if (!e.ctrlKey || !e.shiftKey) {
      ctrlShiftFired = false;
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

    widgetsData.forEach(w => {
      const el = document.getElementById(w.id);
      if (el && !panelEl.contains(el)) {
        el.classList.add('pfi-selection-candidate');
      }
    });

    document.addEventListener('mouseover', onSelectionMouseOver, true);
    document.addEventListener('mouseout', onSelectionMouseOut, true);
    document.addEventListener('click', onSelectionClick, true);
    document.addEventListener('keydown', onSelectionKeyDown, true);
  }

  function deactivateSelectionMode() {
    selectionMode = false;
    const btn = document.getElementById('pfi-btn-select');
    if (btn) btn.classList.remove('pfi-btn-active');

    document.querySelectorAll('.pfi-selection-candidate').forEach(el => {
      el.classList.remove('pfi-selection-candidate');
    });

    if (panelEl) {
      const sel = panelEl.querySelector('.pfi-card-selected');
      if (sel) sel.classList.remove('pfi-card-selected');
    }

    clearHighlight();

    document.removeEventListener('mouseover', onSelectionMouseOver, true);
    document.removeEventListener('mouseout', onSelectionMouseOut, true);
    document.removeEventListener('click', onSelectionClick, true);
    document.removeEventListener('keydown', onSelectionKeyDown, true);
  }

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

  function highlightCardInList(widgetVar) {
    if (!panelEl) return;
    const prev = panelEl.querySelector('.pfi-card-selected');
    if (prev) prev.classList.remove('pfi-card-selected');

    const card = panelEl.querySelector(`.pfi-card[data-widget-var="${widgetVar}"]`);
    if (card) {
      card.classList.add('pfi-card-selected');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function onSelectionMouseOver(e) {
    if (panelEl && panelEl.contains(e.target)) return;
    const widget = findWidgetForElement(e.target);
    if (widget) {
      highlightElement(widget.id);
      highlightCardInList(widget.widgetVar);
    }
  }
  function onSelectionMouseOut(e) {
    if (panelEl && panelEl.contains(e.target)) return;
  }
  function onSelectionClick(e) {
    if (panelEl && panelEl.contains(e.target)) return;
    const widget = findWidgetForElement(e.target);
    if (widget) {
      e.preventDefault();
      e.stopPropagation();
      deactivateSelectionMode();
      // Expandir la tarjeta correspondiente como acordeón
      expandCard(widget.widgetVar, /*scrollIntoView*/ true);
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
        <span class="pfi-title">${escHtml(t('title'))}</span>
        <span class="pfi-count" id="pfi-count"></span>
        <button class="pfi-header-btn" id="pfi-btn-select" title="${escAttr(t('btnSelect'))}">◎</button>
        <button class="pfi-header-btn" id="pfi-btn-config" title="${escAttr(t('btnConfig'))}">⚙</button>
        <button class="pfi-header-btn" id="pfi-btn-refresh" title="${escAttr(t('btnRefresh'))}">⟳</button>
        <button class="pfi-header-btn" id="pfi-btn-close" title="${escAttr(t('btnClose'))}">✕</button>
      </div>
      <div class="pfi-info-bar" id="pfi-info-bar"></div>
      <div class="pfi-toolbar">
        <input type="text" class="pfi-search" id="pfi-search" placeholder="${escAttr(t('searchPlaceholder'))}">
        <div class="pfi-multi-filter" id="pfi-multi-filter">
          <button type="button" class="pfi-filter-btn" id="pfi-filter-btn" title="${escAttr(t('filterButton'))}">
            <span id="pfi-filter-label">${escHtml(t('filterAll'))}</span>
            <span class="pfi-filter-caret">▾</span>
          </button>
          <div class="pfi-filter-dropdown" id="pfi-filter-dropdown" hidden>
            <div class="pfi-filter-dropdown-list" id="pfi-filter-list"></div>
            <div class="pfi-filter-dropdown-actions">
              <button type="button" class="pfi-link-btn" id="pfi-filter-clear">${escHtml(t('filterClear'))}</button>
            </div>
          </div>
        </div>
      </div>
      <div class="pfi-list" id="pfi-list"></div>
      <div class="pfi-toast-stack" id="pfi-toast-stack"></div>
    `;

    document.body.appendChild(panelEl);


    document.getElementById('pfi-btn-close').addEventListener('click', closePanel);
    document.getElementById('pfi-btn-refresh').addEventListener('click', requestWidgets);
    document.getElementById('pfi-btn-config').addEventListener('click', showConfig);
    document.getElementById('pfi-btn-select').addEventListener('click', toggleSelectionMode);
    document.getElementById('pfi-search').addEventListener('input', (e) => {
      searchTerm = e.target.value.toLowerCase().trim();
      applyFilters();
      renderList();
    });

    // Multi-filtro
    const filterBtn = document.getElementById('pfi-filter-btn');
    const filterDropdown = document.getElementById('pfi-filter-dropdown');
    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      filterDropdown.hidden = !filterDropdown.hidden;
    });
    document.addEventListener('click', (e) => {
      if (!panelEl) return;
      if (!filterDropdown.hidden && !filterDropdown.contains(e.target) && e.target !== filterBtn) {
        filterDropdown.hidden = true;
      }
    });
    document.getElementById('pfi-filter-clear').addEventListener('click', () => {
      selectedTypes.clear();
      renderFilterDropdown();
      updateFilterLabel();
      applyFilters();
      renderList();
    });

    makeDraggable(panelEl, panelEl.querySelector('.pfi-drag-handle'));
    applyTheme();
    applyDynamicColors();

    injectPageScript();
    setTimeout(requestWidgets, 300);

    config.panelOpen = true;
    saveConfig();
  }

  function closePanel() {
    if (selectionMode) deactivateSelectionMode();
    if (panelEl) {
      panelEl.style.display = 'none';
      clearHighlight();
      clearTargetHighlight();
      clearEventRowHighlights();
    }
    config.panelOpen = false;
    saveConfig();
  }

  /* ══════════════════════════════════════════
     Info bar (versión de PrimeFaces / aviso)
     ══════════════════════════════════════════ */
  function renderHeaderInfo() {
    const bar = panelEl && panelEl.querySelector('#pfi-info-bar');
    if (!bar) return;

    if (!pageInfo.hasPrimeFaces) {
      bar.className = 'pfi-info-bar pfi-info-warn';
      bar.innerHTML = `<span class="pfi-info-icon">⚠</span><span>${escHtml(t('pfNotDetected'))}</span>`;
      return;
    }

    const versionTxt = pageInfo.version || '?';
    const lines = [];
    lines.push(`<span>${escHtml(t('pfDetected', versionTxt))}</span>`);

    if (pageInfo.hasPrimeFacesExt) {
      const ev = pageInfo.versionExt || '?';
      lines.push(`<span class="pfi-info-sub">${escHtml(t('pfExtDetected', ev))}</span>`);
    } else {
      lines.push(`<span class="pfi-info-sub pfi-info-muted">${escHtml(t('pfExtNotDetected'))}</span>`);
    }

    if (!pageInfo.hasJQuery) {
      lines.push(`<span class="pfi-info-sub pfi-info-warn-text">${escHtml(t('jqueryMissing'))}</span>`);
    }

    bar.className = 'pfi-info-bar pfi-info-ok';
    bar.innerHTML = `<span class="pfi-info-icon">●</span><div class="pfi-info-lines">${lines.join('')}</div>`;
  }

  /* ══════════════════════════════════════════
     Multi-filtro (dropdown con checkboxes)
     ══════════════════════════════════════════ */
  function renderFilterDropdown() {
    const listEl = panelEl && panelEl.querySelector('#pfi-filter-list');
    if (!listEl) return;
    const types = getUniqueTypes();
    if (types.length === 0) {
      listEl.innerHTML = `<div class="pfi-filter-empty">—</div>`;
      return;
    }
    listEl.innerHTML = types.map(type => {
      const checked = selectedTypes.has(type) ? 'checked' : '';
      return `<label class="pfi-filter-row">
        <input type="checkbox" value="${escAttr(type)}" ${checked}>
        <span>${getIcon(type)} ${escHtml(type)}</span>
      </label>`;
    }).join('');
    // Listeners
    listEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const v = cb.value;
        if (cb.checked) selectedTypes.add(v); else selectedTypes.delete(v);
        updateFilterLabel();
        applyFilters();
        renderList();
      });
    });
  }
  function updateFilterLabel() {
    const lbl = panelEl && panelEl.querySelector('#pfi-filter-label');
    if (!lbl) return;
    if (selectedTypes.size === 0) {
      lbl.textContent = t('filterAll');
    } else if (selectedTypes.size === 1) {
      lbl.textContent = Array.from(selectedTypes)[0];
    } else {
      lbl.textContent = t('filterMulti', selectedTypes.size);
    }
  }

  /* ══════════════════════════════════════════
     Renderizar lista de tarjetas (acordeón)
     ══════════════════════════════════════════ */
  function renderList() {
    const listEl = document.getElementById('pfi-list');
    const countEl = document.getElementById('pfi-count');
    if (!listEl) return;

    if (countEl) countEl.textContent = `${filteredData.length}/${widgetsData.length}`;

    // Reconstruir dropdown manteniendo selecciones válidas
    const existingTypes = new Set(getUniqueTypes());
    Array.from(selectedTypes).forEach(ty => { if (!existingTypes.has(ty)) selectedTypes.delete(ty); });
    renderFilterDropdown();
    updateFilterLabel();

    listEl.innerHTML = '';

    if (filteredData.length === 0) {
      listEl.innerHTML = `<div class="pfi-empty">${escHtml(t('noWidgets'))}</div>`;
      return;
    }

    filteredData.forEach(w => {
      const card = buildCard(w);
      listEl.appendChild(card);
    });

    // Restaurar tarjeta expandida (si la había)
    if (config.detailWidgetVar) {
      const visible = filteredData.some(x => x.widgetVar === config.detailWidgetVar);
      if (visible) {
        expandCard(config.detailWidgetVar, /*scroll*/ false);
      } else {
        // El widget ya no es visible: deselecciono
        config.detailWidgetVar = null;
        saveConfig();
      }
    }
  }

  function buildCard(w) {
    const card = document.createElement('div');
    card.className = 'pfi-card pfi-accordion';
    card.setAttribute('data-widget-var', w.widgetVar);
    card.innerHTML = `
      <div class="pfi-card-head" data-role="head">
        <div class="pfi-card-icon" title="${escAttr(w.type)}">${getIcon(w.type)}</div>
        <div class="pfi-card-body">
          <div class="pfi-card-wvar">${escHtml(w.widgetVar)}</div>
          <div class="pfi-card-id">${escHtml(w.id)}</div>
        </div>
        <button class="pfi-chevron" type="button" aria-expanded="false"
                title="${escAttr(t('expand'))}" data-role="chevron">
          <span class="pfi-chevron-icon">▸</span>
        </button>
      </div>
      <div class="pfi-card-detail" data-role="detail" hidden></div>
    `;
    const head = card.querySelector('[data-role="head"]');
    const chev = card.querySelector('[data-role="chevron"]');

    // Hover: resaltar elemento real
    card.addEventListener('mouseenter', (e) => {
      // No resaltar si pasamos por encima del contenido del detalle (evita parpadeo)
      highlightElement(w.id);
    });
    card.addEventListener('mouseleave', () => clearHighlight());

    // Click en cabecera (excluyendo el chevron) → expand/collapse también
    head.addEventListener('click', (e) => {
      if (e.target.closest('.pfi-chevron')) return;
      toggleCard(w.widgetVar);
    });
    chev.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCard(w.widgetVar);
    });

    return card;
  }

  /* ══════════════════════════════════════════
     Acordeón: expand / collapse / toggle
     ══════════════════════════════════════════ */
  function toggleCard(widgetVar) {
    if (config.detailWidgetVar === widgetVar) {
      collapseCard(widgetVar);
    } else {
      expandCard(widgetVar, false);
    }
  }

  function collapseCard(widgetVar) {
    if (!panelEl) return;
    const card = panelEl.querySelector(`.pfi-card[data-widget-var="${cssEsc(widgetVar)}"]`);
    if (card) {
      card.classList.remove('pfi-expanded');
      const detail = card.querySelector('[data-role="detail"]');
      const chev = card.querySelector('[data-role="chevron"]');
      if (detail) { detail.hidden = true; detail.innerHTML = ''; }
      if (chev) {
        chev.setAttribute('aria-expanded', 'false');
        chev.setAttribute('title', t('expand'));
      }
    }
    config.detailWidgetVar = null;
    saveConfig();
    clearEventRowHighlights();
    clearTargetHighlight();
  }

  function expandCard(widgetVar, scrollIntoView) {
    if (!panelEl) return;

    // Colapsar cualquier otra tarjeta abierta
    panelEl.querySelectorAll('.pfi-card.pfi-expanded').forEach(c => {
      const wv = c.getAttribute('data-widget-var');
      if (wv !== widgetVar) {
        c.classList.remove('pfi-expanded');
        const d = c.querySelector('[data-role="detail"]');
        const ch = c.querySelector('[data-role="chevron"]');
        if (d) { d.hidden = true; d.innerHTML = ''; }
        if (ch) {
          ch.setAttribute('aria-expanded', 'false');
          ch.setAttribute('title', t('expand'));
        }
      }
    });

    const card = panelEl.querySelector(`.pfi-card[data-widget-var="${cssEsc(widgetVar)}"]`);
    if (!card) return;

    const w = widgetsData.find(x => x.widgetVar === widgetVar);
    if (!w) return;

    const detail = card.querySelector('[data-role="detail"]');
    const chev = card.querySelector('[data-role="chevron"]');
    detail.innerHTML = renderDetailHtml(w);
    detail.hidden = false;
    card.classList.add('pfi-expanded');
    if (chev) {
      chev.setAttribute('aria-expanded', 'true');
      chev.setAttribute('title', t('collapse'));
    }

    wireDetailEvents(detail, w);

    config.detailWidgetVar = widgetVar;
    saveConfig();

    if (scrollIntoView) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /** Escape de selectores CSS para atributos data */
  function cssEsc(str) {
    if (window.CSS && CSS.escape) return CSS.escape(str);
    return String(str).replace(/"/g, '\\"');
  }

  /* ══════════════════════════════════════════
     HTML del detalle (dentro del acordeón)
     ══════════════════════════════════════════ */
  function renderDetailHtml(w) {
    // ── Eventos ──
    let eventsHtml = '';
    if (w.events && w.events.length > 0) {
      eventsHtml = w.events.map((ev, evIdx) => {
        let paramsHtml = '';
        if (ev.parsedParams && ev.parsedParams.length > 0) {
          paramsHtml = `
            <table class="pfi-param-table">
              <thead><tr>
                <th>${escHtml(t('thLetter'))}</th>
                <th>${escHtml(t('thMeaning'))}</th>
                <th>${escHtml(t('thDescription'))}</th>
                <th>${escHtml(t('thValue'))}</th>
              </tr></thead>
              <tbody>
                ${ev.parsedParams.map(p => `
                  <tr class="pfi-event-row" data-value="${escAttr(p.value || '')}">
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
        const srcLabel = ev.source === 'jquery' ? t('sourceJquery') : t('sourceInline');

        // Botón ejecutar para eventos inline con ownerId conocido
        let execBtn = '';
        if (ev.source === 'inline' && ev.ownerId) {
          execBtn = `<button class="pfi-event-exec-btn"
            data-owner-id="${escAttr(ev.ownerId)}"
            data-event-attr="${escAttr(ev.event)}"
            data-wvar="${escAttr(w.widgetVar)}"
            title="${escAttr(t('btnExecEvent'))}">▶</button>`;
        }

        // Mostrar el ID del elemento "dueño" del evento si difiere del id del widget
        const ownerInfo = (ev.ownerId && ev.ownerId !== w.id)
          ? `<div class="pfi-event-owner" title="${escAttr(ev.ownerId)}">↳ ${escHtml(ev.ownerId)}</div>`
          : '';

        return `
          <div class="pfi-event-block">
            <div class="pfi-event-head">
              <span class="pfi-event-name">${escHtml(ev.event)}</span>
              <span class="pfi-event-source pfi-event-source-${escAttr(ev.source || 'inline')}">${escHtml(srcLabel)}</span>
              ${execBtn}
            </div>
            ${ownerInfo}
            <div class="pfi-event-raw">${escHtml(ev.raw)}</div>
            ${paramsHtml}
          </div>
        `;
      }).join('');
    } else {
      // Si no hay eventos y los jQuery están desactivados, mostrar pista clicable
      // que abre la sección de Configuración para activarlos
      const hint = !config.showJqueryEvents
        ? `<div class="pfi-events-hint pfi-clickable" data-role="open-config" title="${escAttr(t('openConfig'))}">${escHtml(t('eventsJqueryDisabled'))}</div>`
        : '';
      eventsHtml = `<div class="pfi-events-empty">${escHtml(t('eventsEmpty'))}</div>${hint}`;

    }

    // ── Target ──
    let targetHtml = '';
    if (w.targetId) {
      targetHtml = `
        <div class="pfi-detail-section">
          <h4>${escHtml(t('sectionTarget'))}</h4>
          <div class="pfi-detail-row">
            <span class="pfi-detail-label">${escHtml(t('labelTargetId'))}</span>
            <span class="pfi-detail-value pfi-target-link" data-target-id="${escAttr(w.targetId)}">${escHtml(w.targetId)}</span>
          </div>
        </div>
      `;
    }

    // ── Acciones / Client API ejecutable ──
    // Combinar acciones "destacadas" + todos los métodos del clientAPI callable
    // (arity 0 y no destructivos). Se renderizan como botones ejecutables.
    const featured = getActionsForType(w.type);
    const apiList = (w.clientAPI || []);
    // Normalizar: si w.clientAPI viene como array de strings (versiones antiguas), convertir
    const normalizedApi = apiList.map(m => (typeof m === 'string')
      ? { name: m, arity: 0, callable: true }
      : m
    );

    // Botones ejecutables: featured + métodos callable (sin duplicar)
    const seenAct = new Set();
    const callableMethods = [];
    featured.forEach(name => {
      if (seenAct.has(name)) return;
      seenAct.add(name);
      // Solo se considera ejecutable si existe en el clientAPI o si confiamos en que el widget lo expone
      callableMethods.push(name);
    });
    normalizedApi.forEach(m => {
      if (!m.callable) return;
      if (seenAct.has(m.name)) return;
      seenAct.add(m.name);
      callableMethods.push(m.name);
    });

    // Métodos no ejecutables (requieren argumentos o están en blacklist): se muestran como tags
    const nonCallableMethods = normalizedApi.filter(m => !m.callable);

    // Acciones que no aplican según el estado actual del widget
    // (no se puede deshabilitar lo que ya está deshabilitado, ni mostrar lo ya visible, etc.)
    const md = w.metadata || {};
    // Para AutoComplete, show() muestra el panel de sugerencias (no el widget en sí),
    // por lo que visible:true no implica que show() sea incompatible.
    const isAutoComplete = w.type && w.type.toLowerCase().includes('autocomplete');
    function isActionIncompatible(name) {
      const n = String(name);
      if (md.disabled === true && n === 'disable') return t('disabledAlready');
      if (md.disabled === false && n === 'enable') return t('enabledAlready');
      if (!isAutoComplete && md.visible === true && (n === 'show' || n === 'showAll' || n === 'open')) return t('shownAlready');
      if (md.visible === false && (n === 'hide' || n === 'hideAll' || n === 'close')) return t('hiddenAlready');
      return null;
    }

    // ── Sección unificada "Client API" ─────────────────────────────────────
    // Grupo 1 (azul): métodos ejecutables sin argumentos.
    // Grupo 2 (naranja): métodos que requieren argumentos (mini-form).
    // Ambos tipos de botón comparten la misma altura.
    let clientApiHtml = '';
    if (callableMethods.length > 0 || nonCallableMethods.length > 0) {
      const callableGroup = callableMethods.length > 0 ? `
        <div class="pfi-actions-grid">
          ${callableMethods.map(name => {
            const icon = getActionIcon(name);
            const incompatReason = isActionIncompatible(name);
            const tooltip = "PF('" + w.widgetVar + "')." + name + '()' + (incompatReason ? ' — ' + incompatReason : '');
            const disabledAttr = incompatReason ? ' disabled aria-disabled="true"' : '';
            const disabledCls = incompatReason ? ' pfi-action-disabled' : '';
            return `<button class="pfi-action-btn${disabledCls}" data-action="${escAttr(name)}" data-wvar="${escAttr(w.widgetVar)}" title="${escAttr(tooltip)}"${disabledAttr}>
              <span class="pfi-action-icon">${icon}</span>${escHtml(name)}()
            </button>`;
          }).join('')}
        </div>` : '';

      const argsGroup = nonCallableMethods.length > 0 ? `
        <div class="pfi-api-list${callableMethods.length > 0 ? ' pfi-api-list-gap' : ''}">
          ${nonCallableMethods.map(m => `<button type="button" class="pfi-api-method-btn"
            data-method="${escAttr(m.name)}"
            data-arity="${m.arity}"
            data-wvar="${escAttr(w.widgetVar)}"
            title="${escAttr(t('apiOpenForm', m.name, m.arity))}">
            <span class="pfi-action-icon">${getActionIcon(m.name)}</span>${escHtml(m.name)}(<span class="pfi-api-arity">${m.arity}</span>)
          </button>`).join('')}
        </div>` : '';

      clientApiHtml = `
        <div class="pfi-detail-section">
          <h4>${escHtml(t('sectionClientApi'))}</h4>
          ${callableGroup}
          ${argsGroup}
          <div class="pfi-api-form-host" data-role="api-form-host"></div>
          <div class="pfi-actions-toast-area"></div>
        </div>
      `;
    }


    // ── Metadata ──
    let metaHtml = '';
    if (w.metadata && Object.keys(w.metadata).length > 0) {
      const META_LABELS = {
        disabled: '🚫 disabled',
        readonly: '🔒 readonly',
        required: '❗ required',
        visible: '👁 visible',
        min: '⬇ min', max: '⬆ max',
        minlength: 'minlength', maxlength: 'maxlength',
        step: 'step',
        value: 'value', defaultValue: 'defaultValue',
        placeholder: 'placeholder', pattern: 'pattern',
        multiple: 'multiple', editable: 'editable',
        filter: 'filter', filterMatchMode: 'filterMatchMode',
        selectionMode: 'selectionMode',
        paginator: 'paginator', rows: 'rows', rowsPerPageTemplate: 'rowsPerPageTemplate',
        lazy: 'lazy', liveScroll: 'liveScroll',
        scrollable: 'scrollable', scrollHeight: 'scrollHeight', scrollWidth: 'scrollWidth',
        autoUpdate: 'autoUpdate', global: 'global', partialSubmit: 'partialSubmit',
        process: 'process', update: 'update', event: 'event',
        modal: 'modal', draggable: 'draggable', resizable: 'resizable',
        closable: 'closable', closeOnEscape: 'closeOnEscape',
        width: 'width', height: 'height', position: 'position',
        dateFormat: 'dateFormat', showTime: 'showTime', showSeconds: 'showSeconds',
        timeOnly: 'timeOnly', mode: 'mode', selectOtherMonths: 'selectOtherMonths',
        currencySymbol: 'currencySymbol', decimalSeparator: 'decimalSeparator',
        thousandSeparator: 'thousandSeparator', decimalPlaces: 'decimalPlaces',
        symbol: 'symbol', orientation: 'orientation', dropdownMode: 'dropdownMode',
        forceSelection: 'forceSelection', unique: 'unique', cache: 'cache',
        showHeader: 'showHeader', showFooter: 'showFooter',
        effect: 'effect', effectSpeed: 'effectSpeed',
        maxFileSize: 'maxFileSize', allowTypes: 'allowTypes', fileLimit: 'fileLimit',
        target: 'target', targetId: 'targetId', url: 'url'
      };
      const rows = Object.keys(w.metadata).map(k => {
        const v = w.metadata[k];
        const label = META_LABELS[k] || k;
        let displayVal;
        if (v === true) {
          displayVal = `<span class="pfi-meta-bool-true">✓ true</span>`;
        } else if (v === false) {
          displayVal = `<span class="pfi-meta-bool-false">✗ false</span>`;
        } else if (v === null || v === undefined || v === '') {
          displayVal = `<span class="pfi-meta-null">—</span>`;
        } else {
          displayVal = `<span class="pfi-meta-value-text">${escHtml(String(v))}</span>`;
        }
        return `<div class="pfi-meta-row">
          <span class="pfi-meta-key">${escHtml(label)}</span>
          <span class="pfi-meta-value">${displayVal}</span>
        </div>`;
      }).join('');
      metaHtml = `
        <div class="pfi-detail-section">
          <h4>${escHtml(t('sectionMetadata'))}</h4>
          <div class="pfi-meta-grid">${rows}</div>
        </div>
      `;
    }

    return `
      <div class="pfi-detail-section">
        <h4>${escHtml(t('sectionInfo'))}</h4>
        <div class="pfi-detail-row">
          <span class="pfi-detail-label">${escHtml(t('labelType'))}</span>
          <span class="pfi-detail-value">${escHtml(w.type)}</span>
        </div>
        <div class="pfi-detail-row">
          <span class="pfi-detail-label">${escHtml(t('labelWidgetVar'))}</span>
          <span class="pfi-detail-value">${escHtml(w.widgetVar)}</span>
        </div>
        <div class="pfi-detail-row">
          <span class="pfi-detail-label">${escHtml(t('labelId'))}</span>
          <span class="pfi-detail-value">${escHtml(w.id)}</span>
        </div>
      </div>
      ${metaHtml}
      ${targetHtml}
      ${clientApiHtml}
      <div class="pfi-detail-section">
        <h4>${escHtml(t('sectionEvents'))}</h4>
        ${eventsHtml}
      </div>
    `;
  }

  function wireDetailEvents(detail, w) {
    // Target link
    const targetLink = detail.querySelector('.pfi-target-link');
    if (targetLink) {
      targetLink.addEventListener('mouseenter', () => {
        highlightTarget(targetLink.getAttribute('data-target-id'));
      });
      targetLink.addEventListener('mouseleave', () => {
        clearTargetHighlight();
      });
    }

    // Acciones
    detail.querySelectorAll('.pfi-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const wvar = btn.getAttribute('data-wvar');
        executeWidgetAction(wvar, action);
      });
    });

    // Botón ejecutar evento inline (al lado del nombre del evento)
    detail.querySelectorAll('.pfi-event-exec-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ownerId = btn.getAttribute('data-owner-id');
        const evAttr = btn.getAttribute('data-event-attr');
        const wvar = btn.getAttribute('data-wvar');
        // Crear área de toast en el bloque del evento si no existe
        let host = btn.closest('.pfi-event-block');
        let toastArea = host && host.querySelector('.pfi-actions-toast-area');
        if (host && !toastArea) {
          toastArea = document.createElement('div');
          toastArea.className = 'pfi-actions-toast-area';
          host.appendChild(toastArea);
        }
        // El toast se renderizará en cualquier .pfi-actions-toast-area existente
        executeInlineEvent(ownerId, evAttr, wvar);
      });
      // Resaltar el elemento dueño al hacer hover sobre el botón
      btn.addEventListener('mouseenter', () => {
        const ownerId = btn.getAttribute('data-owner-id');
        if (ownerId) highlightTarget(ownerId);
      });
      btn.addEventListener('mouseleave', () => {
        clearTargetHighlight();
      });
    });

    // Hint clicable: "Eventos jQuery desactivados…" abre el panel de configuración
    detail.querySelectorAll('.pfi-events-hint.pfi-clickable[data-role="open-config"]').forEach(hint => {
      hint.addEventListener('click', (e) => {
        e.stopPropagation();
        showConfig();
      });
    });

    // Hover en filas de eventos → resaltar elementos cuyo ID aparece en "valor"
    detail.querySelectorAll('.pfi-event-row').forEach(row => {

      row.addEventListener('mouseenter', () => {
        const val = row.getAttribute('data-value');
        highlightEventRow(val);
        row.classList.add('pfi-event-row-active');
      });
      row.addEventListener('mouseleave', () => {
        clearEventRowHighlights();
        row.classList.remove('pfi-event-row-active');
      });
    });

    // Botones de Client API que requieren argumentos → abrir mini-form
    const formHost = detail.querySelector('[data-role="api-form-host"]');
    detail.querySelectorAll('.pfi-api-method-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const method = btn.getAttribute('data-method');
        const arity = parseInt(btn.getAttribute('data-arity'), 10) || 0;
        const wvar = btn.getAttribute('data-wvar');
        openApiArgForm(formHost, btn, wvar, method, arity);
      });
    });
  }

  /**
   * Abre/cierra un mini-formulario para ejecutar un método con argumentos.
   * Los argumentos se introducen como JSON (cada campo). Strings simples,
   * números y booleanos se aceptan tal cual.
   */
  function openApiArgForm(host, triggerBtn, widgetVar, method, arity) {
    if (!host) return;

    // Si ya hay un form abierto para el MISMO método y widget, lo cerramos (toggle)
    const existing = host.querySelector('.pfi-api-form');
    const sameMethod = existing
      && existing.getAttribute('data-method') === method
      && existing.getAttribute('data-wvar') === widgetVar;
    host.innerHTML = '';
    // Desmarcar selección previa
    host.parentElement.querySelectorAll('.pfi-api-method-btn.pfi-api-method-active')
      .forEach(b => b.classList.remove('pfi-api-method-active'));

    if (sameMethod) return; // era toggle de cierre

    if (triggerBtn) triggerBtn.classList.add('pfi-api-method-active');

    // Construir N filas de argumento (al menos 1 si arity==0 sería raro pero defensivo)
    const argCount = Math.max(arity, 1);
    const argRowsHtml = [];
    for (let i = 0; i < argCount; i++) {
      argRowsHtml.push(`
        <div class="pfi-api-arg-row">
          <label class="pfi-api-arg-label">arg ${i + 1}</label>
          <input type="text" class="pfi-api-arg-input"
            data-arg-index="${i}"
            placeholder="${escAttr(t('argPlaceholder'))}"
            spellcheck="false"
            autocomplete="off">
        </div>
      `);
    }

    const form = document.createElement('div');
    form.className = 'pfi-api-form';
    form.setAttribute('data-method', method);
    form.setAttribute('data-wvar', widgetVar);
    form.innerHTML = `
      <div class="pfi-api-form-header">
        <span class="pfi-api-form-title">PF('${escHtml(widgetVar)}').${escHtml(method)}(...)</span>
        <button type="button" class="pfi-api-form-close" data-role="close" title="${escAttr(t('btnCancel'))}">✕</button>
      </div>
      <div class="pfi-api-form-hint">${escHtml(t('argHint'))}</div>
      <div class="pfi-api-form-body">
        ${argRowsHtml.join('')}
      </div>
      <div class="pfi-api-form-actions">
        <button type="button" class="pfi-api-exec-btn" data-role="exec">▶ ${escHtml(t('btnExec'))}</button>
      </div>
      <div class="pfi-api-result" data-role="result" hidden></div>
    `;
    host.appendChild(form);

    const resultBox = form.querySelector('[data-role="result"]');
    const inputs = Array.from(form.querySelectorAll('.pfi-api-arg-input'));

    form.querySelector('[data-role="close"]').addEventListener('click', () => {
      host.innerHTML = '';
      if (triggerBtn) triggerBtn.classList.remove('pfi-api-method-active');
    });

    // Foco automático en el primer input
    setTimeout(() => { if (inputs[0]) inputs[0].focus(); }, 50);

    function execForm() {
      // Parsear cada input: intentar JSON.parse, fallback a string literal
      const args = [];
      for (const inp of inputs) {
        const raw = inp.value;
        if (raw === '') {
          args.push(undefined);
          continue;
        }
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          // No es JSON válido → tratar como string literal
          parsed = raw;
        }
        args.push(parsed);
      }

      // Recortar undefined del final para llamar con la arity adecuada
      while (args.length > 0 && args[args.length - 1] === undefined) {
        args.pop();
      }

      resultBox.hidden = false;
      resultBox.className = 'pfi-api-result pfi-api-result-pending';
      resultBox.textContent = '⏳ ' + t('executing');

      executeWidgetAction(widgetVar, method, args, (data) => {
        if (!data.success) {
          resultBox.className = 'pfi-api-result pfi-api-result-err';
          resultBox.textContent = '✗ ' + (data.error || '');
          return;
        }
        resultBox.className = 'pfi-api-result pfi-api-result-ok';
        if (!data.hasResult) {
          resultBox.textContent = '✓ ' + t('execOk', data.widgetVar, data.method);
        } else {
          const full = String(data.result == null ? '' : data.result);
          // Si es largo, mostrar versión truncada con botón "ver completo"
          resultBox.innerHTML = '';
          const header = document.createElement('div');
          header.className = 'pfi-api-result-header';
          header.textContent = '✓ ' + t('returnedValue') + ':';
          resultBox.appendChild(header);
          const pre = document.createElement('pre');
          pre.className = 'pfi-api-result-pre';
          pre.textContent = full;
          resultBox.appendChild(pre);
          if (full.length > 200) {
            const expandBtn = document.createElement('button');
            expandBtn.className = 'pfi-api-result-expand';
            expandBtn.textContent = '⛶ ' + t('viewFull');
            expandBtn.addEventListener('click', () => {
              showResultModal("PF('" + widgetVar + "')." + method + '()', full);
            });
            resultBox.appendChild(expandBtn);
          }
          // Botón copiar
          const copyBtn = document.createElement('button');
          copyBtn.className = 'pfi-api-result-copy';
          copyBtn.textContent = '⎘ ' + t('copyResult');
          copyBtn.addEventListener('click', () => {
            try {
              navigator.clipboard.writeText(full);
              showToast({ success: true, text: t('copied') });
            } catch (e) { /* ignore */ }
          });
          resultBox.appendChild(copyBtn);
        }
        // Refrescar metadatos (el toast persistente está aparte)
        setTimeout(requestWidgets, 80);
      });
    }

    form.querySelector('[data-role="exec"]').addEventListener('click', execForm);
    // Enter en los inputs ejecuta el formulario
    inputs.forEach(inp => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); execForm(); }
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
        <button class="pfi-back-btn" id="pfi-config-back" title="${escAttr(t('back'))}">←</button>
        <span class="pfi-detail-title">⚙ ${escHtml(t('cfgTitle'))}</span>
      </div>
      <div class="pfi-config-body">

        <div class="pfi-config-item">
          <div>
            <span class="pfi-config-label">${escHtml(t('cfgLanguage'))}</span>
            <div class="pfi-desc">EN / ES</div>
          </div>
          <select id="pfi-cfg-language" class="pfi-select-mini">
            <option value="auto" ${config.language === 'auto' ? 'selected' : ''}>${escHtml(t('cfgLangAuto'))}</option>
            <option value="en" ${config.language === 'en' ? 'selected' : ''}>${escHtml(t('cfgLangEn'))}</option>
            <option value="es" ${config.language === 'es' ? 'selected' : ''}>${escHtml(t('cfgLangEs'))}</option>
          </select>
        </div>

        <div class="pfi-config-item">
          <div>
            <span class="pfi-config-label">${escHtml(t('cfgTheme'))}</span>
            <div class="pfi-desc">${escHtml(t('cfgThemeDesc'))}</div>
          </div>
          <label class="pfi-toggle" for="pfi-cfg-theme">
            <input type="checkbox" id="pfi-cfg-theme" ${config.theme === 'light' ? 'checked' : ''}>
            <span class="pfi-slider"></span>
          </label>
        </div>

        <div class="pfi-config-item">
          <div>
            <span class="pfi-config-label">${escHtml(t('cfgUpdates'))}</span>
            <div class="pfi-desc">${escHtml(t('cfgUpdatesDesc'))}</div>
          </div>
          <label class="pfi-toggle" for="pfi-cfg-updates">
            <input type="checkbox" id="pfi-cfg-updates" ${config.highlightUpdates ? 'checked' : ''}>
            <span class="pfi-slider"></span>
          </label>
        </div>
        <div class="pfi-config-item pfi-config-color">
          <div>
            <span class="pfi-config-label">${escHtml(t('cfgColorUpdate'))}</span>
          </div>
          <input type="color" id="pfi-cfg-color-update" value="${escAttr(config.colorUpdate)}">
        </div>

        <div class="pfi-config-item">
          <div>
            <span class="pfi-config-label">${escHtml(t('cfgProcess'))}</span>
            <div class="pfi-desc">${escHtml(t('cfgProcessDesc'))}</div>
          </div>
          <label class="pfi-toggle" for="pfi-cfg-process">
            <input type="checkbox" id="pfi-cfg-process" ${config.highlightProcess ? 'checked' : ''}>
            <span class="pfi-slider"></span>
          </label>
        </div>
        <div class="pfi-config-item pfi-config-color">
          <div>
            <span class="pfi-config-label">${escHtml(t('cfgColorProcess'))}</span>
          </div>
          <input type="color" id="pfi-cfg-color-process" value="${escAttr(config.colorProcess)}">
        </div>

        <div class="pfi-config-item">
          <button type="button" class="pfi-link-btn" id="pfi-cfg-reset-colors">↺ ${escHtml(t('cfgReset'))}</button>
        </div>

        <div class="pfi-config-item">
          <div>
            <span class="pfi-config-label">${escHtml(t('cfgShowJquery'))}</span>
            <div class="pfi-desc">${escHtml(t('cfgShowJqueryDesc'))}</div>
          </div>
          <label class="pfi-toggle" for="pfi-cfg-jquery">
            <input type="checkbox" id="pfi-cfg-jquery" ${config.showJqueryEvents ? 'checked' : ''}>
            <span class="pfi-slider"></span>
          </label>
        </div>

        <div class="pfi-config-item">
          <div>
            <span class="pfi-config-label">${escHtml(t('cfgPersist'))}</span>
            <div class="pfi-desc">${escHtml(t('cfgPersistDesc'))}</div>
          </div>
          <label class="pfi-toggle" for="pfi-cfg-persist">
            <input type="checkbox" id="pfi-cfg-persist" ${config.persistPanel ? 'checked' : ''}>
            <span class="pfi-slider"></span>
          </label>
        </div>

        <div class="pfi-about">
          <div class="pfi-about-title">${escHtml(t('cfgAbout'))}</div>
          <div class="pfi-about-row">
            <span>${escHtml(t('cfgVersion'))}</span>
            <span class="pfi-about-value">${escHtml(EXT_VERSION)}</span>
          </div>
          <div class="pfi-about-row">
            <span>${escHtml(t('cfgRepo'))}</span>
            <a class="pfi-about-link" id="pfi-about-link" href="${escAttr(GITHUB_URL)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </div>
        </div>

      </div>
    `;

    panelEl.appendChild(overlay);

    overlay.querySelector('#pfi-config-back').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#pfi-cfg-language').addEventListener('change', (e) => {
      config.language = e.target.value;
      saveConfig();
      // Recargar todo el panel para que tome el idioma nuevo
      const wasOpenDetail = config.detailWidgetVar;
      destroyPanel();
      createPanel();
      // El detalle se restaurará automáticamente cuando lleguen los datos
      config.detailWidgetVar = wasOpenDetail;
      saveConfig();
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
    overlay.querySelector('#pfi-cfg-jquery').addEventListener('change', (e) => {
      config.showJqueryEvents = e.target.checked;
      saveConfig();
      // Recargar los widgets para incluir/quitar eventos jQuery
      requestWidgets();
    });
    overlay.querySelector('#pfi-cfg-color-update').addEventListener('input', (e) => {
      config.colorUpdate = e.target.value;
      applyDynamicColors();
      saveConfig();
    });
    overlay.querySelector('#pfi-cfg-color-process').addEventListener('input', (e) => {
      config.colorProcess = e.target.value;
      applyDynamicColors();
      saveConfig();
    });
    overlay.querySelector('#pfi-cfg-reset-colors').addEventListener('click', () => {
      config.colorUpdate = DEFAULT_COLOR_UPDATE;
      config.colorProcess = DEFAULT_COLOR_PROCESS;
      overlay.querySelector('#pfi-cfg-color-update').value = DEFAULT_COLOR_UPDATE;
      overlay.querySelector('#pfi-cfg-color-process').value = DEFAULT_COLOR_PROCESS;
      applyDynamicColors();
      saveConfig();
    });
  }

  function destroyPanel() {
    if (selectionMode) deactivateSelectionMode();
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }
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
    if (str === null || str === undefined) return '';
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
    if (msg && msg.action === 'togglePanel') {
      if (panelEl && panelEl.style.display !== 'none') {
        closePanel();
      } else {
        createPanel();
      }
      sendResponse({ ok: true });
    }
    return true;
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
