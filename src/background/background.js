/** Inyecta el content script si aún no está y le envía un mensaje. */
async function sendToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['dist/content.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['dist/content.js'] });
    await new Promise(r => setTimeout(r, 50));
    await chrome.tabs.sendMessage(tabId, message);
  }
}

/* ── Panel de DevTools: relay puerto devtools ↔ content script ──
   El panel (contexto devtools) no puede hablar directamente con el
   content script; se conecta aquí con un puerto e indica su tabId.
   Los mensajes 'toTab' se reenvían al content script de esa pestaña
   y lo que el content script emite con pfiDevtools:true vuelve al
   puerto correspondiente. */
const devtoolsPorts = new Map(); // tabId → Port

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'pfi-devtools') return;
  let tabId = null;
  port.onMessage.addListener(async (msg) => {
    if (!msg) return;
    if (msg.type === 'init' && typeof msg.tabId === 'number') {
      tabId = msg.tabId;
      devtoolsPorts.set(tabId, port);
      return;
    }
    if (msg.type === 'toTab' && tabId != null && msg.message) {
      try {
        await sendToTab(tabId, msg.message);
      } catch (e) {
        // Página no inyectable (chrome://, Web Store…): avisar al panel
        try { port.postMessage({ type: 'pfiError' }); } catch (_) { /* puerto cerrado */ }
      }
    }
  });
  port.onDisconnect.addListener(() => {
    if (tabId != null && devtoolsPorts.get(tabId) === port) devtoolsPorts.delete(tabId);
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.pfiDevtools && sender.tab && sender.tab.id != null) {
    const port = devtoolsPorts.get(sender.tab.id);
    if (port) {
      try { port.postMessage(msg); } catch (_) { /* puerto cerrado */ }
    }
  }
});

/* ── Menú contextual: "Inspeccionar widget PrimeFaces" ── */
const CTX_MENU_ID = 'pfi-inspect-widget';

chrome.runtime.onInstalled.addListener(() => {
  const lang = (chrome.i18n?.getUILanguage() || 'en').toLowerCase();
  const title = lang.startsWith('es')
    ? 'Inspeccionar widget PrimeFaces'
    : 'Inspect PrimeFaces widget';
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: CTX_MENU_ID, title, contexts: ['all'] });
  });
});

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CTX_MENU_ID || !tab || !tab.id) return;
  try {
    await sendToTab(tab.id, { action: 'inspectContextTarget' });
  } catch (err) {
    console.warn('PF Inspector: no se pudo inyectar en esta página.', err);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
  } catch (e) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['dist/content.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['dist/content.js'] });
      await new Promise(r => setTimeout(r, 50));
      await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    } catch (err) {
      console.warn('PF Inspector: no se pudo inyectar en esta página.', err);
    }
  }
});

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== 'toggle-panel') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
  } catch (e) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['dist/content.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['dist/content.js'] });
      await new Promise(r => setTimeout(r, 50));
      await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    } catch (_) { /* ignore */ }
  }
});
