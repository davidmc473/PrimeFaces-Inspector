/**
 * PrimeFaces Inspector – English locale
 * Registra las cadenas en window.__PF_I18N para que las consuma content.js
 */
(function () {
  'use strict';
  window.__PF_I18N = window.__PF_I18N || {};
  window.__PF_I18N.en = {
    title: 'PrimeFaces Inspector',
    searchPlaceholder: 'Search widgetVar, id, type…',
    filterAll: 'All types',
    filterMulti: '{0} selected',
    filterButton: 'Filter',
    filterClear: 'Clear',
    filterApply: 'Apply',
    noWidgets: 'No PrimeFaces widgets found.',

    pfNotDetected: 'PrimeFaces not detected on this page.',
    pfDetected: 'PrimeFaces {0}',
    pfExtDetected: 'PF Extensions {0}',
    pfExtNotDetected: 'PF Extensions not detected.',
    jqueryMissing: '(jQuery not found)',

    btnSelect: 'Selection mode (or Ctrl+Shift)',
    btnConfig: 'Settings',
    btnRefresh: 'Refresh list',
    btnClose: 'Close',
    back: 'Back',

    expand: 'Expand',
    collapse: 'Collapse',

    sectionInfo: 'General information',
    sectionMetadata: 'Metadata',
    sectionTarget: 'Target',
    sectionActions: 'Actions',
    sectionClientApi: 'Client API',
    sectionEvents: 'Events',
    eventsEmpty: 'No events detected.',
    eventsJqueryDisabled: 'jQuery events disabled in settings.',
    apiNeedsArgs: 'requires arguments',
    btnExecEvent: 'Execute this event',

    labelWidgetVar: 'widgetVar',
    labelId: 'ID',
    labelType: 'Type',
    labelTargetId: 'Target ID',
    thLetter: 'Key',
    thMeaning: 'Meaning',
    thDescription: 'Description',
    thValue: 'Value',
    sourceInline: 'inline',
    sourceJquery: 'jQuery',
    execOk: "✓ PF('{0}').{1}() executed",
    execOkResult: "✓ PF('{0}').{1}() → {2}",
    execErr: '✗ Error: {0}',
    openConfig: 'Open settings',
    disabledAlready: 'widget is already disabled',
    enabledAlready: 'widget is already enabled',
    shownAlready: 'widget is already visible',
    hiddenAlready: 'widget is already hidden',

    // Toasts and result modal
    viewFull: 'View full',
    resultTitle: 'Result',
    copyResult: 'Copy result',
    copied: '✓ Copied to clipboard',

    // Client API mini-form for methods that need arguments
    apiOpenForm: 'Open form for {0}() with {1} argument(s)',
    argPlaceholder: "e.g. 2, 'text', true, [1,2]",
    argHint: 'Enter valid JSON or plain text. Empty = skip argument.',
    btnExec: 'Execute',
    btnCancel: 'Cancel',
    executing: 'Executing…',
    returnedValue: 'Returned value',



    cfgTitle: 'Settings',
    cfgTheme: 'Light theme',
    cfgThemeDesc: 'Switch between dark and light mode.',
    cfgUpdates: 'Highlight Updates',
    cfgUpdatesDesc: 'Highlight elements updated by an Ajax response.',
    cfgProcess: 'Highlight Process',
    cfgProcessDesc: 'Highlight elements processed by PrimeFaces.ab().',
    cfgColorUpdate: 'Update color',
    cfgColorProcess: 'Process color',
    cfgPersist: 'Persist panel across navigation',
    cfgPersistDesc: 'Keep the panel open and reload it automatically when navigating.',
    cfgShowJquery: 'Show jQuery events',
    cfgShowJqueryDesc: 'Display events bound via jQuery on the widget detail.',
    cfgLanguage: 'Language',
    cfgLangAuto: 'Auto (browser)',
    cfgLangEn: 'English',
    cfgLangEs: 'Spanish',
    cfgAbout: 'About',
    cfgVersion: 'Version',
    cfgRepo: 'Repository',
    cfgReset: 'Reset colors'
  };
})();
