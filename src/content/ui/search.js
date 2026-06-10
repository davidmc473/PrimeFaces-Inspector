import { state } from '../core/state.js';
import { t } from '../core/i18n.js';
import { icon } from './icons.js';
import { escAttr, escHtml } from './utils.js';
import { applyFilters, renderList, renderFilterDropdown } from './widget-list.js';

export function buildSearchBar(callbacks) {
  const toolbar = document.createElement('div');
  toolbar.className = 'pfi-toolbar';
  toolbar.innerHTML = `
    <div class="pfi-search-wrap">
      <span class="pfi-search-icon">${icon('search', 13)}</span>
      <input type="text" class="pfi-search" id="pfi-search"
        placeholder="${escAttr(t('searchPlaceholder'))}"
        autocomplete="off" spellcheck="false">
    </div>
    <div class="pfi-multi-filter" id="pfi-multi-filter">
      <button type="button" class="pfi-filter-btn" id="pfi-filter-btn"
        title="${escAttr(t('filterButton'))}">
        <span id="pfi-filter-label">${escHtml(t('filterAll'))}</span>
        ${icon('filter', 11)}
      </button>
      <div class="pfi-filter-dropdown" id="pfi-filter-dropdown" hidden>
        <div class="pfi-filter-list" id="pfi-filter-list"></div>
        <div class="pfi-filter-footer">
          <button type="button" class="pfi-ghost-btn" id="pfi-filter-clear">${escHtml(t('filterClear'))}</button>
        </div>
      </div>
    </div>
  `;
  return toolbar;
}

export function wireSearchEvents(panelEl, callbacks) {
  const searchInput    = panelEl.querySelector('#pfi-search');
  const filterBtn      = panelEl.querySelector('#pfi-filter-btn');
  const filterDropdown = panelEl.querySelector('#pfi-filter-dropdown');
  const filterClear    = panelEl.querySelector('#pfi-filter-clear');

  searchInput.addEventListener('input', (e) => {
    state.searchTerm = e.target.value.toLowerCase().trim();
    applyFilters();
    renderList(callbacks);
  });

  filterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    filterDropdown.hidden = !filterDropdown.hidden;
    if (!filterDropdown.hidden) renderFilterDropdown(callbacks);
  });

  document.addEventListener('click', (e) => {
    if (!panelEl) return;
    if (!filterDropdown.hidden && !filterDropdown.contains(e.target) && e.target !== filterBtn) {
      filterDropdown.hidden = true;
    }
  });

  filterClear.addEventListener('click', () => {
    state.selectedTypes.clear();
    renderFilterDropdown(callbacks);
    const lbl = panelEl.querySelector('#pfi-filter-label');
    if (lbl) lbl.textContent = t('filterAll');
    applyFilters();
    renderList(callbacks);
  });
}
