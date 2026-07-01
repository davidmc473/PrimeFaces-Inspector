/* Página de DevTools (devtools_page): Chrome la carga oculta al abrir
   las DevTools sobre cualquier pestaña. Su único trabajo es registrar
   el panel "PrimeFaces". La UI real vive en devtools/panel.html. */
chrome.devtools.panels.create('PrimeFaces', 'icons/icon48.png', 'devtools/panel.html');
