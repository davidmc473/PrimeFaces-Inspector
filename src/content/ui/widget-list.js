import { state } from '../core/state.js';
import { config, saveConfig } from '../core/config.js';
import { t } from '../core/i18n.js';
import { icon, getComponentIcon } from './icons.js';
import { escHtml, escAttr } from './utils.js';
import { buildCard, expandCard, collapseCard } from './widget-card.js';

export function applyFilters() {
  state.filteredData = state.widgetsData.filter(w => {
    const matchesSearch = !state.searchTerm ||
      w.widgetVar.toLowerCase().includes(state.searchTerm) ||
      w.id.toLowerCase().includes(state.searchTerm) ||
      w.type.toLowerCase().includes(state.searchTerm) ||
      (() => { const el = document.getElementById(w.id); return el ? el.textContent.toLowerCase().includes(state.searchTerm) : false; })();
    const matchesType = state.selectedTypes.size === 0 || state.selectedTypes.has(w.type);
    return matchesSearch && matchesType;
  });
}

function getUniqueTypes() {
  const types = new Set();
  state.widgetsData.forEach(w => types.add(w.type));
  return Array.from(types).sort();
}

export function renderFilterDropdown(callbacks) {
  const listEl = state.panelEl && state.panelEl.querySelector('#pfi-filter-list');
  if (!listEl) return;
  const types = getUniqueTypes();
  if (types.length === 0) {
    listEl.innerHTML = `<div class="pfi-filter-empty">—</div>`;
    return;
  }
  listEl.innerHTML = types.map(type => {
    const checked = state.selectedTypes.has(type) ? 'checked' : '';
    return `<label class="pfi-filter-row">
      <input type="checkbox" value="${escAttr(type)}" ${checked}>
      <span>${getComponentIcon(type, 14)} ${escHtml(type)}</span>
    </label>`;
  }).join('');
  listEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.selectedTypes.add(cb.value); else state.selectedTypes.delete(cb.value);
      updateFilterLabel();
      applyFilters();
      renderList(callbacks);
    });
  });
}

function updateFilterLabel() {
  const lbl = state.panelEl && state.panelEl.querySelector('#pfi-filter-label');
  if (!lbl) return;
  if (state.selectedTypes.size === 0) lbl.textContent = t('filterAll');
  else if (state.selectedTypes.size === 1) lbl.textContent = Array.from(state.selectedTypes)[0];
  else lbl.textContent = t('filterMulti', state.selectedTypes.size);
}

export function renderList(callbacks) {
  const listEl = state.panelEl && state.panelEl.querySelector('#pfi-list');
  const countEl = state.panelEl && state.panelEl.querySelector('#pfi-count');
  if (!listEl) return;

  if (countEl) countEl.textContent = `${state.filteredData.length}/${state.widgetsData.length}`;

  const existingTypes = new Set(getUniqueTypes());
  Array.from(state.selectedTypes).forEach(ty => { if (!existingTypes.has(ty)) state.selectedTypes.delete(ty); });
  renderFilterDropdown(callbacks);
  updateFilterLabel();

  listEl.innerHTML = '';
  if (state.filteredData.length === 0) {
    listEl.innerHTML = `<div class="pfi-empty">${escHtml(t('noWidgets'))}</div>`;
    return;
  }

  const cardCallbacks = {
    toggleCard: (widgetVar) => {
      if (config.detailWidgetVar === widgetVar) {
        collapseCard(state.panelEl, widgetVar);
        config.detailWidgetVar = null;
        saveConfig();
      } else {
        if (config.detailWidgetVar) collapseCard(state.panelEl, config.detailWidgetVar);
        expandCard(state.panelEl, state.widgetsData, widgetVar, false, callbacks);
        config.detailWidgetVar = widgetVar;
        saveConfig();
      }
    },
    ...callbacks,
  };

  state.filteredData.forEach(w => listEl.appendChild(buildCard(w, cardCallbacks)));

  if (config.detailWidgetVar) {
    const visible = state.filteredData.some(x => x.widgetVar === config.detailWidgetVar);
    if (visible) {
      expandCard(state.panelEl, state.widgetsData, config.detailWidgetVar, false, callbacks);
    } else {
      config.detailWidgetVar = null;
      saveConfig();
    }
  }
}

export { updateFilterLabel };
