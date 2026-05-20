document.getElementById('btnOpen').addEventListener('click', async () => {
  const status = document.getElementById('status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    status.textContent = '✓ Panel abierto';
    status.className = 'status ok';
    setTimeout(() => window.close(), 600);
  } catch (e) {
    status.textContent = '✗ No se pudo abrir. ¿Página compatible?';
    status.className = 'status err';
  }
});
