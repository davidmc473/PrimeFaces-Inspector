// Background service worker — Manifest V3
// Al hacer click en el icono de la extensión, asegúrate de que el content
// script está inyectado y luego pide togglear el panel.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    // Probar primero a hablar con el content script; si no existe, inyectarlo
    await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
  } catch (e) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/content.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['i18n/en.js', 'i18n/es.js', 'content/content.js']
      });
      // Pequeña espera para que el listener se registre
      await new Promise(r => setTimeout(r, 50));
      await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    } catch (err) {
      // Algunas páginas (chrome://, store, pdf interno, etc.) no permiten inyección.
      console.warn('PF Inspector: no se pudo inyectar en esta página.', err);
    }
  }
});

// Atajo de teclado opcional para abrir el inspector (Alt+Shift+P).
// El modo selección (Ctrl+Shift) se maneja dentro del content script.
chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== 'toggle-panel') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
  } catch (e) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/content.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['i18n/en.js', 'i18n/es.js', 'content/content.js'] });
      await new Promise(r => setTimeout(r, 50));
      await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    } catch (_) { /* ignore */ }
  }
});
