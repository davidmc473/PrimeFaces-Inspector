import { t } from '../core/i18n.js';
import { icon } from './icons.js';
import { escHtml, escAttr } from './utils.js';

export function openApiArgForm(host, triggerBtn, widgetVar, method, arity, callbacks) {
  if (!host) return;
  const { executeWidgetAction, showToast, showResultModal } = callbacks;

  const existing = host.querySelector('.pfi-api-form');
  const sameMethod = existing
    && existing.getAttribute('data-method') === method
    && existing.getAttribute('data-wvar') === widgetVar;
  host.innerHTML = '';
  host.parentElement.querySelectorAll('.pfi-api-method-btn.pfi-api-method-active')
    .forEach(b => b.classList.remove('pfi-api-method-active'));

  if (sameMethod) return;
  if (triggerBtn) triggerBtn.classList.add('pfi-api-method-active');

  const argCount = Math.max(arity, 1);
  const argRowsHtml = Array.from({ length: argCount }, (_, i) => `
    <div class="pfi-arg-row">
      <label class="pfi-arg-label">arg ${i + 1}</label>
      <input type="text" class="pfi-arg-input"
        data-arg-index="${i}"
        placeholder="${escAttr(t('argPlaceholder'))}"
        spellcheck="false"
        autocomplete="off">
    </div>
  `).join('');

  const form = document.createElement('div');
  form.className = 'pfi-api-form';
  form.setAttribute('data-method', method);
  form.setAttribute('data-wvar', widgetVar);
  form.innerHTML = `
    <div class="pfi-api-form-header">
      <span class="pfi-api-form-title">PF('${escHtml(widgetVar)}').${escHtml(method)}(…)</span>
      <button type="button" class="pfi-icon-btn" data-role="close" title="${escAttr(t('btnCancel'))}">${icon('x', 13)}</button>
    </div>
    <div class="pfi-api-form-hint">${escHtml(t('argHint'))}</div>
    <div class="pfi-api-form-body">${argRowsHtml}</div>
    <div class="pfi-api-form-footer">
      <button type="button" class="pfi-exec-btn" data-role="exec">${icon('play', 13)} ${escHtml(t('btnExec'))}</button>
    </div>
    <div class="pfi-api-result" data-role="result" hidden></div>
  `;
  host.appendChild(form);

  const resultBox = form.querySelector('[data-role="result"]');
  const inputs = Array.from(form.querySelectorAll('.pfi-arg-input'));

  form.querySelector('[data-role="close"]').addEventListener('click', () => {
    host.innerHTML = '';
    if (triggerBtn) triggerBtn.classList.remove('pfi-api-method-active');
  });

  setTimeout(() => { if (inputs[0]) inputs[0].focus(); }, 50);

  function execForm() {
    const args = inputs.map(inp => {
      if (inp.value === '') return undefined;
      try { return JSON.parse(inp.value); } catch (e) { return inp.value; }
    });
    while (args.length > 0 && args[args.length - 1] === undefined) args.pop();

    resultBox.hidden = false;
    resultBox.className = 'pfi-api-result pfi-api-result-pending';
    resultBox.textContent = t('executing');

    executeWidgetAction(widgetVar, method, args, (data) => {
      if (!data.success) {
        resultBox.className = 'pfi-api-result pfi-api-result-err';
        resultBox.textContent = data.error || '';
        return;
      }
      resultBox.className = 'pfi-api-result pfi-api-result-ok';
      if (!data.hasResult) {
        resultBox.textContent = t('execOk', data.widgetVar, data.method);
      } else {
        const full = String(data.result == null ? '' : data.result);
        resultBox.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'pfi-api-result-header';
        header.textContent = t('returnedValue') + ':';
        resultBox.appendChild(header);
        const pre = document.createElement('pre');
        pre.className = 'pfi-result-pre';
        pre.textContent = full;
        resultBox.appendChild(pre);

        const actions = document.createElement('div');
        actions.className = 'pfi-api-result-actions';
        if (full.length > 200) {
          const expandBtn = document.createElement('button');
          expandBtn.className = 'pfi-ghost-btn';
          expandBtn.innerHTML = icon('maximize-2', 12) + ' ' + escHtml(t('viewFull'));
          expandBtn.addEventListener('click', () => {
            showResultModal("PF('" + widgetVar + "')." + method + '()', full);
          });
          actions.appendChild(expandBtn);
        }
        const copyBtn = document.createElement('button');
        copyBtn.className = 'pfi-ghost-btn';
        copyBtn.innerHTML = icon('copy', 12) + ' ' + escHtml(t('copyResult'));
        copyBtn.addEventListener('click', () => {
          try { navigator.clipboard.writeText(full); showToast({ success: true, text: t('copied') }); } catch (e) { /* */ }
        });
        actions.appendChild(copyBtn);
        resultBox.appendChild(actions);
      }
    });
  }

  form.querySelector('[data-role="exec"]').addEventListener('click', execForm);
  inputs.forEach(inp => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); execForm(); } });
  });
}
