import { config } from '../core/config.js';
import { t } from '../core/i18n.js';
import { highlightTarget, clearTargetHighlight, highlightEventRow, clearEventRowHighlights } from '../core/highlights.js';
import { icon, getActionIcon } from './icons.js';
import { escHtml, escAttr } from './utils.js';
import { openApiArgForm } from './client-api-form.js';

function getActionsForType(type) {
  const actions = [];
  if (!type) return actions;
  const ty = type.toLowerCase();
  if (ty.includes('autocomplete')) actions.push('clear', 'close');
  if (ty.includes('confirmdialog') || ty.includes('dialog') || ty.includes('overlaypanel')) actions.push('show', 'hide');
  if (ty.includes('sidebar')) actions.push('show', 'hide', 'toggle');
  return actions;
}

function isActionIncompatible(name, md, isAutoComplete) {
  const n = String(name);
  if (md.disabled === true  && n === 'disable') return t('disabledAlready');
  if (md.disabled === false && n === 'enable')  return t('enabledAlready');
  if (!isAutoComplete && md.visible === true  && (n === 'show' || n === 'showAll' || n === 'open'))  return t('shownAlready');
  if (md.visible === false && (n === 'hide' || n === 'hideAll' || n === 'close')) return t('hiddenAlready');
  return null;
}

export function renderDetailHtml(w) {
  /* ── Eventos ── */
  let eventsHtml = '';
  if (w.events && w.events.length > 0) {
    eventsHtml = w.events.map((ev) => {
      let paramsHtml = '';
      if (ev.parsedParams && ev.parsedParams.length > 0) {
        paramsHtml = `
          <table class="pfi-param-table">
            <thead><tr>
              <th>${escHtml(t('thLetter'))}</th><th>${escHtml(t('thMeaning'))}</th>
              <th>${escHtml(t('thDescription'))}</th><th>${escHtml(t('thValue'))}</th>
            </tr></thead>
            <tbody>
              ${ev.parsedParams.map(p => `
                <tr class="pfi-event-row" data-value="${escAttr(p.value || '')}">
                  <td>${escHtml(p.letter)}</td><td>${escHtml(p.name)}</td>
                  <td class="pfi-param-desc">${escHtml(p.desc)}</td>
                  <td>${escHtml(p.value || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`;
      }

      const srcLabel = ev.source === 'jquery' ? t('sourceJquery') : t('sourceInline');
      let execBtn = '';
      if (ev.source === 'inline' && ev.ownerId) {
        execBtn = `<button class="pfi-event-exec-btn" data-owner-id="${escAttr(ev.ownerId)}"
          data-event-attr="${escAttr(ev.event)}" data-wvar="${escAttr(w.widgetVar)}"
          title="${escAttr(t('btnExecEvent'))}">${icon('play', 11)}</button>`;
      }
      const ownerInfo = (ev.ownerId && ev.ownerId !== w.id)
        ? `<div class="pfi-event-owner">↳ ${escHtml(ev.ownerId)}</div>` : '';

      return `
        <div class="pfi-event-block">
          <div class="pfi-event-head">
            <span class="pfi-event-name">${escHtml(ev.event)}</span>
            <span class="pfi-event-badge pfi-event-badge-${escAttr(ev.source || 'inline')}">${escHtml(srcLabel)}</span>
            ${execBtn}
          </div>
          ${ownerInfo}
          <div class="pfi-event-raw">${escHtml(ev.raw)}</div>
          ${paramsHtml}
        </div>`;
    }).join('');
  } else {
    const hint = !config.showJqueryEvents
      ? `<div class="pfi-hint pfi-hint-clickable" data-role="open-config">${escHtml(t('eventsJqueryDisabled'))}</div>`
      : '';
    eventsHtml = `<div class="pfi-events-empty">${escHtml(t('eventsEmpty'))}</div>${hint}`;
  }

  /* ── Target ── */
  let targetHtml = '';
  if (w.targetId) {
    targetHtml = `
      <div class="pfi-detail-section">
        <h4>${escHtml(t('sectionTarget'))}</h4>
        <div class="pfi-detail-row">
          <span class="pfi-detail-label">${escHtml(t('labelTargetId'))}</span>
          <span class="pfi-detail-value pfi-target-link" data-target-id="${escAttr(w.targetId)}">${escHtml(w.targetId)}</span>
        </div>
      </div>`;
  }

  /* ── Client API ── */
  const featured = getActionsForType(w.type);
  const normalizedApi = (w.clientAPI || []).map(m =>
    typeof m === 'string' ? { name: m, arity: 0, callable: true } : m
  );
  const seenAct = new Set();
  const callableMethods = [];
  featured.forEach(name => { if (!seenAct.has(name)) { seenAct.add(name); callableMethods.push(name); } });
  normalizedApi.forEach(m => { if (m.callable && !seenAct.has(m.name)) { seenAct.add(m.name); callableMethods.push(m.name); } });
  const nonCallable = normalizedApi.filter(m => !m.callable);

  const md = w.metadata || {};
  const isAutoComplete = w.type && w.type.toLowerCase().includes('autocomplete');

  let clientApiHtml = '';
  if (callableMethods.length > 0 || nonCallable.length > 0) {
    const callableGroup = callableMethods.length > 0 ? `
      <div class="pfi-actions-grid">
        ${callableMethods.map(name => {
          const reason = isActionIncompatible(name, md, isAutoComplete);
          const tooltip = "PF('" + w.widgetVar + "')." + name + '()' + (reason ? ' — ' + reason : '');
          const disabled = reason ? ' disabled aria-disabled="true"' : '';
          const cls = reason ? ' pfi-action-btn-disabled' : '';
          return `<button class="pfi-action-btn${cls}" data-action="${escAttr(name)}" data-wvar="${escAttr(w.widgetVar)}" title="${escAttr(tooltip)}"${disabled}>
            <span class="pfi-action-icon">${getActionIcon(name)}</span>${escHtml(name)}()
          </button>`;
        }).join('')}
      </div>` : '';

    const argsGroup = nonCallable.length > 0 ? `
      <div class="pfi-api-arg-methods${callableMethods.length > 0 ? ' pfi-mt' : ''}">
        ${nonCallable.map(m => `
          <button type="button" class="pfi-api-method-btn"
            data-method="${escAttr(m.name)}" data-arity="${m.arity}" data-wvar="${escAttr(w.widgetVar)}"
            title="${escAttr(t('apiOpenForm', m.name, m.arity))}">
            ${icon('terminal', 12)} ${escHtml(m.name)}<span class="pfi-arity">(${m.arity})</span>
          </button>`).join('')}
      </div>` : '';

    clientApiHtml = `
      <div class="pfi-detail-section">
        <h4>${escHtml(t('sectionClientApi'))}</h4>
        ${callableGroup}${argsGroup}
        <div class="pfi-api-form-host" data-role="api-form-host"></div>
      </div>`;
  }

  /* ── Metadata ── */
  let metaHtml = '';
  if (w.metadata && Object.keys(w.metadata).length > 0) {
    const rows = Object.keys(w.metadata).map(k => {
      const v = w.metadata[k];
      let displayVal;
      if (v === true)  displayVal = `<span class="pfi-meta-true">true</span>`;
      else if (v === false) displayVal = `<span class="pfi-meta-false">false</span>`;
      else if (v === null || v === undefined || v === '') displayVal = `<span class="pfi-meta-null">—</span>`;
      else displayVal = `<span class="pfi-meta-text">${escHtml(String(v))}</span>`;
      return `<div class="pfi-meta-cell"><span class="pfi-meta-key">${escHtml(k)}</span>${displayVal}</div>`;
    }).join('');
    metaHtml = `
      <div class="pfi-detail-section">
        <h4>${escHtml(t('sectionMetadata'))}</h4>
        <div class="pfi-meta-grid">${rows}</div>
      </div>`;
  }

  return `
    <div class="pfi-detail-section">
      <h4>${escHtml(t('sectionInfo'))}</h4>
      <div class="pfi-detail-row">
        <span class="pfi-detail-label">${escHtml(t('labelType'))}</span>
        <span class="pfi-detail-value">${escHtml(w.type)}</span>
      </div>
      <div class="pfi-detail-row">
        <span class="pfi-detail-label">${escHtml(t('labelWidgetVar'))}</span>
        <span class="pfi-detail-value pfi-mono">${escHtml(w.widgetVar)}</span>
      </div>
      <div class="pfi-detail-row">
        <span class="pfi-detail-label">${escHtml(t('labelId'))}</span>
        <span class="pfi-detail-value pfi-mono">${escHtml(w.id)}</span>
      </div>
    </div>
    ${metaHtml}
    ${targetHtml}
    ${clientApiHtml}
    <div class="pfi-detail-section">
      <h4>${escHtml(t('sectionEvents'))}</h4>
      ${eventsHtml}
    </div>`;
}

export function wireDetailEvents(detail, w, callbacks) {
  const { executeWidgetAction, executeInlineEvent, showConfig, showToast, showResultModal } = callbacks;

  const targetLink = detail.querySelector('.pfi-target-link');
  if (targetLink) {
    targetLink.addEventListener('mouseenter', () => highlightTarget(targetLink.getAttribute('data-target-id')));
    targetLink.addEventListener('mouseleave', clearTargetHighlight);
  }

  detail.querySelectorAll('.pfi-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      executeWidgetAction(btn.getAttribute('data-wvar'), btn.getAttribute('data-action'));
    });
  });

  detail.querySelectorAll('.pfi-event-exec-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      executeInlineEvent(btn.getAttribute('data-owner-id'), btn.getAttribute('data-event-attr'), btn.getAttribute('data-wvar'));
    });
    btn.addEventListener('mouseenter', () => {
      const ownerId = btn.getAttribute('data-owner-id');
      if (ownerId) highlightTarget(ownerId);
    });
    btn.addEventListener('mouseleave', clearTargetHighlight);
  });

  detail.querySelectorAll('.pfi-hint-clickable[data-role="open-config"]').forEach(hint => {
    hint.addEventListener('click', (e) => { e.stopPropagation(); showConfig(); });
  });

  detail.querySelectorAll('.pfi-event-row').forEach(row => {
    row.addEventListener('mouseenter', () => {
      highlightEventRow(row.getAttribute('data-value'));
      row.classList.add('pfi-event-row-active');
    });
    row.addEventListener('mouseleave', () => {
      clearEventRowHighlights();
      row.classList.remove('pfi-event-row-active');
    });
  });

  const formHost = detail.querySelector('[data-role="api-form-host"]');
  detail.querySelectorAll('.pfi-api-method-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openApiArgForm(
        formHost, btn,
        btn.getAttribute('data-wvar'),
        btn.getAttribute('data-method'),
        parseInt(btn.getAttribute('data-arity'), 10) || 0,
        { executeWidgetAction, showToast, showResultModal }
      );
    });
  });
}
