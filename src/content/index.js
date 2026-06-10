import { loadConfig, config, applyDynamicColors } from './core/config.js';
import { state } from './core/state.js';
import { handleAjaxProcess, handleAjaxUpdate, flashElement } from './core/highlights.js';
import { requestWidgets } from './core/messaging.js';
import { createPanel, closePanel, refreshPanel } from './ui/panel.js';
import { showToast } from './ui/toast.js';
import { t } from './core/i18n.js';
import { toggleSelectionMode } from './ui/selection.js';

if (!window.__pfInspectorLoaded) {
  window.__pfInspectorLoaded = true;

  loadConfig(() => {
    applyDynamicColors();
    if (config.persistPanel && config.panelOpen) {
      if (document.body) createPanel();
      else document.addEventListener('DOMContentLoaded', createPanel, { once: true });
    }
    document.addEventListener('keydown', onGlobalKeyDown, true);
    document.addEventListener('keyup',   onGlobalKeyUp,   true);
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || !event.data.type) return;
    switch (event.data.type) {
      case 'PF_INSPECTOR_DATA':
        state.widgetsData = event.data.data || [];
        if (event.data.info) Object.assign(state.pageInfo, event.data.info);
        refreshPanel();
        break;
      case 'PF_INSPECTOR_AJAX':         handleAjaxProcess(event.data.data); break;
      case 'PF_INSPECTOR_UPDATE':       handleAjaxUpdate(event.data.data);  break;
      case 'PF_INSPECTOR_EXEC_RESULT':  handleExecResult(event.data.data);  break;
    }
  });

  function handleExecResult(data) {
    if (!state.panelEl) return;
    if (data.callId && state.pendingResultCallbacks.has(data.callId)) {
      const cb = state.pendingResultCallbacks.get(data.callId);
      state.pendingResultCallbacks.delete(data.callId);
      try { cb(data); } catch (e) { /* ignore */ }
      return;
    }
    if (data.success) {
      const fullResult = data.hasResult ? String(data.result == null ? '' : data.result) : '';
      let text;
      if (data.hasResult) {
        const resTxt = fullResult.length > 80 ? fullResult.slice(0, 80) + '…' : fullResult;
        text = t('execOkResult', data.widgetVar, data.method, resTxt);
      } else {
        text = t('execOk', data.widgetVar, data.method);
      }
      showToast({
        success: true, text,
        fullResult: fullResult.length > 80 ? fullResult : null,
        title: `PF('${data.widgetVar}').${data.method}()`,
      });
      setTimeout(requestWidgets, 80);
    } else {
      showToast({ success: false, text: t('execErr', data.error) });
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.action === 'togglePanel') {
      if (state.panelEl && state.panelEl.style.display !== 'none') closePanel();
      else createPanel();
      sendResponse({ ok: true });
    }
    return true;
  });

  const observer = new MutationObserver((mutations) => {
    if (!config.highlightUpdates) return;
    mutations.forEach(mut => {
      if (mut.type === 'childList') {
        mut.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.id) {
            if (state.widgetsData.some(w => w.id === node.id)) {
              flashElement(node, 'pfi-highlight-update', 800);
            }
          }
        });
      }
    });
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

  function onGlobalKeyDown(e) {
    if (!state.panelEl || state.panelEl.style.display === 'none') return;
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'Control' || e.key === 'Shift')) {
      if (!state.ctrlShiftFired) {
        state.ctrlShiftFired = true;
        toggleSelectionMode({});
      }
    }
  }
  function onGlobalKeyUp(e) {
    if (!e.ctrlKey || !e.shiftKey) state.ctrlShiftFired = false;
  }
}
