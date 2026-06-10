import { state } from '../core/state.js';
import { highlightElement, clearHighlight } from '../core/highlights.js';
import { cssEsc } from './utils.js';

function findWidgetForElement(el) {
  let current = el;
  while (current && current !== document.body) {
    if (current.id) {
      const widget = state.widgetsData.find(w => w.id === current.id);
      if (widget) return widget;
    }
    current = current.parentElement;
  }
  return null;
}

function highlightCardInList(widgetVar) {
  if (!state.panelEl) return;
  const prev = state.panelEl.querySelector('.pfi-card-selected');
  if (prev) prev.classList.remove('pfi-card-selected');
  const card = state.panelEl.querySelector(`.pfi-card[data-widget-var="${cssEsc(widgetVar)}"]`);
  if (card) {
    card.classList.add('pfi-card-selected');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function onSelectionMouseOver(e) {
  if (state.panelEl && state.panelEl.contains(e.target)) return;
  const widget = findWidgetForElement(e.target);
  if (widget) { highlightElement(widget.id); highlightCardInList(widget.widgetVar); }
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
  if (e.key === 'Escape') deactivateSelectionMode();
}

let selectionCallbacks = {};

export function activateSelectionMode(callbacks) {
  selectionCallbacks = callbacks || {};
  state.selectionMode = true;
  const btn = state.panelEl && state.panelEl.querySelector('#pfi-btn-select');
  if (btn) btn.classList.add('pfi-btn-active');

  state.widgetsData.forEach(w => {
    const el = document.getElementById(w.id);
    if (el && !(state.panelEl && state.panelEl.contains(el))) {
      el.classList.add('pfi-selection-candidate');
    }
  });

  document.addEventListener('mouseover', onSelectionMouseOver, true);
  document.addEventListener('mouseout',  onSelectionMouseOut,  true);
  document.addEventListener('click',     onSelectionClick,     true);
  document.addEventListener('keydown',   onSelectionKeyDown,   true);
}

export function deactivateSelectionMode() {
  state.selectionMode = false;
  const btn = state.panelEl && state.panelEl.querySelector('#pfi-btn-select');
  if (btn) btn.classList.remove('pfi-btn-active');

  document.querySelectorAll('.pfi-selection-candidate').forEach(el => el.classList.remove('pfi-selection-candidate'));
  if (state.panelEl) {
    const sel = state.panelEl.querySelector('.pfi-card-selected');
    if (sel) sel.classList.remove('pfi-card-selected');
  }
  clearHighlight();

  document.removeEventListener('mouseover', onSelectionMouseOver, true);
  document.removeEventListener('mouseout',  onSelectionMouseOut,  true);
  document.removeEventListener('click',     onSelectionClick,     true);
  document.removeEventListener('keydown',   onSelectionKeyDown,   true);
}

export function toggleSelectionMode(callbacks) {
  if (state.selectionMode) deactivateSelectionMode(); else activateSelectionMode(callbacks);
}
