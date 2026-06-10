const ATTRS = `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

function svg(size, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ${ATTRS} aria-hidden="true">${content}</svg>`;
}

const PATHS = {
  'x':             '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
  'arrow-left':    '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  'play':          '<polygon points="5 3 19 12 5 21 5 3"/>',
  'terminal':      '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  'search':        '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  'filter':        '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  'maximize-2':    '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
  'copy':          '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  'crosshair':     '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
  'rotate-ccw':    '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>',
  'settings':      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  'globe':         '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  'sun':           '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  'moon':          '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  'zap':           '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'bookmark':      '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  'info':          '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  'github':        '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
  'alert-triangle':'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  'check-circle':  '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  'check':         '<polyline points="20 6 9 17 4 12"/>',
};

export function icon(name, size = 14) {
  return svg(size, PATHS[name] || PATHS['x']);
}

/* ── Iconos de tipo de componente (emojis clasificados por categoría) ── */
export const COMPONENT_ICONS = {
  DataTable: '⊞', CommandButton: '◉', CommandLink: '↗',
  Dialog: '▣', Panel: '▤', TabView: '⊟',
  InputNumber: '①', InputMask: '⌨',
  InputText: '✎', InputTextarea: '≡', Calendar: '▦',
  DatePicker: '▦', TimePicker: '⊙',
  SelectOneMenu: '▽', SelectBooleanCheckbox: '☑', SelectManyCheckbox: '☑',
  AutoComplete: '⌕', FileUpload: '⇧', Tree: '⊳',
  TreeTable: '⊳', AccordionPanel: '⊞', Menu: '≡',
  Menubar: '≡', ContextMenu: '≡', Growl: '◈',
  Messages: '◈', Message: '◈', OverlayPanel: '▣', Tooltip: '◇',
  ProgressBar: '▬', Chart: '⊿', Schedule: '▦',
  Carousel: '◫', Galleria: '▣', Editor: '✎',
  Spinner: '①', Slider: '▬', Rating: '◆',
  ColorPicker: '◈', Chips: '◉', PickList: '⇄',
  OrderList: '⇅', DataList: '▤', DataGrid: '⊞',
  DataScroller: '▤', Paginator: '▶', Fieldset: '▣',
  ConfirmDialog: '◈', Sidebar: '▤', Inplace: '✎',
  BlockUI: '⊘', Poll: '↺', RemoteCommand: '⚡',
  OutputPanel: '▤', AjaxStatus: '↺', Fragment: '◈',
  Default: '◈',
};

const ICON_KEYS = Object.keys(COMPONENT_ICONS)
  .filter(k => k !== 'Default')
  .sort((a, b) => b.length - a.length);

export function getComponentIcon(type) {
  if (!type) return COMPONENT_ICONS.Default;
  const low = type.toLowerCase();
  for (const key of ICON_KEYS) {
    if (low.includes(key.toLowerCase())) return COMPONENT_ICONS[key];
  }
  return COMPONENT_ICONS.Default;
}

/* ── Iconos de acciones del Client API ── */
const ACTION_ICON_MAP = {
  clear: 'rotate-ccw', close: 'x', show: 'check', hide: 'x',
  toggle: 'check', enable: 'check', disable: 'x', focus: 'crosshair',
  open: 'play', expand: 'play', collapse: 'x', reset: 'rotate-ccw',
  reload: 'rotate-ccw', play: 'play', stop: 'x', pause: 'x',
};

export function getActionIcon(name) {
  if (ACTION_ICON_MAP[name]) return icon(ACTION_ICON_MAP[name], 12);
  const low = name.toLowerCase();
  if (low.startsWith('show') || low.startsWith('enable') || low.startsWith('open') || low.startsWith('expand') || low.startsWith('start') || low.startsWith('play')) return icon('play', 12);
  if (low.startsWith('hide') || low.startsWith('disable') || low.startsWith('close') || low.startsWith('collapse') || low.startsWith('stop')) return icon('x', 12);
  if (low.startsWith('clear') || low.startsWith('reset') || low.startsWith('refresh') || low.startsWith('reload')) return icon('rotate-ccw', 12);
  if (low.startsWith('toggle')) return icon('check', 12);
  if (low.startsWith('focus')) return icon('crosshair', 12);
  if (low.startsWith('select')) return icon('check', 12);
  return icon('play', 12);
}
