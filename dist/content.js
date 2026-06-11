(() => {
  // src/content/core/config.js
  var DEFAULT_COLOR_UPDATE = "#ff00aa";
  var DEFAULT_COLOR_PROCESS = "#00c850";
  var config = {
    highlightUpdates: true,
    highlightProcess: true,
    colorUpdate: DEFAULT_COLOR_UPDATE,
    colorProcess: DEFAULT_COLOR_PROCESS,
    theme: "dark",
    persistPanel: true,
    panelOpen: false,
    detailWidgetVar: null,
    language: "auto",
    showJqueryEvents: false
  };
  function loadConfig(cb) {
    try {
      chrome.storage.local.get(["pfInspectorConfig"], (result) => {
        if (result.pfInspectorConfig) {
          Object.assign(config, result.pfInspectorConfig);
        }
        if (typeof cb === "function") cb();
      });
    } catch (e) {
      if (typeof cb === "function") cb();
    }
  }
  function saveConfig() {
    try {
      chrome.storage.local.set({ pfInspectorConfig: config });
    } catch (e) {
    }
  }
  function hexToRgb(hex) {
    if (!hex) return { r: 255, g: 0, b: 170 };
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const num = parseInt(h, 16);
    if (isNaN(num)) return { r: 255, g: 0, b: 170 };
    return { r: num >> 16 & 255, g: num >> 8 & 255, b: num & 255 };
  }
  function applyDynamicColors() {
    let style = document.getElementById("pf-inspector-dynamic-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "pf-inspector-dynamic-style";
      (document.head || document.documentElement).appendChild(style);
    }
    const u = hexToRgb(config.colorUpdate);
    const p = hexToRgb(config.colorProcess);
    style.textContent = `
@keyframes pfi-flash-update-dyn {
  0%   { background-color: rgba(${u.r},${u.g},${u.b},.20); box-shadow: inset 0 0 0 2px rgba(${u.r},${u.g},${u.b},.85); }
  100% { background-color: transparent; box-shadow: inset 0 0 0 2px transparent; }
}
.pfi-highlight-update { animation: pfi-flash-update-dyn .8s ease-out forwards !important; }
@keyframes pfi-flash-process-dyn {
  0%   { background-color: rgba(${p.r},${p.g},${p.b},.20); box-shadow: inset 0 0 0 2px rgba(${p.r},${p.g},${p.b},.85); }
  100% { background-color: transparent; box-shadow: inset 0 0 0 2px transparent; }
}
.pfi-highlight-process { animation: pfi-flash-process-dyn .8s ease-out forwards !important; }
  `;
  }

  // src/content/core/state.js
  var state = {
    panelEl: null,
    widgetsData: [],
    pageInfo: {
      hasPrimeFaces: false,
      version: null,
      hasPrimeFacesExt: false,
      versionExt: null,
      hasJQuery: false,
      widgetCount: 0
    },
    filteredData: [],
    searchTerm: "",
    selectedTypes: /* @__PURE__ */ new Set(),
    currentHighlight: null,
    currentTargetHighlight: null,
    eventRowHighlights: [],
    selectionMode: false,
    ctrlShiftFired: false,
    callSeq: 0,
    pendingResultCallbacks: /* @__PURE__ */ new Map()
  };

  // src/content/core/highlights.js
  function clearHighlight() {
    if (state.currentHighlight) {
      state.currentHighlight.classList.remove("pfi-highlight-hover");
      state.currentHighlight = null;
    }
  }
  function highlightElement(id) {
    clearHighlight();
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("pfi-highlight-hover");
      state.currentHighlight = el;
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  function clearTargetHighlight() {
    if (state.currentTargetHighlight) {
      state.currentTargetHighlight.classList.remove("pfi-highlight-target");
      state.currentTargetHighlight = null;
    }
  }
  function highlightTarget(id) {
    clearTargetHighlight();
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("pfi-highlight-target");
      state.currentTargetHighlight = el;
    }
  }
  function highlightEventRow(value) {
    clearEventRowHighlights();
    if (!value) return;
    const ids = String(value).split(/[\s,;]+/);
    ids.forEach((rawId) => {
      const id = rawId && rawId.trim();
      if (!id || id.startsWith("@")) return;
      const el = document.getElementById(id);
      if (el) {
        el.classList.add("pfi-highlight-target");
        state.eventRowHighlights.push(el);
      }
    });
    if (state.eventRowHighlights.length > 0) {
      state.eventRowHighlights[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  function clearEventRowHighlights() {
    state.eventRowHighlights.forEach((el) => el.classList.remove("pfi-highlight-target"));
    state.eventRowHighlights = [];
  }
  function flashElement(el, className, durationMs) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), durationMs || 800);
  }
  function handleAjaxProcess(data) {
    if (!config.highlightProcess || !data) return;
    const ids = (data.process || "").split(/\s+/);
    ids.forEach((id) => {
      if (id.startsWith("@")) return;
      const el = document.getElementById(id);
      if (el) flashElement(el, "pfi-highlight-process", 800);
    });
  }
  function handleAjaxUpdate(updatedIds) {
    if (!config.highlightUpdates || !Array.isArray(updatedIds)) return;
    updatedIds.forEach((id) => {
      if (id === "javax.faces.ViewState" || id === "javax.faces.ViewRoot") return;
      const el = document.getElementById(id);
      if (el) flashElement(el, "pfi-highlight-update", 800);
    });
  }

  // src/content/core/messaging.js
  function requestWidgets() {
    window.postMessage({ type: "PF_INSPECTOR_COLLECT", showJqueryEvents: !!config.showJqueryEvents }, "*");
  }
  function executeWidgetAction(widgetVar, method, args, callback) {
    const callId = "c" + ++state.callSeq;
    if (typeof callback === "function") {
      state.pendingResultCallbacks.set(callId, callback);
      setTimeout(() => state.pendingResultCallbacks.delete(callId), 1e4);
    }
    window.postMessage({
      type: "PF_INSPECTOR_EXEC_API",
      widgetVar,
      method,
      args: Array.isArray(args) ? args : [],
      callId
    }, "*");
  }
  function executeInlineEvent(ownerId, eventAttr, widgetVar) {
    window.postMessage({ type: "PF_INSPECTOR_EXEC_EVENT", ownerId, eventAttr, widgetVar }, "*");
  }
  function injectPageScript() {
    if (document.getElementById("pf-inspector-page-script")) return;
    const s = document.createElement("script");
    s.id = "pf-inspector-page-script";
    s.src = chrome.runtime.getURL("dist/inject/pageScript.js");
    (document.head || document.documentElement).appendChild(s);
  }

  // src/i18n/en.js
  var en_default = {
    title: "PrimeFaces Inspector",
    searchPlaceholder: "Search widgetVar, id, type\u2026",
    filterAll: "All types",
    filterMulti: "{0} selected",
    filterButton: "Filter",
    filterClear: "Clear",
    noWidgets: "No PrimeFaces widgets found.",
    pfNotDetected: "PrimeFaces not detected on this page.",
    pfDetected: "PrimeFaces {0}",
    pfExtDetected: "PF Extensions {0}",
    pfExtNotDetected: "PF Extensions not detected.",
    jqueryMissing: "(jQuery not found)",
    btnSelect: "Selection mode (Ctrl+Shift)",
    btnConfig: "Settings",
    btnRefresh: "Refresh",
    btnClose: "Close",
    back: "Back",
    expand: "Expand",
    collapse: "Collapse",
    sectionInfo: "General information",
    sectionMetadata: "Metadata",
    sectionTarget: "Target",
    sectionClientApi: "Client API",
    sectionEvents: "Events",
    eventsEmpty: "No events detected.",
    eventsJqueryDisabled: "jQuery events disabled in settings.",
    btnExecEvent: "Execute this event",
    labelWidgetVar: "widgetVar",
    labelId: "ID",
    labelType: "Type",
    labelTargetId: "Target ID",
    thLetter: "Key",
    thMeaning: "Meaning",
    thDescription: "Description",
    thValue: "Value",
    sourceInline: "inline",
    sourceJquery: "jQuery",
    execOk: "\u2713 PF('{0}').{1}() executed",
    execOkResult: "\u2713 PF('{0}').{1}() \u2192 {2}",
    execErr: "\u2717 Error: {0}",
    openConfig: "Open settings",
    disabledAlready: "widget is already disabled",
    enabledAlready: "widget is already enabled",
    shownAlready: "widget is already visible",
    hiddenAlready: "widget is already hidden",
    viewFull: "View full",
    resultTitle: "Result",
    copyResult: "Copy",
    copied: "Copied to clipboard",
    apiOpenForm: "Open form for {0}() \u2014 {1} arg(s)",
    argPlaceholder: "e.g. 2, 'text', true, [1,2]",
    argHint: "Valid JSON or plain text. Empty = skip argument.",
    btnExec: "Execute",
    btnCancel: "Cancel",
    executing: "Executing\u2026",
    returnedValue: "Returned value",
    cfgTitle: "Settings",
    cfgSectionAppearance: "Appearance",
    cfgSectionAjax: "Ajax Monitoring",
    cfgSectionBehavior: "Behavior",
    cfgSectionAbout: "About",
    cfgTheme: "Light theme",
    cfgThemeDesc: "Switch between dark and light mode.",
    cfgUpdates: "Highlight Updates",
    cfgUpdatesDesc: "Flash elements updated by an Ajax response.",
    cfgProcess: "Highlight Process",
    cfgProcessDesc: "Flash elements processed by PrimeFaces.ab().",
    cfgColorUpdate: "Update color",
    cfgColorProcess: "Process color",
    cfgPersist: "Persist panel",
    cfgPersistDesc: "Keep the panel open across page navigation.",
    cfgShowJquery: "Show jQuery events",
    cfgShowJqueryDesc: "Display events bound via jQuery in the widget detail.",
    cfgLanguage: "Language",
    cfgLangAuto: "Auto (browser)",
    cfgLangEn: "English",
    cfgLangEs: "Spanish",
    cfgAbout: "About",
    cfgVersion: "Version",
    cfgRepo: "Repository",
    cfgReset: "Reset colors"
  };

  // src/i18n/es.js
  var es_default = {
    title: "PrimeFaces Inspector",
    searchPlaceholder: "Buscar widgetVar, id, tipo\u2026",
    filterAll: "Todos los tipos",
    filterMulti: "{0} seleccionados",
    filterButton: "Filtro",
    filterClear: "Limpiar",
    noWidgets: "No se encontraron widgets de PrimeFaces.",
    pfNotDetected: "PrimeFaces no detectado en esta p\xE1gina.",
    pfDetected: "PrimeFaces {0}",
    pfExtDetected: "PF Extensions {0}",
    pfExtNotDetected: "PF Extensions no detectado.",
    jqueryMissing: "(jQuery no encontrado)",
    btnSelect: "Modo selecci\xF3n (Ctrl+Shift)",
    btnConfig: "Configuraci\xF3n",
    btnRefresh: "Actualizar",
    btnClose: "Cerrar",
    back: "Volver",
    expand: "Expandir",
    collapse: "Contraer",
    sectionInfo: "Informaci\xF3n general",
    sectionMetadata: "Metadatos",
    sectionTarget: "Target",
    sectionClientApi: "Client API",
    sectionEvents: "Eventos",
    eventsEmpty: "Sin eventos detectados.",
    eventsJqueryDisabled: "Eventos jQuery desactivados en la configuraci\xF3n.",
    btnExecEvent: "Ejecutar este evento",
    labelWidgetVar: "widgetVar",
    labelId: "ID",
    labelType: "Tipo",
    labelTargetId: "Target ID",
    thLetter: "Letra",
    thMeaning: "Significado",
    thDescription: "Descripci\xF3n",
    thValue: "Valor",
    sourceInline: "inline",
    sourceJquery: "jQuery",
    execOk: "\u2713 PF('{0}').{1}() ejecutado",
    execOkResult: "\u2713 PF('{0}').{1}() \u2192 {2}",
    execErr: "\u2717 Error: {0}",
    openConfig: "Abrir configuraci\xF3n",
    disabledAlready: "el widget ya est\xE1 deshabilitado",
    enabledAlready: "el widget ya est\xE1 habilitado",
    shownAlready: "el widget ya es visible",
    hiddenAlready: "el widget ya est\xE1 oculto",
    viewFull: "Ver completo",
    resultTitle: "Resultado",
    copyResult: "Copiar",
    copied: "Copiado al portapapeles",
    apiOpenForm: "Abrir formulario para {0}() \u2014 {1} argumento(s)",
    argPlaceholder: "p.ej. 2, 'texto', true, [1,2]",
    argHint: "JSON v\xE1lido o texto plano. Vac\xEDo = omitir argumento.",
    btnExec: "Ejecutar",
    btnCancel: "Cancelar",
    executing: "Ejecutando\u2026",
    returnedValue: "Valor devuelto",
    cfgTitle: "Configuraci\xF3n",
    cfgSectionAppearance: "Apariencia",
    cfgSectionAjax: "Monitoreo Ajax",
    cfgSectionBehavior: "Comportamiento",
    cfgSectionAbout: "Acerca de",
    cfgTheme: "Tema claro",
    cfgThemeDesc: "Cambiar entre modo oscuro y claro.",
    cfgUpdates: "Highlight Actualizaciones",
    cfgUpdatesDesc: "Resaltar elementos actualizados por respuesta Ajax.",
    cfgProcess: "Highlight Process",
    cfgProcessDesc: "Resaltar elementos procesados al llamar PrimeFaces.ab().",
    cfgColorUpdate: "Color de actualizaci\xF3n",
    cfgColorProcess: "Color de process",
    cfgPersist: "Persistir panel",
    cfgPersistDesc: "Mantener el panel abierto al navegar entre p\xE1ginas.",
    cfgShowJquery: "Mostrar eventos jQuery",
    cfgShowJqueryDesc: "Mostrar en el detalle del widget los eventos enlazados con jQuery.",
    cfgLanguage: "Idioma",
    cfgLangAuto: "Auto (navegador)",
    cfgLangEn: "Ingl\xE9s",
    cfgLangEs: "Espa\xF1ol",
    cfgAbout: "Acerca de",
    cfgVersion: "Versi\xF3n",
    cfgRepo: "Repositorio",
    cfgReset: "Restablecer colores"
  };

  // src/content/core/i18n.js
  var I18N = { en: en_default, es: es_default };
  function resolveLang() {
    const cfg = config.language;
    if (cfg === "en" || cfg === "es") return cfg;
    const nav = (navigator.language || "en").toLowerCase();
    return nav.startsWith("es") ? "es" : "en";
  }
  function t(key, ...args) {
    const lang = resolveLang();
    const dict = I18N[lang] || I18N.en || {};
    const fallback = I18N.en || {};
    let s = dict[key] !== void 0 ? dict[key] : fallback[key] !== void 0 ? fallback[key] : key;
    args.forEach((v, i) => {
      s = s.replace("{" + i + "}", v);
    });
    return s;
  }

  // src/content/ui/icons.js
  var ATTRS = `fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;
  function svg(size, content) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ${ATTRS} aria-hidden="true">${content}</svg>`;
  }
  var PATHS = {
    /* ── Iconos de interfaz ── */
    "x": '<path d="M6 18 18 6M6 6l12 12"/>',
    "chevron-right": '<path d="m8.25 4.5 7.5 7.5-7.5 7.5"/>',
    "arrow-left": '<path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/>',
    "play": '<path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/>',
    "terminal": '<path d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"/>',
    "search": '<path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>',
    "filter": '<path d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"/>',
    "maximize-2": '<path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/>',
    "copy": '<path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"/>',
    "crosshair": '<path d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>',
    "rotate-ccw": '<path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>',
    "settings": '<path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>',
    "globe": '<path d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"/>',
    "sun": '<path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/>',
    "moon": '<path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/>',
    "zap": '<path d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/>',
    "bookmark": '<path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/>',
    "info": '<path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/>',
    "github": '<path stroke-width="2" d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
    "alert-triangle": '<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>',
    "check-circle": '<path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
    "check": '<path d="m4.5 12.75 6 6 9-13.5"/>',
    /* ── Iconos de categoría de componente ── */
    "table-cells": '<path d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"/>',
    "cursor-rays": '<path d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59"/>',
    "window": '<path d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6ZM7.5 6h.008v.008H7.5V6Zm2.25 0h.008v.008H9.75V6Z"/>',
    "squares": '<path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"/>',
    "pencil-square": '<path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/>',
    "calculator": '<path d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z"/>',
    "calendar": '<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"/>',
    "clock": '<path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
    "chevron-updown": '<path d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"/>',
    "upload": '<path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>',
    "queue-list": '<path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/>',
    "bars": '<path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>',
    "bell": '<path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/>',
    "chart-bar": '<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>',
    "chart-pie": '<path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"/><path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"/>',
    "photo": '<path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/>',
    "star": '<path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/>',
    "swatch": '<path d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z"/>',
    "arrows-lr": '<path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/>',
    "arrows-ud": '<path d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"/>',
    "ellipsis": '<path d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/>',
    "lock": '<path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/>',
    "cube": '<path d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>',
    "rectangle-stack": '<path d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122"/>',
    "list-bullet": '<path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/>',
    "document-text": '<path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>',
    "hashtag": '<path d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5"/>',
    "adjustments": '<path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/>',
    "chat": '<path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"/>'
  };
  function icon(name, size = 14) {
    return svg(size, PATHS[name] || PATHS["x"]);
  }
  var COMPONENT_ICON_MAP = {
    DataTable: "table-cells",
    CommandButton: "cursor-rays",
    CommandLink: "cursor-rays",
    Dialog: "window",
    Panel: "squares",
    TabView: "rectangle-stack",
    InputNumber: "calculator",
    InputMask: "pencil-square",
    InputText: "pencil-square",
    InputTextarea: "document-text",
    Calendar: "calendar",
    DatePicker: "calendar",
    TimePicker: "clock",
    SelectOneMenu: "chevron-updown",
    SelectBooleanCheckbox: "check-circle",
    SelectManyCheckbox: "check-circle",
    AutoComplete: "search",
    FileUpload: "upload",
    Tree: "list-bullet",
    TreeTable: "table-cells",
    AccordionPanel: "rectangle-stack",
    Menu: "bars",
    Menubar: "bars",
    ContextMenu: "bars",
    Growl: "bell",
    Messages: "chat",
    Message: "chat",
    OverlayPanel: "window",
    Tooltip: "chat",
    ProgressBar: "chart-bar",
    Chart: "chart-pie",
    Schedule: "calendar",
    Carousel: "photo",
    Galleria: "photo",
    Editor: "pencil-square",
    Spinner: "calculator",
    Slider: "adjustments",
    Rating: "star",
    ColorPicker: "swatch",
    Chips: "hashtag",
    PickList: "arrows-lr",
    OrderList: "arrows-ud",
    DataList: "list-bullet",
    DataGrid: "squares",
    DataScroller: "queue-list",
    Paginator: "ellipsis",
    Fieldset: "squares",
    ConfirmDialog: "window",
    Sidebar: "window",
    Inplace: "pencil-square",
    BlockUI: "lock",
    Poll: "rotate-ccw",
    RemoteCommand: "zap",
    OutputPanel: "squares",
    AjaxStatus: "rotate-ccw",
    Fragment: "cube",
    Default: "cube"
  };
  var ICON_KEYS = Object.keys(COMPONENT_ICON_MAP).filter((k) => k !== "Default").sort((a, b) => b.length - a.length);
  function getComponentIcon(type, size = 18) {
    if (!type) return icon(COMPONENT_ICON_MAP.Default, size);
    const low = type.toLowerCase();
    for (const key of ICON_KEYS) {
      if (low.includes(key.toLowerCase())) return icon(COMPONENT_ICON_MAP[key], size);
    }
    return icon(COMPONENT_ICON_MAP.Default, size);
  }
  var ACTION_ICON_MAP = {
    clear: "rotate-ccw",
    close: "x",
    show: "check",
    hide: "x",
    toggle: "check",
    enable: "check",
    disable: "x",
    focus: "crosshair",
    open: "play",
    expand: "play",
    collapse: "x",
    reset: "rotate-ccw",
    reload: "rotate-ccw",
    play: "play",
    stop: "x",
    pause: "x"
  };
  function getActionIcon(name) {
    if (ACTION_ICON_MAP[name]) return icon(ACTION_ICON_MAP[name], 12);
    const low = name.toLowerCase();
    if (low.startsWith("show") || low.startsWith("enable") || low.startsWith("open") || low.startsWith("expand") || low.startsWith("start") || low.startsWith("play")) return icon("play", 12);
    if (low.startsWith("hide") || low.startsWith("disable") || low.startsWith("close") || low.startsWith("collapse") || low.startsWith("stop")) return icon("x", 12);
    if (low.startsWith("clear") || low.startsWith("reset") || low.startsWith("refresh") || low.startsWith("reload")) return icon("rotate-ccw", 12);
    if (low.startsWith("toggle")) return icon("check", 12);
    if (low.startsWith("focus")) return icon("crosshair", 12);
    if (low.startsWith("select")) return icon("check", 12);
    return icon("play", 12);
  }

  // src/content/ui/utils.js
  function escHtml(str) {
    if (str === null || str === void 0) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escAttr(str) {
    return escHtml(str);
  }
  function cssEsc(str) {
    if (window.CSS && CSS.escape) return CSS.escape(str);
    return String(str).replace(/"/g, '\\"');
  }

  // src/content/ui/infobar.js
  function renderHeaderInfo() {
    const bar = state.panelEl && state.panelEl.querySelector("#pfi-info-bar");
    if (!bar) return;
    if (!state.pageInfo.hasPrimeFaces) {
      bar.className = "pfi-info-bar pfi-info-warn";
      bar.innerHTML = `
      <span class="pfi-info-icon">${icon("alert-triangle", 12)}</span>
      <span>${escHtml(t("pfNotDetected"))}</span>
    `;
      return;
    }
    const versionTxt = state.pageInfo.version || "?";
    const lines = [`<span class="pfi-info-main">${escHtml(t("pfDetected", versionTxt))}</span>`];
    if (state.pageInfo.hasPrimeFacesExt) {
      lines.push(`<span class="pfi-info-sub">${escHtml(t("pfExtDetected", state.pageInfo.versionExt || "?"))}</span>`);
    } else {
      lines.push(`<span class="pfi-info-sub pfi-info-muted">${escHtml(t("pfExtNotDetected"))}</span>`);
    }
    if (!state.pageInfo.hasJQuery) {
      lines.push(`<span class="pfi-info-sub pfi-info-warn-text">${escHtml(t("jqueryMissing"))}</span>`);
    }
    bar.className = "pfi-info-bar pfi-info-ok";
    bar.innerHTML = `
    <span class="pfi-info-icon">${icon("check-circle", 12)}</span>
    <div class="pfi-info-lines">${lines.join("")}</div>
  `;
  }

  // src/content/ui/client-api-form.js
  function openApiArgForm(host, triggerBtn, widgetVar, method, arity, callbacks) {
    if (!host) return;
    const { executeWidgetAction: executeWidgetAction2, showToast: showToast2, showResultModal: showResultModal2 } = callbacks;
    const existing = host.querySelector(".pfi-api-form");
    const sameMethod = existing && existing.getAttribute("data-method") === method && existing.getAttribute("data-wvar") === widgetVar;
    host.innerHTML = "";
    host.parentElement.querySelectorAll(".pfi-api-method-btn.pfi-api-method-active").forEach((b) => b.classList.remove("pfi-api-method-active"));
    if (sameMethod) return;
    if (triggerBtn) triggerBtn.classList.add("pfi-api-method-active");
    const argCount = Math.max(arity, 1);
    const argRowsHtml = Array.from({ length: argCount }, (_, i) => `
    <div class="pfi-arg-row">
      <label class="pfi-arg-label">arg ${i + 1}</label>
      <input type="text" class="pfi-arg-input"
        data-arg-index="${i}"
        placeholder="${escAttr(t("argPlaceholder"))}"
        spellcheck="false"
        autocomplete="off">
    </div>
  `).join("");
    const form = document.createElement("div");
    form.className = "pfi-api-form";
    form.setAttribute("data-method", method);
    form.setAttribute("data-wvar", widgetVar);
    form.innerHTML = `
    <div class="pfi-api-form-header">
      <span class="pfi-api-form-title">PF('${escHtml(widgetVar)}').${escHtml(method)}(\u2026)</span>
      <button type="button" class="pfi-icon-btn" data-role="close" title="${escAttr(t("btnCancel"))}">${icon("x", 13)}</button>
    </div>
    <div class="pfi-api-form-hint">${escHtml(t("argHint"))}</div>
    <div class="pfi-api-form-body">${argRowsHtml}</div>
    <div class="pfi-api-form-footer">
      <button type="button" class="pfi-exec-btn" data-role="exec">${icon("play", 13)} ${escHtml(t("btnExec"))}</button>
    </div>
    <div class="pfi-api-result" data-role="result" hidden></div>
  `;
    host.appendChild(form);
    const resultBox = form.querySelector('[data-role="result"]');
    const inputs = Array.from(form.querySelectorAll(".pfi-arg-input"));
    form.querySelector('[data-role="close"]').addEventListener("click", () => {
      host.innerHTML = "";
      if (triggerBtn) triggerBtn.classList.remove("pfi-api-method-active");
    });
    setTimeout(() => {
      if (inputs[0]) inputs[0].focus();
    }, 50);
    function execForm() {
      const args = inputs.map((inp) => {
        if (inp.value === "") return void 0;
        try {
          return JSON.parse(inp.value);
        } catch (e) {
          return inp.value;
        }
      });
      while (args.length > 0 && args[args.length - 1] === void 0) args.pop();
      resultBox.hidden = false;
      resultBox.className = "pfi-api-result pfi-api-result-pending";
      resultBox.textContent = t("executing");
      executeWidgetAction2(widgetVar, method, args, (data) => {
        if (!data.success) {
          resultBox.className = "pfi-api-result pfi-api-result-err";
          resultBox.textContent = data.error || "";
          return;
        }
        resultBox.className = "pfi-api-result pfi-api-result-ok";
        if (!data.hasResult) {
          resultBox.textContent = t("execOk", data.widgetVar, data.method);
        } else {
          const full = String(data.result == null ? "" : data.result);
          resultBox.innerHTML = "";
          const header = document.createElement("div");
          header.className = "pfi-api-result-header";
          header.textContent = t("returnedValue") + ":";
          resultBox.appendChild(header);
          const pre = document.createElement("pre");
          pre.className = "pfi-result-pre";
          pre.textContent = full;
          resultBox.appendChild(pre);
          const actions = document.createElement("div");
          actions.className = "pfi-api-result-actions";
          if (full.length > 200) {
            const expandBtn = document.createElement("button");
            expandBtn.className = "pfi-ghost-btn";
            expandBtn.innerHTML = icon("maximize-2", 12) + " " + escHtml(t("viewFull"));
            expandBtn.addEventListener("click", () => {
              showResultModal2("PF('" + widgetVar + "')." + method + "()", full);
            });
            actions.appendChild(expandBtn);
          }
          const copyBtn = document.createElement("button");
          copyBtn.className = "pfi-ghost-btn";
          copyBtn.innerHTML = icon("copy", 12) + " " + escHtml(t("copyResult"));
          copyBtn.addEventListener("click", () => {
            try {
              navigator.clipboard.writeText(full);
              showToast2({ success: true, text: t("copied") });
            } catch (e) {
            }
          });
          actions.appendChild(copyBtn);
          resultBox.appendChild(actions);
        }
      });
    }
    form.querySelector('[data-role="exec"]').addEventListener("click", execForm);
    inputs.forEach((inp) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          execForm();
        }
      });
    });
  }

  // src/content/ui/widget-detail.js
  function getActionsForType(type) {
    const actions = [];
    if (!type) return actions;
    const ty = type.toLowerCase();
    if (ty.includes("autocomplete")) actions.push("clear", "close");
    if (ty.includes("confirmdialog") || ty.includes("dialog") || ty.includes("overlaypanel")) actions.push("show", "hide");
    if (ty.includes("sidebar")) actions.push("show", "hide", "toggle");
    return actions;
  }
  function isActionIncompatible(name, md, isAutoComplete) {
    const n = String(name);
    if (md.disabled === true && n === "disable") return t("disabledAlready");
    if (md.disabled === false && n === "enable") return t("enabledAlready");
    if (!isAutoComplete && md.visible === true && (n === "show" || n === "showAll" || n === "open")) return t("shownAlready");
    if (md.visible === false && (n === "hide" || n === "hideAll" || n === "close")) return t("hiddenAlready");
    return null;
  }
  function renderDetailHtml(w) {
    let eventsHtml = "";
    if (w.events && w.events.length > 0) {
      eventsHtml = w.events.map((ev) => {
        let paramsHtml = "";
        if (ev.parsedParams && ev.parsedParams.length > 0) {
          paramsHtml = `
          <table class="pfi-param-table">
            <thead><tr>
              <th>${escHtml(t("thLetter"))}</th><th>${escHtml(t("thMeaning"))}</th>
              <th>${escHtml(t("thDescription"))}</th><th>${escHtml(t("thValue"))}</th>
            </tr></thead>
            <tbody>
              ${ev.parsedParams.map((p) => `
                <tr class="pfi-event-row" data-value="${escAttr(p.value || "")}">
                  <td>${escHtml(p.letter)}</td><td>${escHtml(p.name)}</td>
                  <td class="pfi-param-desc">${escHtml(p.desc)}</td>
                  <td>${escHtml(p.value || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`;
        }
        const srcLabel = ev.source === "jquery" ? t("sourceJquery") : t("sourceInline");
        let execBtn = "";
        if (ev.source === "inline" && ev.ownerId) {
          execBtn = `<button class="pfi-event-exec-btn" data-owner-id="${escAttr(ev.ownerId)}"
          data-event-attr="${escAttr(ev.event)}" data-wvar="${escAttr(w.widgetVar)}"
          title="${escAttr(t("btnExecEvent"))}">${icon("play", 11)}</button>`;
        }
        const ownerInfo = ev.ownerId && ev.ownerId !== w.id ? `<div class="pfi-event-owner">\u21B3 ${escHtml(ev.ownerId)}</div>` : "";
        return `
        <div class="pfi-event-block">
          <div class="pfi-event-head">
            <span class="pfi-event-name">${escHtml(ev.event)}</span>
            <span class="pfi-event-badge pfi-event-badge-${escAttr(ev.source || "inline")}">${escHtml(srcLabel)}</span>
            ${execBtn}
          </div>
          ${ownerInfo}
          <div class="pfi-event-raw">${escHtml(ev.raw)}</div>
          ${paramsHtml}
        </div>`;
      }).join("");
    } else {
      const hint = !config.showJqueryEvents ? `<div class="pfi-hint pfi-hint-clickable" data-role="open-config">${escHtml(t("eventsJqueryDisabled"))}</div>` : "";
      eventsHtml = `<div class="pfi-events-empty">${escHtml(t("eventsEmpty"))}</div>${hint}`;
    }
    let targetHtml = "";
    if (w.targetId) {
      targetHtml = `
      <div class="pfi-detail-section">
        <h4>${escHtml(t("sectionTarget"))}</h4>
        <div class="pfi-detail-row">
          <span class="pfi-detail-label">${escHtml(t("labelTargetId"))}</span>
          <span class="pfi-detail-value pfi-target-link" data-target-id="${escAttr(w.targetId)}">${escHtml(w.targetId)}</span>
        </div>
      </div>`;
    }
    const featured = getActionsForType(w.type);
    const normalizedApi = (w.clientAPI || []).map(
      (m) => typeof m === "string" ? { name: m, arity: 0, callable: true } : m
    );
    const seenAct = /* @__PURE__ */ new Set();
    const callableMethods = [];
    featured.forEach((name) => {
      if (!seenAct.has(name)) {
        seenAct.add(name);
        callableMethods.push(name);
      }
    });
    normalizedApi.forEach((m) => {
      if (m.callable && !seenAct.has(m.name)) {
        seenAct.add(m.name);
        callableMethods.push(m.name);
      }
    });
    const nonCallable = normalizedApi.filter((m) => !m.callable);
    const md = w.metadata || {};
    const isAutoComplete = w.type && w.type.toLowerCase().includes("autocomplete");
    let clientApiHtml = "";
    if (callableMethods.length > 0 || nonCallable.length > 0) {
      const callableGroup = callableMethods.length > 0 ? `
      <div class="pfi-actions-grid">
        ${callableMethods.map((name) => {
        const reason = isActionIncompatible(name, md, isAutoComplete);
        const tooltip = "PF('" + w.widgetVar + "')." + name + "()" + (reason ? " \u2014 " + reason : "");
        const disabled = reason ? ' disabled aria-disabled="true"' : "";
        const cls = reason ? " pfi-action-btn-disabled" : "";
        return `<button class="pfi-action-btn${cls}" data-action="${escAttr(name)}" data-wvar="${escAttr(w.widgetVar)}" title="${escAttr(tooltip)}"${disabled}>
            <span class="pfi-action-icon">${getActionIcon(name)}</span>${escHtml(name)}()
          </button>`;
      }).join("")}
      </div>` : "";
      const argsGroup = nonCallable.length > 0 ? `
      <div class="pfi-api-arg-methods${callableMethods.length > 0 ? " pfi-mt" : ""}">
        ${nonCallable.map((m) => `
          <button type="button" class="pfi-api-method-btn"
            data-method="${escAttr(m.name)}" data-arity="${m.arity}" data-wvar="${escAttr(w.widgetVar)}"
            title="${escAttr(t("apiOpenForm", m.name, m.arity))}">
            ${icon("terminal", 12)} ${escHtml(m.name)}<span class="pfi-arity">(${m.arity})</span>
          </button>`).join("")}
      </div>` : "";
      clientApiHtml = `
      <div class="pfi-detail-section">
        <h4>${escHtml(t("sectionClientApi"))}</h4>
        ${callableGroup}${argsGroup}
        <div class="pfi-api-form-host" data-role="api-form-host"></div>
      </div>`;
    }
    let metaHtml = "";
    if (w.metadata && Object.keys(w.metadata).length > 0) {
      const rows = Object.keys(w.metadata).map((k) => {
        const v = w.metadata[k];
        let displayVal;
        if (v === true) displayVal = `<span class="pfi-meta-true">true</span>`;
        else if (v === false) displayVal = `<span class="pfi-meta-false">false</span>`;
        else if (v === null || v === void 0 || v === "") displayVal = `<span class="pfi-meta-null">\u2014</span>`;
        else displayVal = `<span class="pfi-meta-text">${escHtml(String(v))}</span>`;
        return `<div class="pfi-meta-cell"><span class="pfi-meta-key">${escHtml(k)}</span>${displayVal}</div>`;
      }).join("");
      metaHtml = `
      <div class="pfi-detail-section">
        <h4>${escHtml(t("sectionMetadata"))}</h4>
        <div class="pfi-meta-grid">${rows}</div>
      </div>`;
    }
    return `
    <div class="pfi-detail-section">
      <h4>${escHtml(t("sectionInfo"))}</h4>
      <div class="pfi-detail-row">
        <span class="pfi-detail-label">${escHtml(t("labelType"))}</span>
        <span class="pfi-detail-value">${escHtml(w.type)}</span>
      </div>
      <div class="pfi-detail-row">
        <span class="pfi-detail-label">${escHtml(t("labelWidgetVar"))}</span>
        <span class="pfi-detail-value pfi-mono">${escHtml(w.widgetVar)}</span>
      </div>
      <div class="pfi-detail-row">
        <span class="pfi-detail-label">${escHtml(t("labelId"))}</span>
        <span class="pfi-detail-value pfi-mono">${escHtml(w.id)}</span>
      </div>
    </div>
    ${metaHtml}
    ${targetHtml}
    ${clientApiHtml}
    <div class="pfi-detail-section">
      <h4>${escHtml(t("sectionEvents"))}</h4>
      ${eventsHtml}
    </div>`;
  }
  function wireDetailEvents(detail, w, callbacks) {
    const { executeWidgetAction: executeWidgetAction2, executeInlineEvent: executeInlineEvent2, showConfig: showConfig2, showToast: showToast2, showResultModal: showResultModal2 } = callbacks;
    const targetLink = detail.querySelector(".pfi-target-link");
    if (targetLink) {
      targetLink.addEventListener("mouseenter", () => highlightTarget(targetLink.getAttribute("data-target-id")));
      targetLink.addEventListener("mouseleave", clearTargetHighlight);
    }
    detail.querySelectorAll(".pfi-action-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        executeWidgetAction2(btn.getAttribute("data-wvar"), btn.getAttribute("data-action"));
      });
    });
    detail.querySelectorAll(".pfi-event-exec-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        executeInlineEvent2(btn.getAttribute("data-owner-id"), btn.getAttribute("data-event-attr"), btn.getAttribute("data-wvar"));
      });
      btn.addEventListener("mouseenter", () => {
        const ownerId = btn.getAttribute("data-owner-id");
        if (ownerId) highlightTarget(ownerId);
      });
      btn.addEventListener("mouseleave", clearTargetHighlight);
    });
    detail.querySelectorAll('.pfi-hint-clickable[data-role="open-config"]').forEach((hint) => {
      hint.addEventListener("click", (e) => {
        e.stopPropagation();
        showConfig2();
      });
    });
    detail.querySelectorAll(".pfi-event-row").forEach((row) => {
      row.addEventListener("mouseenter", () => {
        highlightEventRow(row.getAttribute("data-value"));
        row.classList.add("pfi-event-row-active");
      });
      row.addEventListener("mouseleave", () => {
        clearEventRowHighlights();
        row.classList.remove("pfi-event-row-active");
      });
    });
    const formHost = detail.querySelector('[data-role="api-form-host"]');
    detail.querySelectorAll(".pfi-api-method-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openApiArgForm(
          formHost,
          btn,
          btn.getAttribute("data-wvar"),
          btn.getAttribute("data-method"),
          parseInt(btn.getAttribute("data-arity"), 10) || 0,
          { executeWidgetAction: executeWidgetAction2, showToast: showToast2, showResultModal: showResultModal2 }
        );
      });
    });
  }

  // src/content/ui/widget-card.js
  function buildCard(w, callbacks) {
    const card = document.createElement("div");
    card.className = "pfi-card";
    card.setAttribute("data-widget-var", w.widgetVar);
    card.innerHTML = `
    <div class="pfi-card-head" data-role="head">
      <div class="pfi-card-icon" title="${escAttr(w.type)}">${getComponentIcon(w.type)}</div>
      <div class="pfi-card-body">
        <div class="pfi-card-wvar">${escHtml(w.widgetVar)}</div>
        <div class="pfi-card-id">${escHtml(w.id)}</div>
      </div>
      <button class="pfi-chevron" type="button" aria-expanded="false"
              title="${escAttr(t("expand"))}" data-role="chevron">
        ${icon("chevron-right", 14)}
      </button>
    </div>
    <div class="pfi-card-detail" data-role="detail" hidden></div>
  `;
    card.addEventListener("mouseenter", () => highlightElement(w.id));
    card.addEventListener("mouseleave", clearHighlight);
    const head = card.querySelector('[data-role="head"]');
    const chev = card.querySelector('[data-role="chevron"]');
    head.addEventListener("click", (e) => {
      if (e.target.closest(".pfi-chevron")) return;
      callbacks.toggleCard(w.widgetVar);
    });
    chev.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.toggleCard(w.widgetVar);
    });
    return card;
  }
  function expandCard(panelEl, widgetsData, widgetVar, scrollIntoView, callbacks) {
    if (!panelEl) return;
    panelEl.querySelectorAll(".pfi-card.pfi-expanded").forEach((c) => {
      if (c.getAttribute("data-widget-var") !== widgetVar) {
        c.classList.remove("pfi-expanded");
        const d = c.querySelector('[data-role="detail"]');
        const ch = c.querySelector('[data-role="chevron"]');
        if (d) {
          d.hidden = true;
          d.innerHTML = "";
        }
        if (ch) ch.setAttribute("aria-expanded", "false");
      }
    });
    const card = panelEl.querySelector(`.pfi-card[data-widget-var="${cssEsc(widgetVar)}"]`);
    if (!card) return;
    const w = widgetsData.find((x) => x.widgetVar === widgetVar);
    if (!w) return;
    const detail = card.querySelector('[data-role="detail"]');
    const chev = card.querySelector('[data-role="chevron"]');
    detail.innerHTML = renderDetailHtml(w);
    detail.hidden = false;
    card.classList.add("pfi-expanded");
    if (chev) chev.setAttribute("aria-expanded", "true");
    wireDetailEvents(detail, w, callbacks);
    if (scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function collapseCard(panelEl, widgetVar) {
    if (!panelEl) return;
    const card = panelEl.querySelector(`.pfi-card[data-widget-var="${cssEsc(widgetVar)}"]`);
    if (card) {
      card.classList.remove("pfi-expanded");
      const detail = card.querySelector('[data-role="detail"]');
      const chev = card.querySelector('[data-role="chevron"]');
      if (detail) {
        detail.hidden = true;
        detail.innerHTML = "";
      }
      if (chev) chev.setAttribute("aria-expanded", "false");
    }
    clearEventRowHighlights();
    clearTargetHighlight();
  }

  // src/content/ui/widget-list.js
  function applyFilters() {
    state.filteredData = state.widgetsData.filter((w) => {
      const matchesSearch = !state.searchTerm || w.widgetVar.toLowerCase().includes(state.searchTerm) || w.id.toLowerCase().includes(state.searchTerm) || w.type.toLowerCase().includes(state.searchTerm) || (() => {
        const el = document.getElementById(w.id);
        return el ? el.textContent.toLowerCase().includes(state.searchTerm) : false;
      })();
      const matchesType = state.selectedTypes.size === 0 || state.selectedTypes.has(w.type);
      return matchesSearch && matchesType;
    });
  }
  function getUniqueTypes() {
    const types = /* @__PURE__ */ new Set();
    state.widgetsData.forEach((w) => types.add(w.type));
    return Array.from(types).sort();
  }
  function renderFilterDropdown(callbacks) {
    const listEl = state.panelEl && state.panelEl.querySelector("#pfi-filter-list");
    if (!listEl) return;
    const types = getUniqueTypes();
    if (types.length === 0) {
      listEl.innerHTML = `<div class="pfi-filter-empty">\u2014</div>`;
      return;
    }
    listEl.innerHTML = types.map((type) => {
      const checked = state.selectedTypes.has(type) ? "checked" : "";
      return `<label class="pfi-filter-row">
      <input type="checkbox" value="${escAttr(type)}" ${checked}>
      <span>${getComponentIcon(type, 14)} ${escHtml(type)}</span>
    </label>`;
    }).join("");
    listEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) state.selectedTypes.add(cb.value);
        else state.selectedTypes.delete(cb.value);
        updateFilterLabel();
        applyFilters();
        renderList(callbacks);
      });
    });
  }
  function updateFilterLabel() {
    const lbl = state.panelEl && state.panelEl.querySelector("#pfi-filter-label");
    if (!lbl) return;
    if (state.selectedTypes.size === 0) lbl.textContent = t("filterAll");
    else if (state.selectedTypes.size === 1) lbl.textContent = Array.from(state.selectedTypes)[0];
    else lbl.textContent = t("filterMulti", state.selectedTypes.size);
  }
  function renderList(callbacks) {
    const listEl = state.panelEl && state.panelEl.querySelector("#pfi-list");
    const countEl = state.panelEl && state.panelEl.querySelector("#pfi-count");
    if (!listEl) return;
    if (countEl) countEl.textContent = `${state.filteredData.length}/${state.widgetsData.length}`;
    const existingTypes = new Set(getUniqueTypes());
    Array.from(state.selectedTypes).forEach((ty) => {
      if (!existingTypes.has(ty)) state.selectedTypes.delete(ty);
    });
    renderFilterDropdown(callbacks);
    updateFilterLabel();
    listEl.innerHTML = "";
    if (state.filteredData.length === 0) {
      listEl.innerHTML = `<div class="pfi-empty">${escHtml(t("noWidgets"))}</div>`;
      return;
    }
    const cardCallbacks = {
      toggleCard: (widgetVar) => {
        if (config.detailWidgetVar === widgetVar) {
          collapseCard(state.panelEl, widgetVar);
          config.detailWidgetVar = null;
          saveConfig();
        } else {
          if (config.detailWidgetVar) collapseCard(state.panelEl, config.detailWidgetVar);
          expandCard(state.panelEl, state.widgetsData, widgetVar, false, callbacks);
          config.detailWidgetVar = widgetVar;
          saveConfig();
        }
      },
      ...callbacks
    };
    state.filteredData.forEach((w) => listEl.appendChild(buildCard(w, cardCallbacks)));
    if (config.detailWidgetVar) {
      const visible = state.filteredData.some((x) => x.widgetVar === config.detailWidgetVar);
      if (visible) {
        expandCard(state.panelEl, state.widgetsData, config.detailWidgetVar, false, callbacks);
      } else {
        config.detailWidgetVar = null;
        saveConfig();
      }
    }
  }

  // src/content/ui/search.js
  function buildSearchBar(callbacks) {
    const toolbar = document.createElement("div");
    toolbar.className = "pfi-toolbar";
    toolbar.innerHTML = `
    <div class="pfi-search-wrap">
      <span class="pfi-search-icon">${icon("search", 13)}</span>
      <input type="text" class="pfi-search" id="pfi-search"
        placeholder="${escAttr(t("searchPlaceholder"))}"
        autocomplete="off" spellcheck="false">
    </div>
    <div class="pfi-multi-filter" id="pfi-multi-filter">
      <button type="button" class="pfi-filter-btn" id="pfi-filter-btn"
        title="${escAttr(t("filterButton"))}">
        <span id="pfi-filter-label">${escHtml(t("filterAll"))}</span>
        ${icon("filter", 11)}
      </button>
      <div class="pfi-filter-dropdown" id="pfi-filter-dropdown" hidden>
        <div class="pfi-filter-list" id="pfi-filter-list"></div>
        <div class="pfi-filter-footer">
          <button type="button" class="pfi-ghost-btn" id="pfi-filter-clear">${escHtml(t("filterClear"))}</button>
        </div>
      </div>
    </div>
  `;
    return toolbar;
  }
  function wireSearchEvents(panelEl, callbacks) {
    const searchInput = panelEl.querySelector("#pfi-search");
    const filterBtn = panelEl.querySelector("#pfi-filter-btn");
    const filterDropdown = panelEl.querySelector("#pfi-filter-dropdown");
    const filterClear = panelEl.querySelector("#pfi-filter-clear");
    searchInput.addEventListener("input", (e) => {
      state.searchTerm = e.target.value.toLowerCase().trim();
      applyFilters();
      renderList(callbacks);
    });
    filterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      filterDropdown.hidden = !filterDropdown.hidden;
      if (!filterDropdown.hidden) renderFilterDropdown(callbacks);
    });
    document.addEventListener("click", (e) => {
      if (!panelEl) return;
      if (!filterDropdown.hidden && !filterDropdown.contains(e.target) && e.target !== filterBtn) {
        filterDropdown.hidden = true;
      }
    });
    filterClear.addEventListener("click", () => {
      state.selectedTypes.clear();
      renderFilterDropdown(callbacks);
      const lbl = panelEl.querySelector("#pfi-filter-label");
      if (lbl) lbl.textContent = t("filterAll");
      applyFilters();
      renderList(callbacks);
    });
  }

  // src/content/ui/config-panel.js
  var GITHUB_URL = "https://github.com/davidmc473/primefaces-chrome-extension";
  var EXT_VERSION = (() => {
    try {
      return chrome.runtime.getManifest().version;
    } catch (e) {
      return "0.4.0";
    }
  })();
  function cfgSection(titleKey, content) {
    return `<div class="pfi-cfg-section"><div class="pfi-cfg-section-title">${escHtml(t(titleKey))}</div>${content}</div>`;
  }
  function cfgRow(labelKey, descKey, control) {
    const desc = descKey ? `<div class="pfi-cfg-desc">${escHtml(t(descKey))}</div>` : "";
    return `<div class="pfi-cfg-row">
    <div class="pfi-cfg-text"><span class="pfi-cfg-label">${escHtml(t(labelKey))}</span>${desc}</div>
    <div class="pfi-cfg-control">${control}</div>
  </div>`;
  }
  function toggle(id, checked) {
    return `<label class="pfi-toggle" for="${id}">
    <input type="checkbox" id="${id}" ${checked ? "checked" : ""}><span class="pfi-slider"></span>
  </label>`;
  }
  function showConfig(callbacks) {
    const existing = state.panelEl.querySelector(".pfi-config-overlay");
    if (existing) {
      existing.remove();
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "pfi-config-overlay";
    overlay.innerHTML = `
    <div class="pfi-overlay-header">
      <button class="pfi-icon-btn" id="pfi-config-back" title="${escAttr(t("back"))}">${icon("arrow-left", 14)}</button>
      <span class="pfi-overlay-title">${icon("settings", 14)} ${escHtml(t("cfgTitle"))}</span>
    </div>
    <div class="pfi-cfg-body">

      ${cfgSection("cfgSectionAppearance", `
        ${cfgRow("cfgLanguage", null, `
          <select id="pfi-cfg-language" class="pfi-select">
            <option value="auto" ${config.language === "auto" ? "selected" : ""}>${escHtml(t("cfgLangAuto"))}</option>
            <option value="en"   ${config.language === "en" ? "selected" : ""}>${escHtml(t("cfgLangEn"))}</option>
            <option value="es"   ${config.language === "es" ? "selected" : ""}>${escHtml(t("cfgLangEs"))}</option>
          </select>`)}
        ${cfgRow("cfgTheme", "cfgThemeDesc", toggle("pfi-cfg-theme", config.theme === "light"))}
      `)}

      ${cfgSection("cfgSectionAjax", `
        ${cfgRow("cfgUpdates", "cfgUpdatesDesc", toggle("pfi-cfg-updates", config.highlightUpdates))}
        <div class="pfi-cfg-color-row">
          <span class="pfi-cfg-label">${escHtml(t("cfgColorUpdate"))}</span>
          <input type="color" id="pfi-cfg-color-update" value="${escAttr(config.colorUpdate)}" class="pfi-color-picker">
        </div>
        ${cfgRow("cfgProcess", "cfgProcessDesc", toggle("pfi-cfg-process", config.highlightProcess))}
        <div class="pfi-cfg-color-row">
          <span class="pfi-cfg-label">${escHtml(t("cfgColorProcess"))}</span>
          <input type="color" id="pfi-cfg-color-process" value="${escAttr(config.colorProcess)}" class="pfi-color-picker">
        </div>
        <div class="pfi-cfg-reset-row">
          <button type="button" class="pfi-ghost-btn" id="pfi-cfg-reset-colors">${icon("rotate-ccw", 12)} ${escHtml(t("cfgReset"))}</button>
        </div>
      `)}

      ${cfgSection("cfgSectionBehavior", `
        ${cfgRow("cfgShowJquery", "cfgShowJqueryDesc", toggle("pfi-cfg-jquery", config.showJqueryEvents))}
        ${cfgRow("cfgPersist", "cfgPersistDesc", toggle("pfi-cfg-persist", config.persistPanel))}
      `)}

      <div class="pfi-cfg-about">
        <div class="pfi-cfg-about-title">${icon("info", 12)} ${escHtml(t("cfgAbout"))}</div>
        <div class="pfi-cfg-about-row">
          <span>${escHtml(t("cfgVersion"))}</span>
          <span class="pfi-mono">${escHtml(EXT_VERSION)}</span>
        </div>
        <div class="pfi-cfg-about-row">
          <span>${escHtml(t("cfgRepo"))}</span>
          <a class="pfi-link" href="${escAttr(GITHUB_URL)}" target="_blank" rel="noopener noreferrer">
            ${icon("github", 13)} GitHub \u2197
          </a>
        </div>
      </div>

    </div>
  `;
    state.panelEl.appendChild(overlay);
    overlay.querySelector("#pfi-config-back").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#pfi-cfg-language").addEventListener("change", (e) => {
      config.language = e.target.value;
      saveConfig();
      if (callbacks && callbacks.reloadPanel) callbacks.reloadPanel();
    });
    overlay.querySelector("#pfi-cfg-theme").addEventListener("change", (e) => {
      config.theme = e.target.checked ? "light" : "dark";
      if (callbacks && callbacks.applyTheme) callbacks.applyTheme();
      saveConfig();
    });
    overlay.querySelector("#pfi-cfg-updates").addEventListener("change", (e) => {
      config.highlightUpdates = e.target.checked;
      saveConfig();
    });
    overlay.querySelector("#pfi-cfg-process").addEventListener("change", (e) => {
      config.highlightProcess = e.target.checked;
      saveConfig();
    });
    overlay.querySelector("#pfi-cfg-persist").addEventListener("change", (e) => {
      config.persistPanel = e.target.checked;
      saveConfig();
    });
    overlay.querySelector("#pfi-cfg-jquery").addEventListener("change", (e) => {
      config.showJqueryEvents = e.target.checked;
      saveConfig();
      requestWidgets();
    });
    overlay.querySelector("#pfi-cfg-color-update").addEventListener("input", (e) => {
      config.colorUpdate = e.target.value;
      applyDynamicColors();
      saveConfig();
    });
    overlay.querySelector("#pfi-cfg-color-process").addEventListener("input", (e) => {
      config.colorProcess = e.target.value;
      applyDynamicColors();
      saveConfig();
    });
    overlay.querySelector("#pfi-cfg-reset-colors").addEventListener("click", () => {
      config.colorUpdate = DEFAULT_COLOR_UPDATE;
      config.colorProcess = DEFAULT_COLOR_PROCESS;
      overlay.querySelector("#pfi-cfg-color-update").value = DEFAULT_COLOR_UPDATE;
      overlay.querySelector("#pfi-cfg-color-process").value = DEFAULT_COLOR_PROCESS;
      applyDynamicColors();
      saveConfig();
    });
  }

  // src/content/ui/toast.js
  function showToast(opts) {
    if (!state.panelEl) return;
    const stack = state.panelEl.querySelector("#pfi-toast-stack");
    if (!stack) return;
    const toast = document.createElement("div");
    toast.className = "pfi-toast " + (opts.success ? "pfi-toast-ok" : "pfi-toast-err");
    const textSpan = document.createElement("span");
    textSpan.className = "pfi-toast-text";
    textSpan.textContent = opts.text || "";
    toast.appendChild(textSpan);
    if (opts.fullResult && opts.fullResult.length > 0) {
      const viewBtn = document.createElement("button");
      viewBtn.className = "pfi-toast-btn";
      viewBtn.innerHTML = icon("maximize-2", 12) + " " + escHtml(t("viewFull"));
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showResultModal(opts.title || "", opts.fullResult);
      });
      toast.appendChild(viewBtn);
    }
    const closeBtn = document.createElement("button");
    closeBtn.className = "pfi-toast-btn pfi-toast-close";
    closeBtn.innerHTML = icon("x", 12);
    closeBtn.addEventListener("click", () => toast.remove());
    toast.appendChild(closeBtn);
    stack.appendChild(toast);
    const hideMs = opts.fullResult ? 8e3 : 5e3;
    setTimeout(() => {
      toast.classList.add("pfi-toast-leaving");
      setTimeout(() => toast.remove(), 300);
    }, hideMs);
  }
  function showResultModal(title, content) {
    if (!state.panelEl) return;
    const prev = state.panelEl.querySelector(".pfi-result-modal");
    if (prev) prev.remove();
    const modal = document.createElement("div");
    modal.className = "pfi-result-modal";
    modal.innerHTML = `
    <div class="pfi-overlay-header">
      <button class="pfi-icon-btn" data-role="close" title="${escAttr(t("back"))}">${icon("arrow-left", 14)}</button>
      <span class="pfi-overlay-title">${escHtml(title || t("resultTitle"))}</span>
      <button class="pfi-icon-btn" data-role="copy" title="${escAttr(t("copyResult"))}">${icon("copy", 14)}</button>
    </div>
    <div class="pfi-result-body"><pre class="pfi-result-pre">${escHtml(content)}</pre></div>
  `;
    state.panelEl.appendChild(modal);
    modal.querySelector('[data-role="close"]').addEventListener("click", () => modal.remove());
    modal.querySelector('[data-role="copy"]').addEventListener("click", () => {
      try {
        navigator.clipboard.writeText(content);
        showToast({ success: true, text: t("copied") });
      } catch (e) {
      }
    });
  }

  // src/content/ui/selection.js
  var selectionCallbacks = {};
  var overlayEl = null;
  var lastWidgetVar = null;
  function findWidgetForElement(el) {
    let current = el;
    while (current && current !== document.body) {
      if (current.id) {
        const widget = state.widgetsData.find((w) => w.id === current.id);
        if (widget) return widget;
      }
      current = current.parentElement;
    }
    return null;
  }
  function highlightCardInList(widgetVar) {
    if (!state.panelEl) return;
    const prev = state.panelEl.querySelector(".pfi-card-selected");
    if (prev) prev.classList.remove("pfi-card-selected");
    const card = state.panelEl.querySelector(`.pfi-card[data-widget-var="${cssEsc(widgetVar)}"]`);
    if (card) {
      card.classList.add("pfi-card-selected");
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  function elementUnderPointer(x, y) {
    if (!overlayEl) return null;
    overlayEl.style.pointerEvents = "none";
    const el = document.elementFromPoint(x, y);
    overlayEl.style.pointerEvents = "auto";
    return el;
  }
  function resolveWidget(x, y) {
    const el = elementUnderPointer(x, y);
    if (!el) return null;
    if (state.panelEl && state.panelEl.contains(el)) return null;
    return findWidgetForElement(el);
  }
  function onOverlayMove(e) {
    const widget = resolveWidget(e.clientX, e.clientY);
    if (widget) {
      if (widget.widgetVar !== lastWidgetVar) {
        lastWidgetVar = widget.widgetVar;
        highlightElement(widget.id);
        highlightCardInList(widget.widgetVar);
      }
    } else if (lastWidgetVar !== null) {
      lastWidgetVar = null;
      clearHighlight();
    }
  }
  function onOverlayClick(e) {
    const widget = resolveWidget(e.clientX, e.clientY);
    if (widget) {
      e.preventDefault();
      e.stopPropagation();
      deactivateSelectionMode();
      if (selectionCallbacks.expandCard) selectionCallbacks.expandCard(widget.widgetVar, true);
    }
  }
  function onSelectionKeyDown(e) {
    if (e.key === "Escape") deactivateSelectionMode();
  }
  function activateSelectionMode(callbacks) {
    selectionCallbacks = callbacks || {};
    state.selectionMode = true;
    lastWidgetVar = null;
    const btn = state.panelEl && state.panelEl.querySelector("#pfi-btn-select");
    if (btn) btn.classList.add("pfi-btn-active");
    state.widgetsData.forEach((w) => {
      const el = document.getElementById(w.id);
      if (el && !(state.panelEl && state.panelEl.contains(el))) {
        el.classList.add("pfi-selection-candidate");
      }
    });
    overlayEl = document.createElement("div");
    overlayEl.className = "pfi-selection-overlay";
    document.body.appendChild(overlayEl);
    overlayEl.addEventListener("mousemove", onOverlayMove, true);
    overlayEl.addEventListener("click", onOverlayClick, true);
    document.addEventListener("keydown", onSelectionKeyDown, true);
  }
  function deactivateSelectionMode() {
    state.selectionMode = false;
    lastWidgetVar = null;
    const btn = state.panelEl && state.panelEl.querySelector("#pfi-btn-select");
    if (btn) btn.classList.remove("pfi-btn-active");
    document.querySelectorAll(".pfi-selection-candidate").forEach((el) => el.classList.remove("pfi-selection-candidate"));
    if (state.panelEl) {
      const sel = state.panelEl.querySelector(".pfi-card-selected");
      if (sel) sel.classList.remove("pfi-card-selected");
    }
    clearHighlight();
    if (overlayEl) {
      overlayEl.removeEventListener("mousemove", onOverlayMove, true);
      overlayEl.removeEventListener("click", onOverlayClick, true);
      overlayEl.remove();
      overlayEl = null;
    }
    document.removeEventListener("keydown", onSelectionKeyDown, true);
  }
  function toggleSelectionMode(callbacks) {
    if (state.selectionMode) deactivateSelectionMode();
    else activateSelectionMode(callbacks);
  }

  // src/content/ui/tooltip.js
  var tipEl = null;
  var currentTarget = null;
  function ensureTip() {
    if (tipEl && tipEl.isConnected) return tipEl;
    tipEl = document.createElement("div");
    tipEl.className = "pfi-tooltip";
    tipEl.setAttribute("role", "tooltip");
    tipEl.hidden = true;
    state.panelEl.appendChild(tipEl);
    return tipEl;
  }
  function tipText(target) {
    let text = target.getAttribute("data-pfi-tip");
    if (!text) {
      const title = target.getAttribute("title");
      if (title) {
        target.setAttribute("data-pfi-tip", title);
        target.removeAttribute("title");
        text = title;
      }
    }
    return text;
  }
  function positionTip(target, tip) {
    const panelRect = state.panelEl.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = r.left - panelRect.left + r.width / 2 - tw / 2;
    left = Math.max(4, Math.min(left, panelRect.width - tw - 4));
    let top = r.top - panelRect.top - th - 6;
    if (top < 4) top = r.bottom - panelRect.top + 6;
    top = Math.max(4, Math.min(top, panelRect.height - th - 4));
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }
  function showTip(target) {
    const text = tipText(target);
    if (!text) return;
    const tip = ensureTip();
    tip.textContent = text;
    tip.hidden = false;
    positionTip(target, tip);
  }
  function hideTip() {
    currentTarget = null;
    if (tipEl) tipEl.hidden = true;
  }
  function initTooltips(panelEl) {
    panelEl.addEventListener("mouseover", (e) => {
      const target = e.target.closest("[title], [data-pfi-tip]");
      if (!target || !panelEl.contains(target) || target === currentTarget) return;
      if (target.classList.contains("pfi-tooltip")) return;
      currentTarget = target;
      showTip(target);
    });
    panelEl.addEventListener("mouseout", (e) => {
      if (!currentTarget) return;
      const to = e.relatedTarget;
      if (to && currentTarget.contains(to)) return;
      hideTip();
    });
    panelEl.addEventListener("click", hideTip, true);
    panelEl.addEventListener("scroll", hideTip, true);
  }

  // src/content/ui/panel.js
  function applyTheme() {
    if (!state.panelEl) return;
    if (config.theme === "light") state.panelEl.classList.add("pfi-theme-light");
    else state.panelEl.classList.remove("pfi-theme-light");
  }
  function makeDraggable(element, handle) {
    let isDragging = false, startX, startY, origX, origY;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(".pfi-icon-btn, .pfi-header-btn")) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      element.style.left = origX + (e.clientX - startX) + "px";
      element.style.top = origY + (e.clientY - startY) + "px";
      element.style.right = "auto";
    });
    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
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
      }
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
      }
    };
  }
  function createPanel() {
    if (state.panelEl) {
      state.panelEl.style.display = "flex";
      applyTheme();
      config.panelOpen = true;
      saveConfig();
      return;
    }
    state.panelEl = document.createElement("div");
    state.panelEl.id = "pf-inspector-panel";
    state.panelEl.innerHTML = `
    <div class="pfi-header pfi-drag-handle">
      <svg class="pfi-logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="var(--accent)" stroke-width="1.5" fill="var(--accent-bg)"/>
        <text x="12" y="16" text-anchor="middle" fill="var(--accent)" font-size="10" font-weight="700" font-family="sans-serif">PF</text>
      </svg>
      <span class="pfi-title">${escHtml(t("title"))}</span>
      <span class="pfi-count" id="pfi-count"></span>
      <button class="pfi-header-btn" id="pfi-btn-select"  title="${escAttr(t("btnSelect"))}">${icon("crosshair", 14)}</button>
      <button class="pfi-header-btn" id="pfi-btn-config"  title="${escAttr(t("btnConfig"))}">${icon("settings", 14)}</button>
      <button class="pfi-header-btn" id="pfi-btn-refresh" title="${escAttr(t("btnRefresh"))}">${icon("rotate-ccw", 14)}</button>
      <button class="pfi-header-btn" id="pfi-btn-close"   title="${escAttr(t("btnClose"))}">${icon("x", 14)}</button>
    </div>
    <div class="pfi-info-bar" id="pfi-info-bar"></div>
  `;
    const searchBar = buildSearchBar(buildCallbacks());
    state.panelEl.appendChild(searchBar);
    const listEl = document.createElement("div");
    listEl.className = "pfi-list";
    listEl.id = "pfi-list";
    state.panelEl.appendChild(listEl);
    const toastStack = document.createElement("div");
    toastStack.className = "pfi-toast-stack";
    toastStack.id = "pfi-toast-stack";
    state.panelEl.appendChild(toastStack);
    document.body.appendChild(state.panelEl);
    state.panelEl.querySelector("#pfi-btn-close").addEventListener("click", closePanel);
    state.panelEl.querySelector("#pfi-btn-refresh").addEventListener("click", requestWidgets);
    state.panelEl.querySelector("#pfi-btn-config").addEventListener("click", () => showConfig(buildConfigCallbacks()));
    state.panelEl.querySelector("#pfi-btn-select").addEventListener("click", () => {
      toggleSelectionMode({ expandCard: buildCallbacks().expandCard });
    });
    wireSearchEvents(state.panelEl, buildCallbacks());
    makeDraggable(state.panelEl, state.panelEl.querySelector(".pfi-drag-handle"));
    initTooltips(state.panelEl);
    applyTheme();
    applyDynamicColors();
    injectPageScript();
    setTimeout(requestWidgets, 300);
    config.panelOpen = true;
    saveConfig();
  }
  function closePanel() {
    if (state.selectionMode) deactivateSelectionMode();
    if (state.panelEl) {
      state.panelEl.style.display = "none";
      clearHighlight();
      clearTargetHighlight();
      clearEventRowHighlights();
    }
    config.panelOpen = false;
    saveConfig();
  }
  function destroyPanel() {
    if (state.selectionMode) deactivateSelectionMode();
    if (state.panelEl) {
      state.panelEl.remove();
      state.panelEl = null;
    }
  }
  function togglePfDependentUi() {
    if (!state.panelEl) return;
    const hasPf = state.pageInfo.hasPrimeFaces;
    const toolbar = state.panelEl.querySelector(".pfi-toolbar");
    const selectBtn = state.panelEl.querySelector("#pfi-btn-select");
    if (toolbar) toolbar.style.display = hasPf ? "" : "none";
    if (selectBtn) selectBtn.style.display = hasPf ? "" : "none";
    if (!hasPf && state.selectionMode) deactivateSelectionMode();
  }
  function refreshPanel() {
    applyFilters();
    renderList(buildCallbacks());
    renderHeaderInfo();
    togglePfDependentUi();
  }

  // src/content/index.js
  if (!window.__pfInspectorLoaded) {
    let handleExecResult = function(data) {
      if (!state.panelEl) return;
      if (data.callId && state.pendingResultCallbacks.has(data.callId)) {
        const cb = state.pendingResultCallbacks.get(data.callId);
        state.pendingResultCallbacks.delete(data.callId);
        try {
          cb(data);
        } catch (e) {
        }
        return;
      }
      if (data.success) {
        const fullResult = data.hasResult ? String(data.result == null ? "" : data.result) : "";
        let text;
        if (data.hasResult) {
          const resTxt = fullResult.length > 80 ? fullResult.slice(0, 80) + "\u2026" : fullResult;
          text = t("execOkResult", data.widgetVar, data.method, resTxt);
        } else {
          text = t("execOk", data.widgetVar, data.method);
        }
        showToast({
          success: true,
          text,
          fullResult: fullResult.length > 80 ? fullResult : null,
          title: `PF('${data.widgetVar}').${data.method}()`
        });
        setTimeout(requestWidgets, 80);
      } else {
        showToast({ success: false, text: t("execErr", data.error) });
      }
    }, onGlobalKeyDown = function(e) {
      if (!state.panelEl || state.panelEl.style.display === "none") return;
      if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key === "Control" || e.key === "Shift")) {
        if (!state.ctrlShiftFired) {
          state.ctrlShiftFired = true;
          toggleSelectionMode({});
        }
      }
    }, onGlobalKeyUp = function(e) {
      if (!e.ctrlKey || !e.shiftKey) state.ctrlShiftFired = false;
    };
    window.__pfInspectorLoaded = true;
    loadConfig(() => {
      applyDynamicColors();
      if (config.persistPanel && config.panelOpen) {
        if (document.body) createPanel();
        else document.addEventListener("DOMContentLoaded", createPanel, { once: true });
      }
      document.addEventListener("keydown", onGlobalKeyDown, true);
      document.addEventListener("keyup", onGlobalKeyUp, true);
    });
    window.addEventListener("message", (event) => {
      if (event.source !== window || !event.data || !event.data.type) return;
      switch (event.data.type) {
        case "PF_INSPECTOR_DATA":
          state.widgetsData = event.data.data || [];
          if (event.data.info) Object.assign(state.pageInfo, event.data.info);
          refreshPanel();
          break;
        case "PF_INSPECTOR_AJAX":
          handleAjaxProcess(event.data.data);
          break;
        case "PF_INSPECTOR_UPDATE":
          handleAjaxUpdate(event.data.data);
          break;
        case "PF_INSPECTOR_EXEC_RESULT":
          handleExecResult(event.data.data);
          break;
      }
    });
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.action === "togglePanel") {
        if (state.panelEl && state.panelEl.style.display !== "none") closePanel();
        else createPanel();
        sendResponse({ ok: true });
      }
      return true;
    });
    const observer = new MutationObserver((mutations) => {
      if (!config.highlightUpdates) return;
      mutations.forEach((mut) => {
        if (mut.type === "childList") {
          mut.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && node.id) {
              if (state.widgetsData.some((w) => w.id === node.id)) {
                flashElement(node, "pfi-highlight-update", 800);
              }
            }
          });
        }
      });
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }
})();
