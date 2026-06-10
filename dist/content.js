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
  var ATTRS = `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  function svg(size, content) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ${ATTRS} aria-hidden="true">${content}</svg>`;
  }
  var PATHS = {
    "x": '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    "chevron-right": '<polyline points="9 18 15 12 9 6"/>',
    "arrow-left": '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    "play": '<polygon points="5 3 19 12 5 21 5 3"/>',
    "terminal": '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    "search": '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    "filter": '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    "maximize-2": '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
    "copy": '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    "crosshair": '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
    "rotate-ccw": '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    "globe": '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    "sun": '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    "moon": '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    "zap": '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    "bookmark": '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    "info": '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    "github": '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
    "alert-triangle": '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    "check-circle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    "check": '<polyline points="20 6 9 17 4 12"/>'
  };
  function icon(name, size = 14) {
    return svg(size, PATHS[name] || PATHS["x"]);
  }
  var COMPONENT_ICONS = {
    DataTable: "\u229E",
    CommandButton: "\u25C9",
    CommandLink: "\u2197",
    Dialog: "\u25A3",
    Panel: "\u25A4",
    TabView: "\u229F",
    InputNumber: "\u2460",
    InputMask: "\u2328",
    InputText: "\u270E",
    InputTextarea: "\u2261",
    Calendar: "\u25A6",
    DatePicker: "\u25A6",
    TimePicker: "\u2299",
    SelectOneMenu: "\u25BD",
    SelectBooleanCheckbox: "\u2611",
    SelectManyCheckbox: "\u2611",
    AutoComplete: "\u2315",
    FileUpload: "\u21E7",
    Tree: "\u22B3",
    TreeTable: "\u22B3",
    AccordionPanel: "\u229E",
    Menu: "\u2261",
    Menubar: "\u2261",
    ContextMenu: "\u2261",
    Growl: "\u25C8",
    Messages: "\u25C8",
    Message: "\u25C8",
    OverlayPanel: "\u25A3",
    Tooltip: "\u25C7",
    ProgressBar: "\u25AC",
    Chart: "\u22BF",
    Schedule: "\u25A6",
    Carousel: "\u25EB",
    Galleria: "\u25A3",
    Editor: "\u270E",
    Spinner: "\u2460",
    Slider: "\u25AC",
    Rating: "\u25C6",
    ColorPicker: "\u25C8",
    Chips: "\u25C9",
    PickList: "\u21C4",
    OrderList: "\u21C5",
    DataList: "\u25A4",
    DataGrid: "\u229E",
    DataScroller: "\u25A4",
    Paginator: "\u25B6",
    Fieldset: "\u25A3",
    ConfirmDialog: "\u25C8",
    Sidebar: "\u25A4",
    Inplace: "\u270E",
    BlockUI: "\u2298",
    Poll: "\u21BA",
    RemoteCommand: "\u26A1",
    OutputPanel: "\u25A4",
    AjaxStatus: "\u21BA",
    Fragment: "\u25C8",
    Default: "\u25C8"
  };
  var ICON_KEYS = Object.keys(COMPONENT_ICONS).filter((k) => k !== "Default").sort((a, b) => b.length - a.length);
  function getComponentIcon(type) {
    if (!type) return COMPONENT_ICONS.Default;
    const low = type.toLowerCase();
    for (const key of ICON_KEYS) {
      if (low.includes(key.toLowerCase())) return COMPONENT_ICONS[key];
    }
    return COMPONENT_ICONS.Default;
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
      <span>${getComponentIcon(type)} ${escHtml(type)}</span>
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
  function onSelectionMouseOver(e) {
    if (state.panelEl && state.panelEl.contains(e.target)) return;
    const widget = findWidgetForElement(e.target);
    if (widget) {
      highlightElement(widget.id);
      highlightCardInList(widget.widgetVar);
    }
  }
  function onSelectionMouseOut(e) {
    if (state.panelEl && state.panelEl.contains(e.target)) return;
  }
  function onSelectionClick(e) {
    if (state.panelEl && state.panelEl.contains(e.target)) return;
    const widget = findWidgetForElement(e.target);
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
  var selectionCallbacks = {};
  function activateSelectionMode(callbacks) {
    selectionCallbacks = callbacks || {};
    state.selectionMode = true;
    const btn = state.panelEl && state.panelEl.querySelector("#pfi-btn-select");
    if (btn) btn.classList.add("pfi-btn-active");
    state.widgetsData.forEach((w) => {
      const el = document.getElementById(w.id);
      if (el && !(state.panelEl && state.panelEl.contains(el))) {
        el.classList.add("pfi-selection-candidate");
      }
    });
    document.addEventListener("mouseover", onSelectionMouseOver, true);
    document.addEventListener("mouseout", onSelectionMouseOut, true);
    document.addEventListener("click", onSelectionClick, true);
    document.addEventListener("keydown", onSelectionKeyDown, true);
  }
  function deactivateSelectionMode() {
    state.selectionMode = false;
    const btn = state.panelEl && state.panelEl.querySelector("#pfi-btn-select");
    if (btn) btn.classList.remove("pfi-btn-active");
    document.querySelectorAll(".pfi-selection-candidate").forEach((el) => el.classList.remove("pfi-selection-candidate"));
    if (state.panelEl) {
      const sel = state.panelEl.querySelector(".pfi-card-selected");
      if (sel) sel.classList.remove("pfi-card-selected");
    }
    clearHighlight();
    document.removeEventListener("mouseover", onSelectionMouseOver, true);
    document.removeEventListener("mouseout", onSelectionMouseOut, true);
    document.removeEventListener("click", onSelectionClick, true);
    document.removeEventListener("keydown", onSelectionKeyDown, true);
  }
  function toggleSelectionMode(callbacks) {
    if (state.selectionMode) deactivateSelectionMode();
    else activateSelectionMode(callbacks);
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
  function refreshPanel() {
    applyFilters();
    renderList(buildCallbacks());
    renderHeaderInfo();
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
