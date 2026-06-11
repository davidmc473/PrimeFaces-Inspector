import { state } from '../core/state.js';

/* Tooltips personalizados: sustituyen al tooltip nativo del atributo title
   por uno con estilos del panel. El texto original se traslada a
   data-pfi-tip para evitar que el navegador muestre el tooltip nativo. */

let tipEl = null;
let currentTarget = null;

function ensureTip() {
  if (tipEl && tipEl.isConnected) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'pfi-tooltip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.hidden = true;
  state.panelEl.appendChild(tipEl);
  return tipEl;
}

function tipText(target) {
  let text = target.getAttribute('data-pfi-tip');
  if (!text) {
    const title = target.getAttribute('title');
    if (title) {
      target.setAttribute('data-pfi-tip', title);
      target.removeAttribute('title');
      text = title;
    }
  }
  return text;
}

function positionTip(target, tip) {
  const panelRect = state.panelEl.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;

  let left = r.left - panelRect.left + r.width / 2 - tw / 2;
  left = Math.max(4, Math.min(left, panelRect.width - tw - 4));

  // Por defecto encima del elemento; si no cabe, debajo.
  let top = r.top - panelRect.top - th - 6;
  if (top < 4) top = r.bottom - panelRect.top + 6;
  top = Math.max(4, Math.min(top, panelRect.height - th - 4));

  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

function showTip(target) {
  const text = tipText(target);
  if (!text) return;
  const tip = ensureTip();
  tip.textContent = text;
  tip.hidden = false;
  positionTip(target, tip);
}

function hideTip() {
  currentTarget = null;
  if (tipEl) tipEl.hidden = true;
}

export function initTooltips(panelEl) {
  panelEl.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[title], [data-pfi-tip]');
    if (!target || !panelEl.contains(target) || target === currentTarget) return;
    if (target.classList.contains('pfi-tooltip')) return;
    currentTarget = target;
    showTip(target);
  });

  panelEl.addEventListener('mouseout', (e) => {
    if (!currentTarget) return;
    const to = e.relatedTarget;
    if (to && currentTarget.contains(to)) return;
    hideTip();
  });

  // Ocultar al hacer clic o desplazarse (el elemento puede desaparecer).
  panelEl.addEventListener('click', hideTip, true);
  panelEl.addEventListener('scroll', hideTip, true);
}
