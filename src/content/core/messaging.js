import { state } from './state.js';
import { config } from './config.js';

export function requestWidgets() {
  window.postMessage({ type: 'PF_INSPECTOR_COLLECT', showJqueryEvents: !!config.showJqueryEvents }, '*');
}

export function executeWidgetAction(widgetVar, method, args, callback) {
  const callId = 'c' + (++state.callSeq);
  if (typeof callback === 'function') {
    state.pendingResultCallbacks.set(callId, callback);
    setTimeout(() => state.pendingResultCallbacks.delete(callId), 10000);
  }
  window.postMessage({
    type: 'PF_INSPECTOR_EXEC_API',
    widgetVar, method,
    args: Array.isArray(args) ? args : [],
    callId,
  }, '*');
}

export function executeInlineEvent(ownerId, eventAttr, widgetVar) {
  window.postMessage({ type: 'PF_INSPECTOR_EXEC_EVENT', ownerId, eventAttr, widgetVar }, '*');
}

export function injectPageScript() {
  if (document.getElementById('pf-inspector-page-script')) return;
  const s = document.createElement('script');
  s.id = 'pf-inspector-page-script';
  s.src = chrome.runtime.getURL('dist/inject/pageScript.js');
  (document.head || document.documentElement).appendChild(s);
}
