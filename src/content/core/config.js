export const DEFAULT_COLOR_UPDATE = '#ff00aa';
export const DEFAULT_COLOR_PROCESS = '#00c850';

export const config = {
  highlightUpdates: true,
  highlightProcess: true,
  colorUpdate: DEFAULT_COLOR_UPDATE,
  colorProcess: DEFAULT_COLOR_PROCESS,
  theme: 'dark',
  persistPanel: true,
  panelOpen: false,
  detailWidgetVar: null,
  language: 'auto',
  showJqueryEvents: false,
};

export function loadConfig(cb) {
  try {
    chrome.storage.local.get(['pfInspectorConfig'], (result) => {
      if (result.pfInspectorConfig) {
        Object.assign(config, result.pfInspectorConfig);
      }
      if (typeof cb === 'function') cb();
    });
  } catch (e) {
    if (typeof cb === 'function') cb();
  }
}

export function saveConfig() {
  try {
    chrome.storage.local.set({ pfInspectorConfig: config });
  } catch (e) { /* ignore */ }
}

export function hexToRgb(hex) {
  if (!hex) return { r: 255, g: 0, b: 170 };
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  if (isNaN(num)) return { r: 255, g: 0, b: 170 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function applyDynamicColors() {
  let style = document.getElementById('pf-inspector-dynamic-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'pf-inspector-dynamic-style';
    (document.head || document.documentElement).appendChild(style);
  }
  const u = hexToRgb(config.colorUpdate);
  const p = hexToRgb(config.colorProcess);
  style.textContent = `
@keyframes pfi-flash-update-dyn {
  0%   { background-color: rgba(${u.r},${u.g},${u.b},.20); box-shadow: inset 0 0 0 2px rgba(${u.r},${u.g},${u.b},.85); }
  100% { background-color: transparent; box-shadow: inset 0 0 0 2px transparent; }
}
.pfi-highlight-update { animation: pfi-flash-update-dyn .8s ease-out forwards !important; }
@keyframes pfi-flash-process-dyn {
  0%   { background-color: rgba(${p.r},${p.g},${p.b},.20); box-shadow: inset 0 0 0 2px rgba(${p.r},${p.g},${p.b},.85); }
  100% { background-color: transparent; box-shadow: inset 0 0 0 2px transparent; }
}
.pfi-highlight-process { animation: pfi-flash-process-dyn .8s ease-out forwards !important; }
  `;
}
