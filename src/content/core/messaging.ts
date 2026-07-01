import { state } from './state.js';
import { config } from './config.js';
import {
  collectMessage,
  execApiMessage,
  execEventMessage,
  postInspectorMessage,
} from '../../shared/messages.js';
import type { ExecResult } from '../../shared/types.js';

export function requestWidgets(): void {
  postInspectorMessage(collectMessage(!!config.showJqueryEvents));
}

export function executeWidgetAction(
  widgetVar: string,
  method: string,
  args?: unknown[],
  callback?: (data: ExecResult) => void
): void {
  const callId = 'c' + (++state.callSeq);
  if (typeof callback === 'function') {
    state.pendingResultCallbacks.set(callId, callback);
    setTimeout(() => state.pendingResultCallbacks.delete(callId), 10000);
  }
  postInspectorMessage(execApiMessage(widgetVar, method, Array.isArray(args) ? args : [], callId));
}

export function executeInlineEvent(
  ownerId: string,
  eventAttr: string,
  widgetVar: string | null
): void {
  postInspectorMessage(execEventMessage(ownerId, eventAttr, widgetVar));
}

export function injectPageScript(): void {
  if (document.getElementById('pf-inspector-page-script')) return;
  const s = document.createElement('script');
  s.id = 'pf-inspector-page-script';
  s.src = chrome.runtime.getURL('dist/inject/pageScript.js');
  (document.head || document.documentElement).appendChild(s);
}
