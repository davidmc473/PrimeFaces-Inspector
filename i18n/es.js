/**
 * PrimeFaces Inspector – Spanish locale
 * Registra las cadenas en window.__PF_I18N para que las consuma content.js
 */
(function () {
  'use strict';
  window.__PF_I18N = window.__PF_I18N || {};
  window.__PF_I18N.es = {
    title: 'PrimeFaces Inspector',
    searchPlaceholder: 'Buscar widgetVar, id, tipo…',
    filterAll: 'Todos los tipos',
    filterMulti: '{0} seleccionados',
    filterButton: 'Filtro',
    filterClear: 'Limpiar',
    filterApply: 'Aplicar',
    noWidgets: 'No se encontraron widgets de PrimeFaces.',

    pfNotDetected: 'PrimeFaces no detectado en esta página.',
    pfDetected: 'PrimeFaces {0}',
    pfExtDetected: 'PF Extensions {0}',
    pfExtNotDetected: 'PF Extensions no detectado.',
    jqueryMissing: '(jQuery no encontrado)',

    btnSelect: 'Modo selección (o Ctrl+Shift)',
    btnConfig: 'Configuración',
    btnRefresh: 'Actualizar lista',
    btnClose: 'Cerrar',
    back: 'Volver',

    expand: 'Expandir',
    collapse: 'Contraer',

    sectionInfo: 'Información general',
    sectionMetadata: 'Metadatos',
    sectionTarget: 'Target',
    sectionActions: 'Acciones',
    sectionClientApi: 'Client API',
    sectionEvents: 'Eventos',
    eventsEmpty: 'Sin eventos detectados.',
    eventsJqueryDisabled: 'Eventos jQuery desactivados en la configuración.',
    apiNeedsArgs: 'requiere argumentos',
    btnExecEvent: 'Ejecutar este evento',

    labelWidgetVar: 'widgetVar',
    labelId: 'ID',
    labelType: 'Tipo',
    labelTargetId: 'Target ID',
    thLetter: 'Letra',
    thMeaning: 'Significado',
    thDescription: 'Descripción',
    thValue: 'Valor',
    sourceInline: 'inline',
    sourceJquery: 'jQuery',
    execOk: "✓ PF('{0}').{1}() ejecutado",
    execOkResult: "✓ PF('{0}').{1}() → {2}",
    execErr: '✗ Error: {0}',
    openConfig: 'Abrir configuración',
    disabledAlready: 'el widget ya está deshabilitado',
    enabledAlready: 'el widget ya está habilitado',
    shownAlready: 'el widget ya es visible',
    hiddenAlready: 'el widget ya está oculto',

    // Toasts y modal de resultados
    viewFull: 'Ver completo',
    resultTitle: 'Resultado',
    copyResult: 'Copiar resultado',
    copied: '✓ Copiado al portapapeles',

    // Mini-formulario de Client API con argumentos
    apiOpenForm: 'Abrir formulario para {0}() con {1} argumento(s)',
    argPlaceholder: "p.ej. 2, 'texto', true, [1,2]",
    argHint: 'Introduce JSON válido o texto plano. Vacío = omitir argumento.',
    btnExec: 'Ejecutar',
    btnCancel: 'Cancelar',
    executing: 'Ejecutando…',
    returnedValue: 'Valor devuelto',



    cfgTitle: 'Configuración',
    cfgTheme: 'Tema claro',
    cfgThemeDesc: 'Cambiar entre modo oscuro y claro.',
    cfgUpdates: 'Highlight Actualizaciones',
    cfgUpdatesDesc: 'Resaltar los elementos actualizados por respuesta Ajax.',
    cfgProcess: 'Highlight Process',
    cfgProcessDesc: 'Resaltar los elementos procesados al llamar PrimeFaces.ab().',
    cfgColorUpdate: 'Color de Actualizaciones',
    cfgColorProcess: 'Color de Process',
    cfgPersist: 'Persistir el panel al navegar',
    cfgPersistDesc: 'Mantener el panel abierto y refrescarlo automáticamente al cambiar de página.',
    cfgShowJquery: 'Mostrar eventos jQuery',
    cfgShowJqueryDesc: 'Mostrar en el detalle del widget los eventos enlazados mediante jQuery.',
    cfgLanguage: 'Idioma',
    cfgLangAuto: 'Auto (navegador)',
    cfgLangEn: 'Inglés',
    cfgLangEs: 'Español',
    cfgAbout: 'Acerca de',
    cfgVersion: 'Versión',
    cfgRepo: 'Repositorio',
    cfgReset: 'Restablecer colores'
  };
})();
