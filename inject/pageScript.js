/**
 * Script inyectado directamente en la página para acceder a PrimeFaces global.
 * Se comunica con el content script vía window.postMessage.
 */
(function () {
  'use strict';

  /* ── Utilidades ── */

  function decodeHtmlEntities(str) {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  /** Parsea los parámetros de PrimeFaces.ab({...}) o PrimeFaces.ajax.Request.handle({...}) */
  function parseAjaxCall(raw) {
    if (!raw) return null;
    const decoded = decodeHtmlEntities(raw);
    const m = decoded.match(/PrimeFaces\.(?:ab|ajax\.Request\.handle)\(\{([^}]*)\}\)/);
    if (!m) return null;
    const inner = m[1];
    const params = {};
    const re = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|(\w+))/g;
    let match;
    while ((match = re.exec(inner)) !== null) {
      params[match[1]] = match[2] || match[3] || match[4];
    }
    return params;
  }

  const AB_PARAM_MAP = {
    s: { name: 'source', desc: 'ID del componente origen del evento' },
    f: { name: 'formId', desc: 'ID del formulario que envuelve la petición' },
    p: { name: 'process', desc: 'IDs de componentes a procesar en el servidor (process)' },
    u: { name: 'update', desc: 'IDs de componentes a actualizar en el cliente (update)' },
    e: { name: 'event', desc: 'Nombre del evento que dispara la petición' },
    a: { name: 'async', desc: 'Si la petición es asíncrona' },
    g: { name: 'global', desc: 'Si activa listeners globales de Ajax' },
    d: { name: 'delay', desc: 'Retardo en ms antes de enviar la petición' },
    t: { name: 'timeout', desc: 'Timeout en ms para la petición' },
    sc: { name: 'skipChildren', desc: 'Omite el procesamiento de hijos' },
    iau: { name: 'ignoreAutoUpdate', desc: 'Ignora componentes con autoUpdate' },
    ps: { name: 'partialSubmit', desc: 'Envía solo los campos de los componentes procesados' },
    psf: { name: 'partialSubmitFilter', desc: 'Filtro CSS para partial submit' },
    fi: { name: 'fragmentId', desc: 'ID del fragmento' },
    fu: { name: 'fragmentUpdate', desc: 'Actualización de fragmento' },
    pa: { name: 'params', desc: 'Parámetros extra enviados al servidor' },
    onst: { name: 'onstart', desc: 'Callback ejecutado antes de la petición' },
    oner: { name: 'onerror', desc: 'Callback ejecutado si hay error' },
    onsu: { name: 'onsuccess', desc: 'Callback ejecutado si la petición fue exitosa' },
    onco: { name: 'oncomplete', desc: 'Callback ejecutado al finalizar la petición' }
  };

  /** Convierte el cuerpo de un handler de evento JS en algo legible */
  function fnToSnippet(fn) {
    try {
      const src = Function.prototype.toString.call(fn);
      // Quitar saltos y compactar
      return src.replace(/\s+/g, ' ').slice(0, 400);
    } catch (e) {
      return '[function]';
    }
  }

  /**
   * Extrae todos los eventos asociados a un elemento DOM:
   *  - atributos HTML on* (onclick, onchange, onkeyup, …)
   *  - eventos jQuery (`$._data(el, 'events')`) — namespaces y delegados
   *
   * @param {Element} el  Elemento DOM
   * @param {boolean} includeJquery  Si se deben incluir los eventos enlazados con jQuery
   */
  function extractEvents(el, includeJquery) {
    if (!el) return [];
    const events = [];

    // 1) Eventos inline (atributos onXxx) — todos, no solo onclick
    const attrs = el.attributes;
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      if (!/^on[a-z]/i.test(attr.name)) continue;
      const parsed = parseAjaxCall(attr.value);
      const detail = [];
      if (parsed) {
        for (const [k, v] of Object.entries(parsed)) {
          const info = AB_PARAM_MAP[k] || { name: k, desc: k };
          detail.push({ letter: k, name: info.name, desc: info.desc, value: v });
        }
      }
      events.push({
        source: 'inline',
        event: attr.name,
        raw: attr.value,
        parsedParams: detail
      });
    }

    if (!includeJquery) return events;

    // 2) Eventos enlazados con jQuery (PrimeFaces los usa intensivamente)
    try {
      const jq = window.jQuery || window.$;
      if (jq && typeof jq._data === 'function') {
        const data = jq._data(el, 'events');
        if (data && typeof data === 'object') {
          for (const evName of Object.keys(data)) {
            const handlers = data[evName] || [];
            handlers.forEach((h, idx) => {
              const ns = h.namespace ? '.' + h.namespace : '';
              const selector = h.selector ? ' (delegated: ' + h.selector + ')' : '';
              const fn = h.handler;
              const raw = fnToSnippet(fn);
              const parsed = parseAjaxCall(raw);
              const detail = [];
              if (parsed) {
                for (const [k, v] of Object.entries(parsed)) {
                  const info = AB_PARAM_MAP[k] || { name: k, desc: k };
                  detail.push({ letter: k, name: info.name, desc: info.desc, value: v });
                }
              }
              events.push({
                source: 'jquery',
                event: evName + ns + selector + (handlers.length > 1 ? ' #' + (idx + 1) : ''),
                raw: raw,
                parsedParams: detail
              });
            });
          }
        }
      }
    } catch (e) {
      // jQuery no disponible o estructura inesperada
    }

    return events;
  }

  /**
   * Resuelve el nombre real (no minificado) del tipo de widget.
   */
  function getWidgetType(widget) {
    if (!widget) return 'Unknown';

    if (typeof PrimeFaces !== 'undefined' && PrimeFaces.widget) {
      const registry = PrimeFaces.widget;
      let proto = Object.getPrototypeOf(widget);
      while (proto && proto.constructor && proto.constructor !== Object) {
        const ctor = proto.constructor;
        for (const name of Object.keys(registry)) {
          if (registry[name] === ctor) {
            return name;
          }
        }
        proto = Object.getPrototypeOf(proto);
      }
    }

    const fallback = widget.constructor && widget.constructor.name;
    if (fallback && fallback !== 'Object' && fallback.length > 1) {
      return fallback;
    }

    return (widget.cfg && widget.cfg.widgetVar) || 'Unknown';
  }

  /** Obtiene los métodos del Client API de un widget */
  function getClientAPI(widget) {
    if (!widget) return [];
    const methods = [];
    const seen = new Set();
    let proto = Object.getPrototypeOf(widget);
    while (proto && proto.constructor && proto.constructor.name !== 'Object') {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === 'constructor') continue;
        if (key.startsWith('_')) continue;
        if (seen.has(key)) continue;
        try {
          if (typeof proto[key] === 'function') {
            seen.add(key);
            methods.push(key);
          }
        } catch (e) { /* getter */ }
      }
      proto = Object.getPrototypeOf(proto);
    }
    return methods.sort();
  }

  /** Detecta versión de PrimeFaces */
  function detectPrimeFacesVersion() {
    if (typeof PrimeFaces === 'undefined') return null;
    // PrimeFaces 11+ → PrimeFaces.VERSION ; ediciones antiguas → PrimeFaces.version
    const v = PrimeFaces.VERSION || PrimeFaces.version || null;
    if (v) return String(v);
    // Intentar deducir de URL del script primefaces.js
    try {
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].src || '';
        // Excluir explícitamente las URLs de PrimeFaces Extensions
        if (/primefaces-extensions|primefaces\.extensions/i.test(src)) continue;
        const m = src.match(/primefaces[^/]*?[?&]v=([^&"' ]+)/i);
        if (m) return m[1];
        const m2 = src.match(/primefaces[/-](\d+\.\d+(?:\.\d+)?)/i);
        if (m2) return m2[1];
      }
    } catch (e) { /* ignore */ }
    return 'unknown';
  }

  /** Detecta si la página usa PrimeFaces Extensions y su versión */
  function detectPrimeFacesExtVersion() {
    // 1) Variables globales típicas
    try {
      if (typeof PrimeFacesExt !== 'undefined') {
        const v = PrimeFacesExt.VERSION || PrimeFacesExt.version || null;
        return { present: true, version: v ? String(v) : 'unknown' };
      }
    } catch (e) { /* ignore */ }
    try {
      if (typeof PrimeFaces !== 'undefined' && PrimeFaces.ext) {
        const v = PrimeFaces.ext.VERSION || PrimeFaces.ext.version || null;
        return { present: true, version: v ? String(v) : 'unknown' };
      }
    } catch (e) { /* ignore */ }

    // 2) Detectar por URL del recurso JS
    try {
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].src || '';
        if (/primefaces-extensions|primefaces\.extensions|\/pe\//i.test(src)) {
          const m = src.match(/[?&]v=([^&"' ]+)/);
          if (m) return { present: true, version: m[1] };
          const m2 = src.match(/extensions[/-](\d+\.\d+(?:\.\d+)?)/i);
          if (m2) return { present: true, version: m2[1] };
          return { present: true, version: 'unknown' };
        }
      }
    } catch (e) { /* ignore */ }

    // 3) Detección por widgets PE conocidos
    try {
      if (typeof PrimeFaces !== 'undefined' && PrimeFaces.widget) {
        const peClues = ['ExtTimeline', 'ExtTooltip', 'ExtKeyFilter', 'ExtMasterDetail',
          'ExtBlockUI', 'ExtKnob', 'ExtLayout', 'ExtCodeMirror', 'ExtInputNumber',
          'ExtInputPhone', 'ExtCkEditor', 'ExtTinymce', 'ExtLightSwitch'];
        for (const name of peClues) {
          if (PrimeFaces.widget[name]) return { present: true, version: 'unknown' };
        }
      }
    } catch (e) { /* ignore */ }

    return { present: false, version: null };
  }

  /** Información de compatibilidad de la página */
  function getPageInfo() {
    const hasPF = typeof PrimeFaces !== 'undefined';
    const ext = detectPrimeFacesExtVersion();
    return {
      hasPrimeFaces: hasPF,
      version: hasPF ? detectPrimeFacesVersion() : null,
      hasPrimeFacesExt: !!ext.present,
      versionExt: ext.version,
      hasJQuery: !!(window.jQuery || window.$),
      widgetCount: hasPF && PrimeFaces.widgets ? Object.keys(PrimeFaces.widgets).length : 0
    };
  }

  /** Recoge toda la información de los widgets de PrimeFaces */
  function collectWidgets(opts) {
    const includeJquery = !!(opts && opts.showJqueryEvents);
    if (typeof PrimeFaces === 'undefined' || !PrimeFaces.widgets) return [];
    const widgets = [];
    for (const [varName, widget] of Object.entries(PrimeFaces.widgets)) {
      if (!widget || !widget.id) continue;
      const el = document.getElementById(widget.id);
      const typeName = getWidgetType(widget);

      let targetId = null;
      if (widget.cfg) {
        targetId = widget.cfg.target || widget.cfg.targetId || null;
      }
      if (!targetId && el) {
        targetId = el.getAttribute('data-target') || null;
      }

      widgets.push({
        widgetVar: varName,
        id: widget.id,
        type: typeName,
        clientAPI: getClientAPI(widget),
        targetId: targetId,
        events: el ? extractEvents(el, includeJquery) : [],
        exists: !!el
      });
    }
    return widgets;
  }

  /* ── Intercepción de PrimeFaces.ab para monitorizar Ajax ── */

  function hookAjax() {
    if (typeof PrimeFaces === 'undefined') return;
    if (PrimeFaces.__pfInspectorHooked) return;
    PrimeFaces.__pfInspectorHooked = true;

    const originalAb = PrimeFaces.ab;
    PrimeFaces.ab = function (cfg, ext) {
      try {
        const info = {
          source: cfg.s || cfg.source || null,
          formId: cfg.f || cfg.formId || null,
          process: cfg.p || cfg.process || null,
          update: cfg.u || cfg.update || null
        };
        window.postMessage({ type: 'PF_INSPECTOR_AJAX', data: info }, '*');
      } catch (e) { /* silenciar */ }
      return originalAb.apply(this, arguments);
    };

    if (PrimeFaces.ajax && PrimeFaces.ajax.Response) {
      const origHandle = PrimeFaces.ajax.Response.handle;
      if (origHandle && !PrimeFaces.ajax.Response.__pfInspectorHooked) {
        PrimeFaces.ajax.Response.__pfInspectorHooked = true;
        PrimeFaces.ajax.Response.handle = function (xml, status, xhr, updateHandler) {
          try {
            if (xml && xml.getElementsByTagName) {
              const updates = xml.getElementsByTagName('update');
              const updatedIds = [];
              for (let i = 0; i < updates.length; i++) {
                const uid = updates[i].getAttribute('id');
                if (uid) updatedIds.push(uid);
              }
              if (updatedIds.length > 0) {
                window.postMessage({ type: 'PF_INSPECTOR_UPDATE', data: updatedIds }, '*');
              }
            }
          } catch (e) { /* silenciar */ }
          return origHandle.apply(this, arguments);
        };
      }
    }
  }

  /* ── Escuchar mensajes del content script ── */

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'PF_INSPECTOR_COLLECT') {
      hookAjax();
      const widgets = collectWidgets({ showJqueryEvents: !!event.data.showJqueryEvents });
      const info = getPageInfo();
      window.postMessage({ type: 'PF_INSPECTOR_DATA', data: widgets, info: info }, '*');
    }

    if (event.data && event.data.type === 'PF_INSPECTOR_HOOK_AJAX') {
      hookAjax();
    }

    if (event.data && event.data.type === 'PF_INSPECTOR_EXEC_API') {
      const { widgetVar, method } = event.data;
      try {
        if (typeof PrimeFaces !== 'undefined' && PrimeFaces.widgets && PrimeFaces.widgets[widgetVar]) {
          const widget = PrimeFaces.widgets[widgetVar];
          if (typeof widget[method] === 'function') {
            widget[method]();
            window.postMessage({ type: 'PF_INSPECTOR_EXEC_RESULT', data: { success: true, widgetVar, method } }, '*');
          } else {
            window.postMessage({ type: 'PF_INSPECTOR_EXEC_RESULT', data: { success: false, widgetVar, method, error: 'Method not found' } }, '*');
          }
        } else {
          window.postMessage({ type: 'PF_INSPECTOR_EXEC_RESULT', data: { success: false, widgetVar, method, error: 'Widget not found' } }, '*');
        }
      } catch (e) {
        window.postMessage({ type: 'PF_INSPECTOR_EXEC_RESULT', data: { success: false, widgetVar, method, error: e.message } }, '*');
      }
    }
  });

  if (typeof PrimeFaces !== 'undefined') {
    hookAjax();
  }

  window.postMessage({ type: 'PF_INSPECTOR_READY' }, '*');
})();
