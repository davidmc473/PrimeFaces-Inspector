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
    // Buscar PrimeFaces.ab({...}) o PrimeFaces.ajax.Request.handle({...})
    const m = decoded.match(/PrimeFaces\.(?:ab|ajax\.Request\.handle)\(\{([^}]*)\}\)/);
    if (!m) return null;
    const inner = m[1];
    const params = {};
    // Parsear pares clave:valor — las claves son letras o palabras, los valores strings o booleanos
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

  /** Extrae información detallada de los atributos de eventos de un elemento DOM */
  function extractEvents(el) {
    if (!el) return [];
    const events = [];
    const attrs = el.attributes;
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      if (attr.name.startsWith('on')) {
        const parsed = parseAjaxCall(attr.value);
        const detail = [];
        if (parsed) {
          for (const [k, v] of Object.entries(parsed)) {
            const info = AB_PARAM_MAP[k] || { name: k, desc: k };
            detail.push({ letter: k, name: info.name, desc: info.desc, value: v });
          }
        }
        events.push({
          event: attr.name,
          raw: attr.value,
          parsedParams: detail
        });
      }
    }
    return events;
  }

  /**
   * Resuelve el nombre real (no minificado) del tipo de widget.
   * En builds de producción de PrimeFaces, widget.constructor.name está
   * minificado (p.ej. "d"). Sin embargo, todas las clases están registradas
   * en `PrimeFaces.widget.{Nombre}`. Buscamos en la cadena de prototipos
   * del widget cuál constructor coincide con alguna entrada de ese registro.
   */
  function getWidgetType(widget) {
    if (!widget) return 'Unknown';

    // 1) Resolución vía PrimeFaces.widget (cubre minificación)
    if (typeof PrimeFaces !== 'undefined' && PrimeFaces.widget) {
      // Construir un mapa inverso constructor -> nombre (una sola vez por llamada)
      const registry = PrimeFaces.widget;
      let proto = Object.getPrototypeOf(widget);
      // Recorremos prototipos desde el más específico al más general
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

    // 2) Fallback: nombre del constructor (útil para entornos sin minificar)
    const fallback = widget.constructor && widget.constructor.name;
    if (fallback && fallback !== 'Object' && fallback.length > 1) {
      return fallback;
    }

    // 3) Último recurso: cfg.widgetVar / Unknown
    return (widget.cfg && widget.cfg.widgetVar) || 'Unknown';
  }

  /** Obtiene los métodos del Client API de un widget */
  function getClientAPI(widget) {
    if (!widget) return [];
    const methods = [];
    const seen = new Set();
    let proto = Object.getPrototypeOf(widget);
    // Recorrer la cadena de prototipos hasta la raíz de PrimeFaces
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

  /** Recoge toda la información de los widgets de PrimeFaces */
  function collectWidgets() {
    if (typeof PrimeFaces === 'undefined' || !PrimeFaces.widgets) return [];
    const widgets = [];
    for (const [varName, widget] of Object.entries(PrimeFaces.widgets)) {
      if (!widget || !widget.id) continue;
      const el = document.getElementById(widget.id);
      const typeName = getWidgetType(widget);

      // Target id (si tiene)
      let targetId = null;
      if (widget.cfg) {
        targetId = widget.cfg.target || widget.cfg.targetId || null;
      }
      // También buscar en atributos data-target
      if (!targetId && el) {
        targetId = el.getAttribute('data-target') || null;
      }

      widgets.push({
        widgetVar: varName,
        id: widget.id,
        type: typeName,
        clientAPI: getClientAPI(widget),
        targetId: targetId,
        events: el ? extractEvents(el) : [],
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
      // Notificar al content script los IDs procesados y actualizados
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

    // Interceptar también el response para detectar updates reales
    if (PrimeFaces.ajax && PrimeFaces.ajax.Response) {
      const origHandle = PrimeFaces.ajax.Response.handle;
      if (origHandle && !PrimeFaces.ajax.Response.__pfInspectorHooked) {
        PrimeFaces.ajax.Response.__pfInspectorHooked = true;
        PrimeFaces.ajax.Response.handle = function (xml, status, xhr, updateHandler) {
          // Extraer IDs de las actualizaciones del XML
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
      const widgets = collectWidgets();
      window.postMessage({ type: 'PF_INSPECTOR_DATA', data: widgets }, '*');
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
            window.postMessage({ type: 'PF_INSPECTOR_EXEC_RESULT', data: { success: false, widgetVar, method, error: 'Método no encontrado' } }, '*');
          }
        } else {
          window.postMessage({ type: 'PF_INSPECTOR_EXEC_RESULT', data: { success: false, widgetVar, method, error: 'Widget no encontrado' } }, '*');
        }
      } catch (e) {
        window.postMessage({ type: 'PF_INSPECTOR_EXEC_RESULT', data: { success: false, widgetVar, method, error: e.message } }, '*');
      }
    }
  });

  // Auto-hookear si PrimeFaces ya existe
  if (typeof PrimeFaces !== 'undefined') {
    hookAjax();
  }

  window.postMessage({ type: 'PF_INSPECTOR_READY' }, '*');
})();
