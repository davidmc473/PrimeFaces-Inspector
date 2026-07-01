import { state } from '../core/state.js';
import { highlightElement, clearHighlight } from '../core/highlights.js';
import { cssEsc } from './utils.js';

let selectionCallbacks = {};
let overlayEl = null;
let lastWidgetVar = null;

export function findWidgetForElement(el) {
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

/* El panel vive en un Shadow DOM: document.elementFromPoint devuelve su
   host, no los elementos internos, así que basta con comprobar el host. */
function isPanelNode(el) {
  if (!el) return false;
  if (state.hostEl && (el === state.hostEl || state.hostEl.contains(el))) return true;
  return !!(state.panelEl && state.panelEl.contains(el));
}

/* El overlay se ignora momentáneamente para identificar el elemento real
   bajo el cursor — funciona incluso con widgets deshabilitados, que de otro
   modo no emiten eventos de ratón. */
function elementUnderPointer(x, y) {
  if (!overlayEl) return null;
  overlayEl.style.pointerEvents = 'none';
  const el = document.elementFromPoint(x, y);
  overlayEl.style.pointerEvents = 'auto';
  return el;
}

function resolveWidget(x, y) {
  const el = elementUnderPointer(x, y);
  if (!el) return null;
  if (isPanelNode(el)) return null;
  return findWidgetForElement(el);
}

function onOverlayMove(e) {
  const widget = resolveWidget(e.clientX, e.clientY);
  if (widget) {
    if (widget.widgetVar !== lastWidgetVar) {
      lastWidgetVar = widget.widgetVar;
      highlightElement(widget.id);
      highlightCardInList(widget.widgetVar);
    }
  } else if (lastWidgetVar !== null) {
    lastWidgetVar = null;
    clearHighlight();
  }
}

function onOverlayClick(e) {
  const widget = resolveWidget(e.clientX, e.clientY);
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

export function activateSelectionMode(callbacks) {
  selectionCallbacks = callbacks || {};
  state.selectionMode = true;
  lastWidgetVar = null;
  const btn = state.panelEl && state.panelEl.querySelector('#pfi-btn-select');
  if (btn) btn.classList.add('pfi-btn-active');

  state.widgetsData.forEach(w => {
    const el = document.getElementById(w.id);
    if (el && !isPanelNode(el)) {
      el.classList.add('pfi-selection-candidate');
    }
  });

  overlayEl = document.createElement('div');
  overlayEl.className = 'pfi-selection-overlay';
  document.body.appendChild(overlayEl);
  overlayEl.addEventListener('mousemove', onOverlayMove, true);
  overlayEl.addEventListener('click', onOverlayClick, true);
  document.addEventListener('keydown', onSelectionKeyDown, true);
}

export function deactivateSelectionMode() {
  state.selectionMode = false;
  lastWidgetVar = null;
  const btn = state.panelEl && state.panelEl.querySelector('#pfi-btn-select');
  if (btn) btn.classList.remove('pfi-btn-active');

  document.querySelectorAll('.pfi-selection-candidate').forEach(el => el.classList.remove('pfi-selection-candidate'));
  if (state.panelEl) {
    const sel = state.panelEl.querySelector('.pfi-card-selected');
    if (sel) sel.classList.remove('pfi-card-selected');
  }
  clearHighlight();

  if (overlayEl) {
    overlayEl.removeEventListener('mousemove', onOverlayMove, true);
    overlayEl.removeEventListener('click', onOverlayClick, true);
    overlayEl.remove();
    overlayEl = null;
  }
  document.removeEventListener('keydown', onSelectionKeyDown, true);
}

export function toggleSelectionMode(callbacks) {
  if (state.selectionMode) deactivateSelectionMode(); else activateSelectionMode(callbacks);
}
