(() => {
  // src/background/background.js
  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab || !tab.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
    } catch (e) {
      try {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["dist/content.css"] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["dist/content.js"] });
        await new Promise((r) => setTimeout(r, 50));
        await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
      } catch (err) {
        console.warn("PF Inspector: no se pudo inyectar en esta p\xE1gina.", err);
      }
    }
  });
  chrome.commands?.onCommand.addListener(async (command) => {
    if (command !== "toggle-panel") return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
    } catch (e) {
      try {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["dist/content.css"] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["dist/content.js"] });
        await new Promise((r) => setTimeout(r, 50));
        await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
      } catch (_) {
      }
    }
  });
})();
