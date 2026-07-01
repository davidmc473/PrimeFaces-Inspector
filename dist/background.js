"use strict";
(() => {
  // src/background/background.js
  async function sendToTab(tabId, message) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch (e) {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["dist/content.css"] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ["dist/content.js"] });
      await new Promise((r) => setTimeout(r, 50));
      await chrome.tabs.sendMessage(tabId, message);
    }
  }
  var CTX_MENU_ID = "pfi-inspect-widget";
  chrome.runtime.onInstalled.addListener(() => {
    const lang = (chrome.i18n?.getUILanguage() || "en").toLowerCase();
    const title = lang.startsWith("es") ? "Inspeccionar widget PrimeFaces" : "Inspect PrimeFaces widget";
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: CTX_MENU_ID, title, contexts: ["all"] });
    });
  });
  chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CTX_MENU_ID || !tab || !tab.id) return;
    try {
      await sendToTab(tab.id, { action: "inspectContextTarget" });
    } catch (err) {
      console.warn("PF Inspector: no se pudo inyectar en esta p\xE1gina.", err);
    }
  });
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
