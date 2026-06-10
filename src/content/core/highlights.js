import { state } from './state.js';
import { config } from './config.js';

export function clearHighlight() {
  if (state.currentHighlight) {
    state.currentHighlight.classList.remove('pfi-highlight-hover');
    state.currentHighlight = null;
  }
}

export function highlightElement(id) {
  clearHighlight();
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('pfi-highlight-hover');
    state.currentHighlight = el;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

export function clearTargetHighlight() {
  if (state.currentTargetHighlight) {
    state.currentTargetHighlight.classList.remove('pfi-highlight-target');
    state.currentTargetHighlight = null;
  }
}

export function highlightTarget(id) {
  clearTargetHighlight();
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('pfi-highlight-target');
    state.currentTargetHighlight = el;
  }
}

export function highlightEventRow(value) {
  clearEventRowHighlights();
  if (!value) return;
  const ids = String(value).split(/[\s,;]+/);
  ids.forEach(rawId => {
    const id = rawId && rawId.trim();
    if (!id || id.startsWith('@')) return;
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('pfi-highlight-target');
      state.eventRowHighlights.push(el);
    }
  });
  if (state.eventRowHighlights.length > 0) {
    state.eventRowHighlights[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

export function clearEventRowHighlights() {
  state.eventRowHighlights.forEach(el => el.classList.remove('pfi-highlight-target'));
  state.eventRowHighlights = [];
}

export function flashElement(el, className, durationMs) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), durationMs || 800);
}

export function handleAjaxProcess(data) {
  if (!config.highlightProcess || !data) return;
  const ids = (data.process || '').split(/\s+/);
  ids.forEach(id => {
    if (id.startsWith('@')) return;
    const el = document.getElementById(id);
    if (el) flashElement(el, 'pfi-highlight-process', 800);
  });
}

export function handleAjaxUpdate(updatedIds) {
  if (!config.highlightUpdates || !Array.isArray(updatedIds)) return;
  updatedIds.forEach(id => {
    if (id === 'javax.faces.ViewState' || id === 'javax.faces.ViewRoot') return;
    const el = document.getElementById(id);
    if (el) flashElement(el, 'pfi-highlight-update', 800);
  });
}
