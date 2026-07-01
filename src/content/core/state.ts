import type { ExecResult, PageInfo, Widget } from '../../shared/types.js';

export interface InspectorState {
  /** Elemento host del Shadow DOM, hijo directo de <body> */
  hostEl: HTMLElement | null;
  /** ShadowRoot donde vive el panel (aislado del CSS de la página) */
  shadowRoot: ShadowRoot | null;
  panelEl: HTMLElement | null;
  widgetsData: Widget[];
  pageInfo: PageInfo;
  filteredData: Widget[];
  searchTerm: string;
  selectedTypes: Set<string>;
  currentHighlight: Element | null;
  currentTargetHighlight: Element | null;
  eventRowHighlights: Element[];
  selectionMode: boolean;
  ctrlShiftFired: boolean;
  callSeq: number;
  pendingResultCallbacks: Map<string, (data: ExecResult) => void>;
}

export const state: InspectorState = {
  hostEl: null,
  shadowRoot: null,
  panelEl: null,
  widgetsData: [],
  pageInfo: {
    hasPrimeFaces: false,
    version: null,
    hasPrimeFacesExt: false,
    versionExt: null,
    hasJQuery: false,
    widgetCount: 0,
  },
  filteredData: [],
  searchTerm: '',
  selectedTypes: new Set(),
  currentHighlight: null,
  currentTargetHighlight: null,
  eventRowHighlights: [],
  selectionMode: false,
  ctrlShiftFired: false,
  callSeq: 0,
  pendingResultCallbacks: new Map(),
};
