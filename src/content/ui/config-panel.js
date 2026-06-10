import { config, saveConfig, DEFAULT_COLOR_UPDATE, DEFAULT_COLOR_PROCESS, applyDynamicColors } from '../core/config.js';
import { state } from '../core/state.js';
import { t } from '../core/i18n.js';
import { icon } from './icons.js';
import { escHtml, escAttr } from './utils.js';
import { requestWidgets } from '../core/messaging.js';

const GITHUB_URL = 'https://github.com/davidmc473/primefaces-chrome-extension';
const EXT_VERSION = (() => { try { return chrome.runtime.getManifest().version; } catch (e) { return '0.4.0'; } })();

function cfgSection(titleKey, content) {
  return `<div class="pfi-cfg-section"><div class="pfi-cfg-section-title">${escHtml(t(titleKey))}</div>${content}</div>`;
}

function cfgRow(labelKey, descKey, control) {
  const desc = descKey ? `<div class="pfi-cfg-desc">${escHtml(t(descKey))}</div>` : '';
  return `<div class="pfi-cfg-row">
    <div class="pfi-cfg-text"><span class="pfi-cfg-label">${escHtml(t(labelKey))}</span>${desc}</div>
    <div class="pfi-cfg-control">${control}</div>
  </div>`;
}

function toggle(id, checked) {
  return `<label class="pfi-toggle" for="${id}">
    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span class="pfi-slider"></span>
  </label>`;
}

export function showConfig(callbacks) {
  const existing = state.panelEl.querySelector('.pfi-config-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.className = 'pfi-config-overlay';
  overlay.innerHTML = `
    <div class="pfi-overlay-header">
      <button class="pfi-icon-btn" id="pfi-config-back" title="${escAttr(t('back'))}">${icon('arrow-left', 14)}</button>
      <span class="pfi-overlay-title">${icon('settings', 14)} ${escHtml(t('cfgTitle'))}</span>
    </div>
    <div class="pfi-cfg-body">

      ${cfgSection('cfgSectionAppearance', `
        ${cfgRow('cfgLanguage', null, `
          <select id="pfi-cfg-language" class="pfi-select">
            <option value="auto" ${config.language === 'auto' ? 'selected' : ''}>${escHtml(t('cfgLangAuto'))}</option>
            <option value="en"   ${config.language === 'en'   ? 'selected' : ''}>${escHtml(t('cfgLangEn'))}</option>
            <option value="es"   ${config.language === 'es'   ? 'selected' : ''}>${escHtml(t('cfgLangEs'))}</option>
          </select>`)}
        ${cfgRow('cfgTheme', 'cfgThemeDesc', toggle('pfi-cfg-theme', config.theme === 'light'))}
      `)}

      ${cfgSection('cfgSectionAjax', `
        ${cfgRow('cfgUpdates', 'cfgUpdatesDesc', toggle('pfi-cfg-updates', config.highlightUpdates))}
        <div class="pfi-cfg-color-row">
          <span class="pfi-cfg-label">${escHtml(t('cfgColorUpdate'))}</span>
          <input type="color" id="pfi-cfg-color-update" value="${escAttr(config.colorUpdate)}" class="pfi-color-picker">
        </div>
        ${cfgRow('cfgProcess', 'cfgProcessDesc', toggle('pfi-cfg-process', config.highlightProcess))}
        <div class="pfi-cfg-color-row">
          <span class="pfi-cfg-label">${escHtml(t('cfgColorProcess'))}</span>
          <input type="color" id="pfi-cfg-color-process" value="${escAttr(config.colorProcess)}" class="pfi-color-picker">
        </div>
        <div class="pfi-cfg-reset-row">
          <button type="button" class="pfi-ghost-btn" id="pfi-cfg-reset-colors">${icon('rotate-ccw', 12)} ${escHtml(t('cfgReset'))}</button>
        </div>
      `)}

      ${cfgSection('cfgSectionBehavior', `
        ${cfgRow('cfgShowJquery', 'cfgShowJqueryDesc', toggle('pfi-cfg-jquery', config.showJqueryEvents))}
        ${cfgRow('cfgPersist',    'cfgPersistDesc',    toggle('pfi-cfg-persist', config.persistPanel))}
      `)}

      <div class="pfi-cfg-about">
        <div class="pfi-cfg-about-title">${icon('info', 12)} ${escHtml(t('cfgAbout'))}</div>
        <div class="pfi-cfg-about-row">
          <span>${escHtml(t('cfgVersion'))}</span>
          <span class="pfi-mono">${escHtml(EXT_VERSION)}</span>
        </div>
        <div class="pfi-cfg-about-row">
          <span>${escHtml(t('cfgRepo'))}</span>
          <a class="pfi-link" href="${escAttr(GITHUB_URL)}" target="_blank" rel="noopener noreferrer">
            ${icon('github', 13)} GitHub ↗
          </a>
        </div>
      </div>

    </div>
  `;

  state.panelEl.appendChild(overlay);

  overlay.querySelector('#pfi-config-back').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#pfi-cfg-language').addEventListener('change', (e) => {
    config.language = e.target.value;
    saveConfig();
    if (callbacks && callbacks.reloadPanel) callbacks.reloadPanel();
  });

  overlay.querySelector('#pfi-cfg-theme').addEventListener('change', (e) => {
    config.theme = e.target.checked ? 'light' : 'dark';
    if (callbacks && callbacks.applyTheme) callbacks.applyTheme();
    saveConfig();
  });

  overlay.querySelector('#pfi-cfg-updates').addEventListener('change', (e) => { config.highlightUpdates = e.target.checked; saveConfig(); });
  overlay.querySelector('#pfi-cfg-process').addEventListener('change', (e) => { config.highlightProcess = e.target.checked; saveConfig(); });
  overlay.querySelector('#pfi-cfg-persist').addEventListener('change', (e) => { config.persistPanel = e.target.checked; saveConfig(); });

  overlay.querySelector('#pfi-cfg-jquery').addEventListener('change', (e) => {
    config.showJqueryEvents = e.target.checked;
    saveConfig();
    requestWidgets();
  });

  overlay.querySelector('#pfi-cfg-color-update').addEventListener('input', (e) => {
    config.colorUpdate = e.target.value; applyDynamicColors(); saveConfig();
  });
  overlay.querySelector('#pfi-cfg-color-process').addEventListener('input', (e) => {
    config.colorProcess = e.target.value; applyDynamicColors(); saveConfig();
  });

  overlay.querySelector('#pfi-cfg-reset-colors').addEventListener('click', () => {
    config.colorUpdate  = DEFAULT_COLOR_UPDATE;
    config.colorProcess = DEFAULT_COLOR_PROCESS;
    overlay.querySelector('#pfi-cfg-color-update').value  = DEFAULT_COLOR_UPDATE;
    overlay.querySelector('#pfi-cfg-color-process').value = DEFAULT_COLOR_PROCESS;
    applyDynamicColors();
    saveConfig();
  });
}
