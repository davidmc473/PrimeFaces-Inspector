/**
 * Tipos compartidos entre el page script, el content script y la UI.
 * El objeto Widget viaja por postMessage entre los tres contextos:
 * este es su contrato.
 */

export interface WidgetEventParam {
  letter: string;
  name: string;
  desc: string;
  value: string;
}

export type WidgetEventSource = 'inline' | 'jquery';

export interface WidgetEvent {
  source: WidgetEventSource;
  event: string;
  raw: string;
  parsedParams: WidgetEventParam[];
  ownerId: string | null;
}

export interface ClientAPIMethod {
  name: string;
  arity: number;
  callable: boolean;
}

export type WidgetMetadata = Record<string, string | number | boolean | null>;

export interface Widget {
  widgetVar: string;
  id: string;
  type: string;
  clientAPI: ClientAPIMethod[];
  targetId: string | null;
  events: WidgetEvent[];
  metadata: WidgetMetadata;
  exists: boolean;
}

export interface PageInfo {
  hasPrimeFaces: boolean;
  version: string | null;
  hasPrimeFacesExt: boolean;
  versionExt: string | null;
  hasJQuery: boolean;
  widgetCount: number;
}

/** Parámetros interceptados de una llamada PrimeFaces.ab() */
export interface AjaxInfo {
  source: string | null;
  formId: string | null;
  process: string | null;
  update: string | null;
}

/** Resultado de ejecutar un método del Client API o un evento inline */
export interface ExecResult {
  success: boolean;
  widgetVar: string;
  method: string;
  hasResult?: boolean;
  result?: string;
  error?: string;
  callId?: string | null;
  argsCount?: number;
}
