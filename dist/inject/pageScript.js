"use strict";
(() => {
  // src/shared/messages.ts
  var MSG = {
    /** content → page: recolectar widgets */
    COLLECT: "PF_INSPECTOR_COLLECT",
    /** page → content: datos de widgets + info de la página */
    DATA: "PF_INSPECTOR_DATA",
    /** page → content: interceptada una llamada PrimeFaces.ab() */
    AJAX: "PF_INSPECTOR_AJAX",
    /** page → content: ids actualizados en una respuesta Ajax */
    UPDATE: "PF_INSPECTOR_UPDATE",
    /** content → page: ejecutar un método del Client API */
    EXEC_API: "PF_INSPECTOR_EXEC_API",
    /** content → page: disparar un evento inline (atributo on*) */
    EXEC_EVENT: "PF_INSPECTOR_EXEC_EVENT",
    /** page → content: resultado de EXEC_API / EXEC_EVENT */
    EXEC_RESULT: "PF_INSPECTOR_EXEC_RESULT",
    /** content → page: instalar los hooks de Ajax sin recolectar */
    HOOK_AJAX: "PF_INSPECTOR_HOOK_AJAX",
    /** page → content: el page script está cargado */
    READY: "PF_INSPECTOR_READY"
  };
  function dataMessage(data, info) {
    return { type: MSG.DATA, data, info };
  }
  function ajaxMessage(data) {
    return { type: MSG.AJAX, data };
  }
  function updateMessage(updatedIds) {
    return { type: MSG.UPDATE, data: updatedIds };
  }
  function execResultMessage(data) {
    return { type: MSG.EXEC_RESULT, data };
  }
  function readyMessage() {
    return { type: MSG.READY };
  }
  function postInspectorMessage(msg) {
    window.postMessage(msg, "*");
  }

  // inject/pageScript.js
  (function() {
    "use strict";
    function decodeHtmlEntities(str) {
      const txt = document.createElement("textarea");
      txt.innerHTML = str;
      return txt.value;
    }
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
      s: { name: "source", desc: "ID del componente origen del evento" },
      f: { name: "formId", desc: "ID del formulario que envuelve la petici\xF3n" },
      p: { name: "process", desc: "IDs de componentes a procesar en el servidor (process)" },
      u: { name: "update", desc: "IDs de componentes a actualizar en el cliente (update)" },
      e: { name: "event", desc: "Nombre del evento que dispara la petici\xF3n" },
      a: { name: "async", desc: "Si la petici\xF3n es as\xEDncrona" },
      g: { name: "global", desc: "Si activa listeners globales de Ajax" },
      d: { name: "delay", desc: "Retardo en ms antes de enviar la petici\xF3n" },
      t: { name: "timeout", desc: "Timeout en ms para la petici\xF3n" },
      sc: { name: "skipChildren", desc: "Omite el procesamiento de hijos" },
      iau: { name: "ignoreAutoUpdate", desc: "Ignora componentes con autoUpdate" },
      ps: { name: "partialSubmit", desc: "Env\xEDa solo los campos de los componentes procesados" },
      psf: { name: "partialSubmitFilter", desc: "Filtro CSS para partial submit" },
      fi: { name: "fragmentId", desc: "ID del fragmento" },
      fu: { name: "fragmentUpdate", desc: "Actualizaci\xF3n de fragmento" },
      pa: { name: "params", desc: "Par\xE1metros extra enviados al servidor" },
      onst: { name: "onstart", desc: "Callback ejecutado antes de la petici\xF3n" },
      oner: { name: "onerror", desc: "Callback ejecutado si hay error" },
      onsu: { name: "onsuccess", desc: "Callback ejecutado si la petici\xF3n fue exitosa" },
      onco: { name: "oncomplete", desc: "Callback ejecutado al finalizar la petici\xF3n" }
    };
    function fnToSnippet(fn) {
      try {
        const src = Function.prototype.toString.call(fn);
        return src.replace(/\s+/g, " ").slice(0, 400);
      } catch (e) {
        return "[function]";
      }
    }
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
          source: "inline",
          event: attr.name,
          raw: attr.value,
          parsedParams: detail,
          ownerId: ownerId || (el.id || null)
        });
      }
      return out;
    }
    function extractEvents(el, includeJquery) {
      if (!el) return [];
      let events = [];
      events = events.concat(extractInlineEventsOf(el, el.id || null));
      try {
        const desc = el.querySelectorAll("input, select, textarea, button, a, [onclick], [onchange], [onkeyup], [onkeydown], [onkeypress], [onfocus], [onblur], [onsubmit], [oninput], [onmouseover], [onmouseout]");
        desc.forEach((child) => {
          if (child === el) return;
          events = events.concat(extractInlineEventsOf(child, child.id || el.id || null));
        });
      } catch (e) {
      }
      if (!includeJquery) return events;
      try {
        const jq = window.jQuery || window.$;
        if (jq && typeof jq._data === "function") {
          const data = jq._data(el, "events");
          if (data && typeof data === "object") {
            for (const evName of Object.keys(data)) {
              const handlers = data[evName] || [];
              handlers.forEach((h, idx) => {
                const ns = h.namespace ? "." + h.namespace : "";
                const selector = h.selector ? " (delegated: " + h.selector + ")" : "";
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
                  source: "jquery",
                  event: evName + ns + selector + (handlers.length > 1 ? " #" + (idx + 1) : ""),
                  raw,
                  parsedParams: detail,
                  ownerId: el.id || null
                });
              });
            }
          }
        }
      } catch (e) {
      }
      return events;
    }
    function getWidgetType(widget) {
      if (!widget) return "Unknown";
      if (typeof PrimeFaces !== "undefined" && PrimeFaces.widget) {
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
      if (fallback && fallback !== "Object" && fallback.length > 1) {
        return fallback;
      }
      return widget.cfg && widget.cfg.widgetVar || "Unknown";
    }
    function getClientAPI(widget) {
      if (!widget) return [];
      const methods = [];
      const seen = /* @__PURE__ */ new Set();
      const BLACKLIST = /* @__PURE__ */ new Set([
        "constructor",
        "init",
        "initialize",
        "_init",
        "destroy",
        "cleanup",
        "remove",
        "destruct",
        "render",
        "create",
        "getBehavior",
        "callBehavior",
        "hasBehavior",
        "bindEvents",
        "unbindEvents",
        "setupEvents",
        "getJQ",
        "getId"
      ]);
      let proto = Object.getPrototypeOf(widget);
      while (proto && proto.constructor && proto.constructor.name !== "Object") {
        for (const key of Object.getOwnPropertyNames(proto)) {
          if (key === "constructor") continue;
          if (key.startsWith("_")) continue;
          if (seen.has(key)) continue;
          try {
            const v = proto[key];
            if (typeof v === "function") {
              seen.add(key);
              const arity = v.length;
              const callable = arity === 0 && !BLACKLIST.has(key);
              methods.push({ name: key, arity, callable });
            }
          } catch (e) {
          }
        }
        proto = Object.getPrototypeOf(proto);
      }
      methods.sort((a, b) => a.name.localeCompare(b.name));
      return methods;
    }
    function findPrimaryInput(el) {
      if (!el) return null;
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return el;
      const candidates = el.querySelectorAll("input, select, textarea");
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (c.type === "hidden") continue;
        for (let j = 0; j < c.attributes.length; j++) {
          if (c.attributes[j].name.indexOf("data-p-") === 0) return c;
        }
      }
      for (let i = 0; i < candidates.length; i++) {
        if (candidates[i].type !== "hidden") return candidates[i];
      }
      return null;
    }
    function coerceAttr(v) {
      if (v === null || v === void 0) return null;
      if (v === "") return "";
      if (v === "true") return true;
      if (v === "false") return false;
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
    function readDomAttributes(el) {
      const result = {};
      const input = findPrimaryInput(el);
      if (!input) return result;
      const HTML_ATTRS = ["maxlength", "minlength", "pattern", "min", "max", "step", "placeholder", "type"];
      HTML_ATTRS.forEach((name) => {
        if (input.hasAttribute(name)) {
          result[name] = coerceAttr(input.getAttribute(name));
        }
      });
      const DATA_P_MAP = {
        "data-p-maxlength": "maxlength",
        "data-p-minlength": "minlength",
        "data-p-regex": "pattern",
        "data-p-val": "validator",
        "data-p-vmsg": "validatorMsg",
        "data-p-label": "label",
        "data-p-required": "required",
        "data-p-min": "min",
        "data-p-max": "max",
        "data-p-rmsg": "requiredMsg"
      };
      for (let i = 0; i < input.attributes.length; i++) {
        const attr = input.attributes[i];
        if (attr.name.indexOf("data-p-") !== 0) continue;
        const mapped = DATA_P_MAP[attr.name];
        if (mapped) {
          result[mapped] = coerceAttr(attr.value);
        } else {
          const cleanName = attr.name.replace(/^data-p-/, "p_");
          result[cleanName] = coerceAttr(attr.value);
        }
      }
      return result;
    }
    function extractMetadata(widget, el) {
      const meta = {};
      const cfg = widget && widget.cfg || {};
      let disabled = null;
      if (typeof cfg.disabled === "boolean") disabled = cfg.disabled;
      if (el) {
        if (el.hasAttribute && el.hasAttribute("disabled")) disabled = true;
        const innerInput = el.querySelector && el.querySelector("input,select,textarea,button");
        if (innerInput && innerInput.disabled) disabled = true;
        if (el.classList && (el.classList.contains("ui-state-disabled") || el.getAttribute("aria-disabled") === "true")) {
          if (disabled === null) disabled = true;
        }
      }
      if (disabled !== null) meta.disabled = disabled;
      if (typeof cfg.readonly === "boolean") meta.readonly = cfg.readonly;
      if (el) {
        const innerInput = el.querySelector && el.querySelector("input,textarea,select");
        if (innerInput && innerInput.readOnly) meta.readonly = true;
      }
      if (typeof cfg.required === "boolean") meta.required = cfg.required;
      if (el) {
        const innerInput = el.querySelector && el.querySelector("input,textarea,select");
        if (innerInput && innerInput.required) meta.required = true;
        if (el.getAttribute && el.getAttribute("aria-required") === "true") meta.required = true;
      }
      const INTERESTING_CFG_KEYS = [
        "value",
        "defaultValue",
        "min",
        "max",
        "minlength",
        "maxlength",
        "step",
        "placeholder",
        "pattern",
        "multiple",
        "editable",
        "filter",
        "filterMatchMode",
        "selectionMode",
        "paginator",
        "rows",
        "rowsPerPageTemplate",
        "lazy",
        "liveScroll",
        "scrollable",
        "scrollHeight",
        "scrollWidth",
        "autoUpdate",
        "global",
        "partialSubmit",
        "process",
        "update",
        "event",
        "modal",
        "draggable",
        "resizable",
        "closable",
        "closeOnEscape",
        "width",
        "height",
        "position",
        "dateFormat",
        "showTime",
        "showSeconds",
        "timeOnly",
        "mode",
        "selectOtherMonths",
        "currencySymbol",
        "decimalSeparator",
        "thousandSeparator",
        "decimalPlaces",
        "symbol",
        "orientation",
        "dropdownMode",
        "forceSelection",
        "unique",
        "cache",
        "showHeader",
        "showFooter",
        "effect",
        "effectSpeed",
        "maxFileSize",
        "allowTypes",
        "fileLimit",
        "target",
        "targetId",
        "url"
      ];
      INTERESTING_CFG_KEYS.forEach((k) => {
        if (cfg.hasOwnProperty(k) && typeof cfg[k] !== "function" && typeof cfg[k] !== "object") {
          meta[k] = cfg[k];
        } else if (cfg.hasOwnProperty(k) && cfg[k] !== null && typeof cfg[k] === "object" && !Array.isArray(cfg[k])) {
          try {
            meta[k] = JSON.stringify(cfg[k]).slice(0, 80);
          } catch (e) {
          }
        } else if (cfg.hasOwnProperty(k) && Array.isArray(cfg[k])) {
          meta[k] = "[" + cfg[k].length + " items]";
        }
      });
      if (el) {
        const cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if (cs) {
          meta.visible = !(cs.display === "none" || cs.visibility === "hidden");
        }
      }
      if (el) {
        const domAttrs = readDomAttributes(el);
        Object.keys(domAttrs).forEach((k) => {
          if (meta[k] === void 0 || meta[k] === null || meta[k] === "") {
            meta[k] = domAttrs[k];
          }
        });
      }
      return meta;
    }
    function serializeResult(ret) {
      if (ret === void 0) return { hasResult: false, result: "" };
      try {
        if (ret === null) return { hasResult: true, result: "null" };
        if (typeof ret === "string") return { hasResult: true, result: ret };
        if (typeof ret === "number" || typeof ret === "boolean") {
          return { hasResult: true, result: String(ret) };
        }
        if (Array.isArray(ret)) {
          try {
            const json = JSON.stringify(ret);
            if (json.length <= 400) return { hasResult: true, result: json };
          } catch (e) {
          }
          return { hasResult: true, result: "[" + ret.length + " items]" };
        }
        if (ret && ret.jquery) {
          const ids = [];
          for (let i = 0; i < ret.length && i < 5; i++) {
            ids.push(ret[i].id || ret[i].tagName);
          }
          return { hasResult: true, result: "jQuery(" + ret.length + ")" + (ids.length ? " [" + ids.join(", ") + "]" : "") };
        }
        if (typeof ret === "object") {
          if (ret.nodeType && ret.tagName) {
            return { hasResult: true, result: "<" + ret.tagName.toLowerCase() + (ret.id ? ' id="' + ret.id + '"' : "") + ">" };
          }
          try {
            const json = JSON.stringify(ret);
            if (json && json.length > 800) return { hasResult: true, result: json.slice(0, 800) + "\u2026" };
            return { hasResult: true, result: json || "[object]" };
          } catch (e) {
            return { hasResult: true, result: "[object]" };
          }
        }
        return { hasResult: true, result: String(ret) };
      } catch (e) {
        return { hasResult: true, result: "[unserializable]" };
      }
    }
    function detectPrimeFacesVersion() {
      if (typeof PrimeFaces === "undefined") return null;
      const v = PrimeFaces.VERSION || PrimeFaces.version || null;
      if (v) return String(v);
      try {
        const scripts = document.getElementsByTagName("script");
        for (let i = 0; i < scripts.length; i++) {
          const src = scripts[i].src || "";
          if (/primefaces-extensions|primefaces\.extensions/i.test(src)) continue;
          const m = src.match(/primefaces[^/]*?[?&]v=([^&"' ]+)/i);
          if (m) return m[1];
          const m2 = src.match(/primefaces[/-](\d+\.\d+(?:\.\d+)?)/i);
          if (m2) return m2[1];
        }
      } catch (e) {
      }
      return "unknown";
    }
    function detectPrimeFacesExtVersion() {
      try {
        if (typeof PrimeFacesExt !== "undefined") {
          const v = PrimeFacesExt.VERSION || PrimeFacesExt.version || null;
          return { present: true, version: v ? String(v) : "unknown" };
        }
      } catch (e) {
      }
      try {
        if (typeof PrimeFaces !== "undefined" && PrimeFaces.ext) {
          const v = PrimeFaces.ext.VERSION || PrimeFaces.ext.version || null;
          return { present: true, version: v ? String(v) : "unknown" };
        }
      } catch (e) {
      }
      try {
        const scripts = document.getElementsByTagName("script");
        for (let i = 0; i < scripts.length; i++) {
          const src = scripts[i].src || "";
          if (/primefaces-extensions|primefaces\.extensions|\/pe\//i.test(src)) {
            const m = src.match(/[?&]v=([^&"' ]+)/);
            if (m) return { present: true, version: m[1] };
            const m2 = src.match(/extensions[/-](\d+\.\d+(?:\.\d+)?)/i);
            if (m2) return { present: true, version: m2[1] };
            return { present: true, version: "unknown" };
          }
        }
      } catch (e) {
      }
      try {
        if (typeof PrimeFaces !== "undefined" && PrimeFaces.widget) {
          const peClues = [
            "ExtTimeline",
            "ExtTooltip",
            "ExtKeyFilter",
            "ExtMasterDetail",
            "ExtBlockUI",
            "ExtKnob",
            "ExtLayout",
            "ExtCodeMirror",
            "ExtInputNumber",
            "ExtInputPhone",
            "ExtCkEditor",
            "ExtTinymce",
            "ExtLightSwitch"
          ];
          for (const name of peClues) {
            if (PrimeFaces.widget[name]) return { present: true, version: "unknown" };
          }
        }
      } catch (e) {
      }
      return { present: false, version: null };
    }
    function getPageInfo() {
      const hasPF = typeof PrimeFaces !== "undefined";
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
    function collectWidgets(opts) {
      const includeJquery = !!(opts && opts.showJqueryEvents);
      if (typeof PrimeFaces === "undefined" || !PrimeFaces.widgets) return [];
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
          targetId = el.getAttribute("data-target") || null;
        }
        widgets.push({
          widgetVar: varName,
          id: widget.id,
          type: typeName,
          clientAPI: getClientAPI(widget),
          targetId,
          events: el ? extractEvents(el, includeJquery) : [],
          metadata: extractMetadata(widget, el),
          exists: !!el
        });
      }
      return widgets;
    }
    function hookAjax() {
      if (typeof PrimeFaces === "undefined") return;
      if (PrimeFaces.__pfInspectorHooked) return;
      PrimeFaces.__pfInspectorHooked = true;
      const originalAb = PrimeFaces.ab;
      PrimeFaces.ab = function(cfg, ext) {
        try {
          const info = {
            source: cfg.s || cfg.source || null,
            formId: cfg.f || cfg.formId || null,
            process: cfg.p || cfg.process || null,
            update: cfg.u || cfg.update || null
          };
          postInspectorMessage(ajaxMessage(info));
        } catch (e) {
        }
        return originalAb.apply(this, arguments);
      };
      if (PrimeFaces.ajax && PrimeFaces.ajax.Response) {
        const origHandle = PrimeFaces.ajax.Response.handle;
        if (origHandle && !PrimeFaces.ajax.Response.__pfInspectorHooked) {
          PrimeFaces.ajax.Response.__pfInspectorHooked = true;
          PrimeFaces.ajax.Response.handle = function(xml, status, xhr, updateHandler) {
            try {
              if (xml && xml.getElementsByTagName) {
                const updates = xml.getElementsByTagName("update");
                const updatedIds = [];
                for (let i = 0; i < updates.length; i++) {
                  const uid = updates[i].getAttribute("id");
                  if (uid) updatedIds.push(uid);
                }
                if (updatedIds.length > 0) {
                  postInspectorMessage(updateMessage(updatedIds));
                }
              }
            } catch (e) {
            }
            return origHandle.apply(this, arguments);
          };
        }
      }
    }
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data && event.data.type === MSG.COLLECT) {
        hookAjax();
        const widgets = collectWidgets({ showJqueryEvents: !!event.data.showJqueryEvents });
        const info = getPageInfo();
        postInspectorMessage(dataMessage(widgets, info));
      }
      if (event.data && event.data.type === MSG.HOOK_AJAX) {
        hookAjax();
      }
      if (event.data && event.data.type === MSG.EXEC_API) {
        const { widgetVar, method, args, callId } = event.data;
        try {
          if (typeof PrimeFaces !== "undefined" && PrimeFaces.widgets && PrimeFaces.widgets[widgetVar]) {
            const widget = PrimeFaces.widgets[widgetVar];
            if (typeof widget[method] === "function") {
              const callArgs = Array.isArray(args) ? args : [];
              const ret = widget[method].apply(widget, callArgs);
              const ser = serializeResult(ret);
              postInspectorMessage(execResultMessage({
                success: true,
                widgetVar,
                method,
                hasResult: ser.hasResult,
                result: ser.result,
                callId: callId || null,
                argsCount: callArgs.length
              }));
            } else {
              postInspectorMessage(execResultMessage({ success: false, widgetVar, method, error: "Method not found", callId: callId || null }));
            }
          } else {
            postInspectorMessage(execResultMessage({ success: false, widgetVar, method, error: "Widget not found", callId: callId || null }));
          }
        } catch (e) {
          postInspectorMessage(execResultMessage({ success: false, widgetVar, method, error: e.message, callId: callId || null }));
        }
      }
      if (event.data && event.data.type === MSG.EXEC_EVENT) {
        const { ownerId, eventAttr, widgetVar } = event.data;
        try {
          const el = ownerId ? document.getElementById(ownerId) : null;
          if (!el) {
            postInspectorMessage(execResultMessage({ success: false, widgetVar: widgetVar || ownerId, method: eventAttr, error: "Element not found: " + ownerId }));
            return;
          }
          const evName = (eventAttr || "").replace(/^on/i, "");
          const fn = el[eventAttr];
          if (typeof fn === "function") {
            fn.call(el, new Event(evName, { bubbles: true, cancelable: true }));
            postInspectorMessage(execResultMessage({ success: true, widgetVar: widgetVar || ownerId, method: eventAttr + "()" }));
            return;
          }
          let ev;
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
          postInspectorMessage(execResultMessage({ success: true, widgetVar: widgetVar || ownerId, method: eventAttr + " dispatched" }));
        } catch (e) {
          postInspectorMessage(execResultMessage({ success: false, widgetVar: widgetVar || ownerId, method: eventAttr, error: e.message }));
        }
      }
    });
    if (typeof PrimeFaces !== "undefined") {
      hookAjax();
    }
    postInspectorMessage(readyMessage());
  })();
})();
