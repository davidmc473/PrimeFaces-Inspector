/**
 * Script inyectado directamente en la página para acceder a PrimeFaces global.
 * Se comunica con el content script vía window.postMessage usando el
 * contrato definido en src/shared/messages.ts.
 */
import {
  MSG,
  dataMessage,
  ajaxMessage,
  updateMessage,
  execResultMessage,
  readyMessage,
  ajaxStartMessage,
  ajaxDoneMessage,
  eventFiredMessage,
  postInspectorMessage,
} from '../src/shared/messages.js';

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
   * Extrae eventos inline (atributos on*) de un elemento.
   * Devuelve array de {source:'inline', event, raw, parsedParams, ownerId}.
   */
  function extractInlineEventsOf(el, ownerId) {
    const out = [];
    if (!el || !el.attributes) return out;
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
      out.push({
        source: 'inline',
        event: attr.name,
        raw: attr.value,
        parsedParams: detail,
        ownerId: ownerId || (el.id || null)
      });
    }
    return out;
  }

  /**
   * Extrae todos los eventos asociados a un elemento DOM y a sus descendientes relevantes:
   *  - atributos HTML on* (onclick, onchange, onkeyup, …)
   *  - eventos jQuery (`$._data(el, 'events')`) — namespaces y delegados
   *
   * @param {Element} el  Elemento raíz del widget
   * @param {boolean} includeJquery  Si se deben incluir los eventos enlazados con jQuery
   */
  function extractEvents(el, includeJquery) {
    if (!el) return [];
    let events = [];

    // 1) Eventos inline en el propio elemento
    events = events.concat(extractInlineEventsOf(el, el.id || null));

    // 1b) Eventos inline en descendientes relevantes (inputs, selects, textarea,
    //     botones, anchors y elementos ocultos como ui-helper-hidden-accessible).
    //     Esto cubre casos como SelectOneMenu donde el onchange vive en el <select> interno.
    try {
      const desc = el.querySelectorAll('input, select, textarea, button, a, [onclick], [onchange], [onkeyup], [onkeydown], [onkeypress], [onfocus], [onblur], [onsubmit], [oninput], [onmouseover], [onmouseout]');
      desc.forEach(child => {
        if (child === el) return;
        events = events.concat(extractInlineEventsOf(child, child.id || el.id || null));
      });
    } catch (e) { /* ignore */ }

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
                parsedParams: detail,
                ownerId: el.id || null
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

  /**
   * Obtiene los métodos del Client API de un widget.
   * Devuelve [{name, arity, callable}] — `callable` indica si se puede ejecutar
   * sin argumentos de forma segura (arity 0 y no excluido).
   */
  function getClientAPI(widget) {
    if (!widget) return [];
    const methods = [];
    const seen = new Set();
    // Métodos que no se deben ejecutar nunca desde el inspector
    const BLACKLIST = new Set([
      'constructor', 'init', 'initialize', '_init', 'destroy', 'cleanup',
      'remove', 'destruct', 'render', 'create',
      'getBehavior', 'callBehavior', 'hasBehavior',
      'bindEvents', 'unbindEvents', 'setupEvents',
      'getJQ', 'getId'
    ]);
    let proto = Object.getPrototypeOf(widget);
    while (proto && proto.constructor && proto.constructor.name !== 'Object') {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === 'constructor') continue;
        if (key.startsWith('_')) continue;
        if (seen.has(key)) continue;
        try {
          const v = proto[key];
          if (typeof v === 'function') {
            seen.add(key);
            const arity = v.length;
            const callable = arity === 0 && !BLACKLIST.has(key);
            methods.push({ name: key, arity: arity, callable: callable });
          }
        } catch (e) { /* getter */ }
      }
      proto = Object.getPrototypeOf(proto);
    }
    methods.sort((a, b) => a.name.localeCompare(b.name));
    return methods;
  }

  /**
   * Devuelve el primer input/select/textarea relevante dentro del widget.
   * En PrimeFaces a menudo el elemento "padre" (.ui-inputtext wrapper) no tiene
   * los atributos `data-p-*`; éstos viven en el <input> real interno.
   */
  function findPrimaryInput(el) {
    if (!el) return null;
    // Si el propio elemento ES un input/select/textarea, devolverlo
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return el;
    // Buscar el primer input significativo: priorizar los que tienen data-p-*
    const candidates = el.querySelectorAll('input, select, textarea');
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      // Saltar inputs hidden o auxiliares (e.g. ui-helper-hidden)
      if (c.type === 'hidden') continue;
      // Si tiene cualquier atributo data-p-* lo preferimos
      for (let j = 0; j < c.attributes.length; j++) {
        if (c.attributes[j].name.indexOf('data-p-') === 0) return c;
      }
    }
    // Fallback: primero no-hidden
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].type !== 'hidden') return candidates[i];
    }
    return null;
  }

  /** Convierte un string atributo a tipo (número/booleano/string) */
  function coerceAttr(v) {
    if (v === null || v === undefined) return null;
    if (v === '') return '';
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^-?\d+$/.test(v)) {
      const n = parseInt(v, 10);
      if (!isNaN(n)) return n;
    }
    if (/^-?\d+\.\d+$/.test(v)) {
      const f = parseFloat(v);
      if (!isNaN(f)) return f;
    }
    return v;
  }

  /**
   * Lee los atributos `data-p-*` y atributos HTML estándar (maxlength,
   * minlength, pattern, min, max, step, placeholder…) del input interno
   * del widget. Devuelve un objeto con las propiedades encontradas.
   *
   * Mapea data-p-* a nombres "limpios":
   *   data-p-maxlength  → maxlength
   *   data-p-minlength  → minlength
   *   data-p-regex      → pattern
   *   data-p-val        → validator
   *   data-p-vmsg       → validationMessage
   *   data-p-label      → label
   *   data-p-required   → required
   *   data-p-min/max    → min/max
   */
  function readDomAttributes(el) {
    const result = {};
    const input = findPrimaryInput(el);
    if (!input) return result;

    // Atributos HTML estándar de validación / form
    const HTML_ATTRS = ['maxlength', 'minlength', 'pattern', 'min', 'max', 'step', 'placeholder', 'type'];
    HTML_ATTRS.forEach(name => {
      if (input.hasAttribute(name)) {
        result[name] = coerceAttr(input.getAttribute(name));
      }
    });

    // Atributos data-p-* (PrimeFaces client-side validation)
    const DATA_P_MAP = {
      'data-p-maxlength': 'maxlength',
      'data-p-minlength': 'minlength',
      'data-p-regex': 'pattern',
      'data-p-val': 'validator',
      'data-p-vmsg': 'validatorMsg',
      'data-p-label': 'label',
      'data-p-required': 'required',
      'data-p-min': 'min',
      'data-p-max': 'max',
      'data-p-rmsg': 'requiredMsg'
    };
    for (let i = 0; i < input.attributes.length; i++) {
      const attr = input.attributes[i];
      if (attr.name.indexOf('data-p-') !== 0) continue;
      const mapped = DATA_P_MAP[attr.name];
      if (mapped) {
        result[mapped] = coerceAttr(attr.value);
      } else {
        // Conservar otros data-p-* con su nombre original (sin prefijo)
        const cleanName = attr.name.replace(/^data-p-/, 'p_');
        result[cleanName] = coerceAttr(attr.value);
      }
    }

    return result;
  }

  /**
   * Extrae metadata útil del widget (cfg + estado del DOM + data-p-* attrs).
   * Devuelve un objeto plano clave→valor solo con campos relevantes.
   */
  function extractMetadata(widget, el) {
    const meta = {};
    const cfg = (widget && widget.cfg) || {};

    // Detectar disabled tanto en cfg como en el DOM
    let disabled = null;
    if (typeof cfg.disabled === 'boolean') disabled = cfg.disabled;
    if (el) {
      // disabled como atributo en el propio elemento o en un input hijo
      if (el.hasAttribute && el.hasAttribute('disabled')) disabled = true;
      const innerInput = el.querySelector && el.querySelector('input,select,textarea,button');
      if (innerInput && innerInput.disabled) disabled = true;
      if (el.classList && (el.classList.contains('ui-state-disabled') || el.getAttribute('aria-disabled') === 'true')) {
        if (disabled === null) disabled = true;
      }
    }
    if (disabled !== null) meta.disabled = disabled;

    // readonly
    if (typeof cfg.readonly === 'boolean') meta.readonly = cfg.readonly;
    if (el) {
      const innerInput = el.querySelector && el.querySelector('input,textarea,select');
      if (innerInput && innerInput.readOnly) meta.readonly = true;
    }

    // required
    if (typeof cfg.required === 'boolean') meta.required = cfg.required;
    if (el) {
      const innerInput = el.querySelector && el.querySelector('input,textarea,select');
      if (innerInput && innerInput.required) meta.required = true;
      if (el.getAttribute && el.getAttribute('aria-required') === 'true') meta.required = true;
    }


    // Lista de propiedades del cfg que pueden interesar mostrar
    const INTERESTING_CFG_KEYS = [
      'value', 'defaultValue',
      'min', 'max', 'minlength', 'maxlength', 'step',
      'placeholder', 'pattern',
      'multiple', 'editable', 'filter', 'filterMatchMode',
      'selectionMode', 'paginator', 'rows', 'rowsPerPageTemplate',
      'lazy', 'liveScroll', 'scrollable', 'scrollHeight', 'scrollWidth',
      'autoUpdate', 'global', 'partialSubmit',
      'process', 'update', 'event',
      'modal', 'draggable', 'resizable', 'closable', 'closeOnEscape',
      'width', 'height', 'position',
      'dateFormat', 'showTime', 'showSeconds', 'timeOnly', 'mode', 'selectOtherMonths',
      'currencySymbol', 'decimalSeparator', 'thousandSeparator', 'decimalPlaces', 'symbol',
      'orientation', 'dropdownMode',
      'forceSelection', 'unique', 'cache',
      'showHeader', 'showFooter',
      'effect', 'effectSpeed',
      'maxFileSize', 'allowTypes', 'fileLimit',
      'target', 'targetId',
      'url'
    ];
    INTERESTING_CFG_KEYS.forEach(k => {
      if (cfg.hasOwnProperty(k) && typeof cfg[k] !== 'function' && typeof cfg[k] !== 'object') {
        meta[k] = cfg[k];
      } else if (cfg.hasOwnProperty(k) && cfg[k] !== null && typeof cfg[k] === 'object' && !Array.isArray(cfg[k])) {
        // mostrar resumen tipo "[Object]"
        try { meta[k] = JSON.stringify(cfg[k]).slice(0, 80); } catch (e) { /* */ }
      } else if (cfg.hasOwnProperty(k) && Array.isArray(cfg[k])) {
        meta[k] = '[' + cfg[k].length + ' items]';
      }
    });

    // visible
    if (el) {
      const cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
      if (cs) {
        meta.visible = !(cs.display === 'none' || cs.visibility === 'hidden');
      }
    }

    // Fusionar atributos del DOM (data-p-* + atributos HTML estándar).
    // Estos PREVALECEN sobre cfg si están definidos (son la "verdad" del DOM).
    if (el) {
      const domAttrs = readDomAttributes(el);
      Object.keys(domAttrs).forEach(k => {
        // Solo sobrescribir si el cfg no lo tenía o estaba vacío
        if (meta[k] === undefined || meta[k] === null || meta[k] === '') {
          meta[k] = domAttrs[k];
        }
      });
    }

    return meta;
  }

  /**
   * Serializa un valor de retorno de un método de widget para mostrarlo.
   * Devuelve {hasResult, result:string}.
   */
  function serializeResult(ret) {
    if (ret === undefined) return { hasResult: false, result: '' };
    try {
      if (ret === null) return { hasResult: true, result: 'null' };
      if (typeof ret === 'string') return { hasResult: true, result: ret };
      if (typeof ret === 'number' || typeof ret === 'boolean') {
        return { hasResult: true, result: String(ret) };
      }
      if (Array.isArray(ret)) {
        // Si es pequeño, mostrar JSON; si no, resumen
        try {
          const json = JSON.stringify(ret);
          if (json.length <= 400) return { hasResult: true, result: json };
        } catch (e) { /* */ }
        return { hasResult: true, result: '[' + ret.length + ' items]' };
      }
      if (ret && ret.jquery) {
        const ids = [];
        for (let i = 0; i < ret.length && i < 5; i++) {
          ids.push(ret[i].id || ret[i].tagName);
        }
        return { hasResult: true, result: 'jQuery(' + ret.length + ')' + (ids.length ? ' [' + ids.join(', ') + ']' : '') };
      }
      if (typeof ret === 'object') {
        if (ret.nodeType && ret.tagName) {
          return { hasResult: true, result: '<' + ret.tagName.toLowerCase() + (ret.id ? ' id="' + ret.id + '"' : '') + '>' };
        }
        try {
          const json = JSON.stringify(ret);
          if (json && json.length > 800) return { hasResult: true, result: json.slice(0, 800) + '…' };
          return { hasResult: true, result: json || '[object]' };
        } catch (e) { return { hasResult: true, result: '[object]' }; }
      }
      return { hasResult: true, result: String(ret) };
    } catch (e) {
      return { hasResult: true, result: '[unserializable]' };
    }
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
        metadata: extractMetadata(widget, el),
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
        postInspectorMessage(ajaxMessage(info));
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
                postInspectorMessage(updateMessage(updatedIds));
              }
            }
          } catch (e) { /* silenciar */ }
          return origHandle.apply(this, arguments);
        };
      }
    }
  }

  /* ── Timeline Ajax: intercepción a nivel de XMLHttpRequest ──
     PrimeFaces envía sus peticiones parciales vía jQuery/XHR con el
     payload urlencoded `javax.faces.partial.ajax=true` (o `jakarta.*`
     en Faces 4+). Interceptar XHR captura TODAS las peticiones JSF,
     incluidas las que van con global:false (que no disparan los
     eventos globales de jQuery), y permite medir el tiempo real. */

  const MAX_REQ_BODY = 2000;
  const MAX_RES_BODY = 4000;
  let ajaxSeq = 0;

  /** Extrae los parámetros JSF relevantes del payload urlencoded, o null si no es una petición faces */
  function parseFacesRequestBody(body) {
    if (typeof body !== 'string' || body.indexOf('faces.partial.ajax') === -1) return null;
    try {
      const sp = new URLSearchParams(body);
      let ns = null;
      if (sp.get('javax.faces.partial.ajax') === 'true') ns = 'javax';
      else if (sp.get('jakarta.faces.partial.ajax') === 'true') ns = 'jakarta';
      if (!ns) return null;
      return {
        source: sp.get(ns + '.faces.source'),
        process: sp.get(ns + '.faces.partial.execute'),
        update: sp.get(ns + '.faces.partial.render'),
        event: sp.get(ns + '.faces.behavior.event'),
      };
    } catch (e) {
      return null;
    }
  }

  /** Extrae updates aplicados, error y redirect de una partial-response */
  function parseFacesResponse(xhr) {
    const out = { updates: [], errorName: null, errorMessage: null, redirect: null, responseBody: '' };
    try {
      const text = xhr.responseText || '';
      out.responseBody = text.slice(0, MAX_RES_BODY);
      let xml = null;
      try { xml = xhr.responseXML; } catch (e) { /* responseType incompatible */ }
      if (!xml && text.indexOf('<partial-response') !== -1) {
        xml = new DOMParser().parseFromString(text, 'text/xml');
      }
      if (!xml) return out;
      const ups = xml.getElementsByTagName('update');
      for (let i = 0; i < ups.length; i++) {
        const uid = ups[i].getAttribute('id');
        if (uid) out.updates.push(uid);
      }
      const err = xml.getElementsByTagName('error')[0];
      if (err) {
        const en = err.getElementsByTagName('error-name')[0];
        const em = err.getElementsByTagName('error-message')[0];
        out.errorName = (en && en.textContent) || 'error';
        out.errorMessage = em ? String(em.textContent || '').slice(0, 300) : null;
      }
      const red = xml.getElementsByTagName('redirect')[0];
      if (red) out.redirect = red.getAttribute('url');
    } catch (e) { /* respuesta no parseable */ }
    return out;
  }

  function hookXhrTimeline() {
    if (window.__pfInspectorXhrHooked) return;
    window.__pfInspectorXhrHooked = true;

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        this.__pfiMethod = method;
        this.__pfiUrl = String(url);
      } catch (e) { /* silenciar */ }
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      try {
        const params = parseFacesRequestBody(body);
        if (params) {
          const id = 'ax' + (++ajaxSeq) + '_' + Date.now().toString(36);
          const start = Date.now();
          postInspectorMessage(ajaxStartMessage({
            id: id,
            url: this.__pfiUrl || '',
            method: this.__pfiMethod || 'POST',
            source: params.source,
            process: params.process,
            update: params.update,
            event: params.event,
            requestBody: String(body).slice(0, MAX_REQ_BODY),
            ts: start,
          }));
          this.addEventListener('loadend', () => {
            const res = parseFacesResponse(this);
            const httpOk = this.status >= 200 && this.status < 300;
            postInspectorMessage(ajaxDoneMessage({
              id: id,
              status: this.status,
              ok: httpOk && !res.errorName,
              durationMs: Date.now() - start,
              updates: res.updates,
              errorName: httpOk ? res.errorName : (res.errorName || 'HTTP ' + this.status),
              errorMessage: res.errorMessage,
              redirect: res.redirect,
              responseBody: res.responseBody,
            }));
            // El DOM puede haber sido reemplazado por los updates:
            // re-armar los listeners del monitor de eventos en vivo.
            if (eventMonitorOn) setTimeout(armEventMonitor, 250);
          });
        }
      } catch (e) { /* silenciar */ }
      return origSend.apply(this, arguments);
    };
  }

  /* ── Monitor de eventos en vivo ──
     Adjunta listeners de captura para los eventos ya detectados de cada
     widget (inline y jQuery — ambos son eventos DOM nativos por debajo)
     y notifica cada disparo con timestamp y un resumen de argumentos. */

  let eventMonitorOn = false;
  let monitorRegs = [];
  // Eventos de alta frecuencia que inundarían el log
  const MONITOR_EXCLUDED = new Set([
    'mousemove', 'pointermove', 'mouseover', 'mouseout', 'pointerover',
    'pointerout', 'mouseenter', 'mouseleave', 'scroll', 'wheel',
    'touchmove', 'drag', 'dragover',
  ]);
  // Límite de seguridad: máx. mensajes por segundo
  let monitorWindowStart = 0;
  let monitorWindowCount = 0;

  /** 'onclick' → 'click'; 'click.ns (delegated: …) #2' → 'click' */
  function domEventType(ev) {
    if (ev.source === 'inline') return ev.event.replace(/^on/i, '').toLowerCase();
    const m = String(ev.event).match(/^([a-zA-Z]+)/);
    return m ? m[1].toLowerCase() : null;
  }

  function summarizeDomEvent(e) {
    const parts = [];
    const target = e.target;
    if (target) {
      if (target.id) parts.push('#' + target.id);
      else if (target.tagName) parts.push('<' + target.tagName.toLowerCase() + '>');
    }
    if (typeof e.key === 'string') parts.push('key: ' + e.key);
    if (typeof e.button === 'number' && /click|mouse|pointer|contextmenu/.test(e.type)) {
      parts.push(e.clientX + ',' + e.clientY);
    }
    if (target && typeof target.value === 'string' && /^(input|change|keyup|keydown|blur)$/.test(e.type)) {
      const v = target.value;
      parts.push('value: "' + (v.length > 60 ? v.slice(0, 60) + '…' : v) + '"');
    }
    return parts.join(' · ');
  }

  function disarmEventMonitor() {
    monitorRegs.forEach(r => {
      try { r.el.removeEventListener(r.type, r.fn, true); } catch (e) { /* */ }
    });
    monitorRegs = [];
  }

  function armEventMonitor() {
    disarmEventMonitor();
    if (!eventMonitorOn) return;
    if (typeof PrimeFaces === 'undefined' || !PrimeFaces.widgets) return;

    const attached = new Map(); // el → Set(type) para no duplicar listeners
    for (const [varName, widget] of Object.entries(PrimeFaces.widgets)) {
      if (!widget || !widget.id) continue;
      const rootEl = document.getElementById(widget.id);
      if (!rootEl) continue;
      const events = extractEvents(rootEl, true);
      events.forEach(ev => {
        const type = domEventType(ev);
        if (!type || MONITOR_EXCLUDED.has(type)) return;
        const ownerEl = (ev.source === 'inline' && ev.ownerId && document.getElementById(ev.ownerId)) || rootEl;
        let types = attached.get(ownerEl);
        if (!types) { types = new Set(); attached.set(ownerEl, types); }
        if (types.has(type)) return;
        types.add(type);

        const fn = (e) => {
          if (!eventMonitorOn) return;
          const now = Date.now();
          if (now - monitorWindowStart > 1000) { monitorWindowStart = now; monitorWindowCount = 0; }
          if (++monitorWindowCount > 50) return;
          postInspectorMessage(eventFiredMessage({
            widgetVar: varName,
            ownerId: ownerEl.id || widget.id || null,
            event: type,
            source: ev.source,
            ts: now,
            detail: summarizeDomEvent(e),
          }));
        };
        ownerEl.addEventListener(type, fn, true);
        monitorRegs.push({ el: ownerEl, type: type, fn: fn });
      });
    }
  }

  function startEventMonitor() {
    eventMonitorOn = true;
    armEventMonitor();
  }

  function stopEventMonitor() {
    eventMonitorOn = false;
    disarmEventMonitor();
  }

  /* ── Escuchar mensajes del content script ── */

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === MSG.COLLECT) {
      hookAjax();
      const widgets = collectWidgets({ showJqueryEvents: !!event.data.showJqueryEvents });
      const info = getPageInfo();
      postInspectorMessage(dataMessage(widgets, info));
      // Los widgets pueden haber cambiado: re-armar el monitor si está activo
      if (eventMonitorOn) armEventMonitor();
    }

    if (event.data && event.data.type === MSG.HOOK_AJAX) {
      hookAjax();
    }

    if (event.data && event.data.type === MSG.EVENT_MONITOR_START) {
      startEventMonitor();
    }

    if (event.data && event.data.type === MSG.EVENT_MONITOR_STOP) {
      stopEventMonitor();
    }

    if (event.data && event.data.type === MSG.EXEC_API) {
      const { widgetVar, method, args, callId } = event.data;
      try {
        if (typeof PrimeFaces !== 'undefined' && PrimeFaces.widgets && PrimeFaces.widgets[widgetVar]) {
          const widget = PrimeFaces.widgets[widgetVar];
          if (typeof widget[method] === 'function') {
            const callArgs = Array.isArray(args) ? args : [];
            const ret = widget[method].apply(widget, callArgs);
            const ser = serializeResult(ret);
            postInspectorMessage(execResultMessage({
              success: true,
              widgetVar, method,
              hasResult: ser.hasResult,
              result: ser.result,
              callId: callId || null,
              argsCount: callArgs.length
            }));
          } else {
            postInspectorMessage(execResultMessage({ success: false, widgetVar, method, error: 'Method not found', callId: callId || null }));
          }
        } else {
          postInspectorMessage(execResultMessage({ success: false, widgetVar, method, error: 'Widget not found', callId: callId || null }));
        }
      } catch (e) {
        postInspectorMessage(execResultMessage({ success: false, widgetVar, method, error: e.message, callId: callId || null }));
      }
    }



    // Ejecutar un evento inline (atributo on*) sobre el elemento que lo tiene
    if (event.data && event.data.type === MSG.EXEC_EVENT) {
      const { ownerId, eventAttr, widgetVar } = event.data;
      try {
        const el = ownerId ? document.getElementById(ownerId) : null;
        if (!el) {
          postInspectorMessage(execResultMessage({ success: false, widgetVar: widgetVar || ownerId, method: eventAttr, error: 'Element not found: ' + ownerId }));
          return;
        }
        const evName = (eventAttr || '').replace(/^on/i, '');
        // 1) Si existe la propiedad onXxx como función, ejecutarla
        const fn = el[eventAttr];
        if (typeof fn === 'function') {
          fn.call(el, new Event(evName, { bubbles: true, cancelable: true }));
          postInspectorMessage(execResultMessage({ success: true, widgetVar: widgetVar || ownerId, method: eventAttr + '()' }));
          return;
        }
        // 2) Fallback: despachar el evento estándar para que cualquier listener responda
        let ev;
        // Eventos típicos que requieren MouseEvent
        if (/^(click|dblclick|mouse|contextmenu)/i.test(evName)) {
          ev = new MouseEvent(evName, { bubbles: true, cancelable: true, view: window });
        } else if (/^(key)/i.test(evName)) {
          ev = new KeyboardEvent(evName, { bubbles: true, cancelable: true });
        } else if (/^(focus|blur)/i.test(evName)) {
          ev = new FocusEvent(evName, { bubbles: true, cancelable: true });
        } else if (/^(input|change|submit|reset)/i.test(evName)) {
          ev = new Event(evName, { bubbles: true, cancelable: true });
        } else {
          ev = new Event(evName, { bubbles: true, cancelable: true });
        }
        el.dispatchEvent(ev);
        postInspectorMessage(execResultMessage({ success: true, widgetVar: widgetVar || ownerId, method: eventAttr + ' dispatched' }));
      } catch (e) {
        postInspectorMessage(execResultMessage({ success: false, widgetVar: widgetVar || ownerId, method: eventAttr, error: e.message }));
      }
    }
  });

  hookXhrTimeline();
  if (typeof PrimeFaces !== 'undefined') {
    hookAjax();
  }

  postInspectorMessage(readyMessage());
})();
